import hashlib
import hmac
import json
import logging
import time
import uuid
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse

from django.conf import settings
from django.db import IntegrityError, transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .kpay_client import (
    KPayAPIError,
    KPayConfigurationError,
    chemin_statut_kpay,
    kpay_api_request,
    verifier_configuration_kpay,
)
from .models import KPayPayment
from .serializers import KPayPaymentInitSerializer

logger = logging.getLogger(__name__)


REMOTE_STATUS = {
    "CREATED": KPayPayment.Status.PENDING,
    "INITIATED": KPayPayment.Status.PENDING,
    "PENDING": KPayPayment.Status.PENDING,
    "PROCESSING": KPayPayment.Status.PROCESSING,
    "COMPLETED": KPayPayment.Status.COMPLETED,
    "SUCCESS": KPayPayment.Status.COMPLETED,
    "SUCCEEDED": KPayPayment.Status.COMPLETED,
    "PAID": KPayPayment.Status.COMPLETED,
    "FAILED": KPayPayment.Status.FAILED,
    "CANCELLED": KPayPayment.Status.CANCELLED,
    "CANCELED": KPayPayment.Status.CANCELLED,
}
FINAL_STATUSES = {
    KPayPayment.Status.COMPLETED,
    KPayPayment.Status.FAILED,
    KPayPayment.Status.CANCELLED,
}
WEBHOOK_EVENT_STATUS = {
    "payment.completed": KPayPayment.Status.COMPLETED,
    "payment.failed": KPayPayment.Status.FAILED,
    "payment.cancelled": KPayPayment.Status.CANCELLED,
}


def _public_url(route_name):
    base = getattr(settings, "KPAY_PUBLIC_BASE_URL", "").strip().rstrip("/")
    parsed = urlparse(base)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise KPayConfigurationError(
            "KPAY_PUBLIC_BASE_URL doit être l’origine HTTPS publique de l’API Hypnos."
        )
    return base + reverse(route_name)


def _status_from_remote(value):
    return REMOTE_STATUS.get(str(value or "").upper(), KPayPayment.Status.PENDING)


def _appliquer_reponse_kpay(payment, data, event_status=None):
    remote_id = data.get("id") or data.get("paymentId") or data.get("payment_id")
    reference = data.get("reference")
    raw_status = event_status or data.get("status")
    mapped = raw_status if raw_status in FINAL_STATUSES else _status_from_remote(raw_status)

    # Les événements finaux ne doivent pas être régressés par un ancien retour
    # HTTP ou par un callback arrivé dans le désordre.
    if payment.status not in FINAL_STATUSES or mapped == payment.status:
        payment.status = mapped
    if remote_id:
        payment.kpay_id = str(remote_id)[:128]
    if reference:
        payment.reference = str(reference)[:128]
    if "isTest" in data:
        payment.is_test = bool(data["isTest"])
    if data.get("errorMessage") or data.get("failureReason"):
        payment.failure_reason = str(data.get("errorMessage") or data.get("failureReason"))[:2000]
    payment.provider_data = data
    payment.save()


def _payment_response(payment, *, idempotent=False, provider_checked=None):
    result = {
        "id": str(payment.id),
        "externalId": payment.external_id,
        "reference": payment.reference,
        "amount": payment.amount,
        "currency": payment.currency,
        "mode": payment.mode,
        "paymentMethod": payment.payment_method,
        "provider": payment.provider or None,
        "status": payment.status,
        "isTest": payment.is_test,
        "gatewayUrl": payment.gateway_url or None,
        "createdAt": payment.created_at.isoformat(),
        "updatedAt": payment.updated_at.isoformat(),
    }
    if idempotent:
        result["idempotent"] = True
    if provider_checked is not None:
        result["providerChecked"] = provider_checked
    return result


def _paiements_visibles(user):
    queryset = KPayPayment.objects.all()
    if getattr(user, "is_superuser", False):
        return queryset
    hotel_id = getattr(user, "hotel_id", None)
    if hotel_id:
        return queryset.filter(hotel_id=hotel_id)
    return queryset.filter(created_by=user)


def _gateway_url_sure(value):
    parsed = urlparse(str(value or ""))
    host = (parsed.hostname or "").lower()
    trusted = (
        host == "kpay.site" or host.endswith(".kpay.site")
        or host == "kpay.cm" or host.endswith(".kpay.cm")
        or host == "k-pay.app" or host.endswith(".k-pay.app")
    )
    return value if parsed.scheme == "https" and parsed.netloc and trusted else ""


def _payload_initialisation(attrs, external_id):
    description = attrs.get("description") or "Paiement Hypnos"
    payload = {
        "amount": attrs["amount"],
        "currency": attrs["currency"],
        "externalId": external_id,
        "description": description,
    }
    if attrs["mode"] == KPayPayment.Mode.USSD:
        payload.update({
            "provider": attrs["provider"],
            "phoneNumber": attrs["phoneNumber"],
        })
    else:
        if not getattr(settings, "KPAY_GATEWAY_SECRET", "").strip():
            raise KPayConfigurationError("KPAY_GATEWAY_SECRET est requis pour le retour signé du checkout.")
        return_url = _public_url("kpay-return")
        payload["returnUrl"] = return_url
        payload["successUrl"] = return_url
        payload["cancelUrl"] = return_url
        if attrs.get("paymentMethod") == "CARD":
            payload["paymentMethod"] = "CARD"
    if attrs.get("customerName"):
        payload["customerName"] = attrs["customerName"]
    if attrs.get("customerEmail"):
        payload["customerEmail"] = attrs["customerEmail"]
    if attrs.get("metadata"):
        payload["metadata"] = attrs["metadata"]
    return payload, description


def _get_callback_data(body):
    nested = body.get("data")
    return nested if isinstance(nested, dict) else body


class KPayInitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KPayPaymentInitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attrs = serializer.validated_data

        try:
            config = verifier_configuration_kpay()
            payload, description = _payload_initialisation(attrs, attrs.get("externalId") or "")
        except KPayConfigurationError as error:
            return Response({"detail": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        external_id = attrs.get("externalId") or f"HYP-{uuid.uuid4().hex}"
        payload["externalId"] = external_id
        existing = _paiements_visibles(request.user).filter(external_id=external_id).first()
        if existing:
            return Response(_payment_response(existing, idempotent=True), status=status.HTTP_200_OK)
        if KPayPayment.objects.filter(external_id=external_id).exists():
            return Response({"detail": "Cet externalId appartient déjà à un autre compte."}, status=409)

        payment = KPayPayment(
            external_id=external_id,
            created_by=request.user,
            hotel_id=getattr(request.user, "hotel_id", None),
            amount=attrs["amount"],
            currency=attrs["currency"],
            mode=attrs["mode"],
            payment_method=attrs["paymentMethod"],
            provider=attrs.get("provider", ""),
            phone_number=attrs.get("phoneNumber", ""),
            customer_name=attrs.get("customerName", ""),
            customer_email=attrs.get("customerEmail", ""),
            description=description,
            metadata=attrs.get("metadata", {}),
            is_test=config["is_test"],
        )
        try:
            with transaction.atomic():
                payment.save(force_insert=True)
        except IntegrityError:
            existing = _paiements_visibles(request.user).filter(external_id=external_id).first()
            if existing:
                return Response(_payment_response(existing, idempotent=True), status=200)
            return Response({"detail": "Cet externalId appartient déjà à un autre compte."}, status=409)

        try:
            data = kpay_api_request("POST", "/api/v1/payments/init", payload)
            if "isTest" not in data or (config["is_test"] and data.get("isTest") is not True):
                payment.status = KPayPayment.Status.INITIATION_UNKNOWN
                payment.failure_reason = "Impossible de confirmer que la réponse KPay est sandbox."
                payment.save(update_fields=["status", "failure_reason", "updated_at"])
                return Response(
                    {"detail": "KPay n’a pas confirmé l’environnement sandbox; aucun lien de paiement n’a été retourné.",
                     **_payment_response(payment)},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            _appliquer_reponse_kpay(payment, data)
            if attrs["mode"] == KPayPayment.Mode.GATEWAY:
                gateway_url = _gateway_url_sure(data.get("gatewayUrl"))
                if not gateway_url:
                    payment.status = KPayPayment.Status.INITIATION_UNKNOWN
                    payment.gateway_url = ""
                    payment.failure_reason = "URL de paiement KPay absente ou domaine non autorisé."
                    payment.save(update_fields=["status", "gateway_url", "failure_reason", "updated_at"])
                    return Response(
                        {"detail": "Réponse KPay sans URL de paiement hébergée approuvée.", **_payment_response(payment)},
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
                payment.gateway_url = gateway_url
                payment.save(update_fields=["gateway_url", "updated_at"])
        except KPayAPIError as error:
            payment.status = (
                KPayPayment.Status.FAILED
                if error.status_code and 400 <= error.status_code < 500
                else KPayPayment.Status.INITIATION_UNKNOWN
            )
            payment.failure_reason = str(error)[:2000]
            payment.save(update_fields=["status", "failure_reason", "updated_at"])
            return Response(
                {"detail": str(error), **_payment_response(payment)},
                status=status.HTTP_502_BAD_GATEWAY if error.status_code else status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(_payment_response(payment), status=status.HTTP_201_CREATED)


class KPayWebhookView(APIView):
    """Callback public KPay : HMAC vérifié sur les octets JSON bruts."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        secret = getattr(settings, "KPAY_WEBHOOK_SECRET", "").strip()
        if not secret:
            return Response({"detail": "Webhook KPay non configuré."}, status=503)
        signature = request.headers.get("X-KPAY-Signature", "").strip()
        if signature.startswith("sha256="):
            signature = signature[7:]
        expected = hmac.new(secret.encode("utf-8"), request.body, hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(signature.lower(), expected):
            return Response({"detail": "Signature KPay invalide."}, status=400)
        try:
            body = json.loads(request.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return Response({"detail": "Corps JSON invalide."}, status=400)
        if not isinstance(body, dict):
            return Response({"detail": "Corps JSON invalide."}, status=400)

        event = request.headers.get("X-KPAY-Event", "") or body.get("event", "")
        body_event = body.get("event")
        if body_event and event and body_event != event:
            return Response({"detail": "Événement KPay incohérent."}, status=400)
        event = str(event).lower()
        target_status = WEBHOOK_EVENT_STATUS.get(event)
        if not target_status:
            return Response({"received": True, "processed": False, "reason": "Événement ignoré."}, status=200)

        data = _get_callback_data(body)
        external_id = data.get("externalId") or data.get("external_id")
        if not external_id:
            return Response({"detail": "externalId absent du webhook."}, status=400)
        with transaction.atomic():
            payment = KPayPayment.objects.select_for_update().filter(external_id=str(external_id)).first()
            if not payment:
                logger.error("Webhook KPay signé pour un paiement inconnu: %s", external_id)
                return Response({"detail": "Paiement local introuvable."}, status=404)
            if "amount" in data:
                try:
                    if Decimal(str(data["amount"])) != Decimal(payment.amount):
                        return Response({"detail": "Montant du webhook différent du paiement local."}, status=400)
                except (InvalidOperation, TypeError, ValueError):
                    return Response({"detail": "Montant du webhook invalide."}, status=400)
            _appliquer_reponse_kpay(payment, data, event_status=target_status)
        return Response({"received": True, "processed": True, "externalId": str(external_id), "status": payment.status}, status=200)


class KPayReturnView(APIView):
    """Retour de navigateur signé; informatif uniquement, sans transition d'état."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        secret = getattr(settings, "KPAY_GATEWAY_SECRET", "").strip()
        if not secret:
            return Response({"detail": "Retour KPay non configuré."}, status=503)
        status_value = request.query_params.get("status", "")
        reference = request.query_params.get("reference", "")
        external_id = request.query_params.get("externalId", "")
        timestamp = request.query_params.get("ts", "")
        signature = request.query_params.get("sig", "")
        try:
            timestamp_ms = int(timestamp)
        except (TypeError, ValueError):
            return Response({"detail": "Horodatage de retour invalide."}, status=400)
        if abs(int(time.time() * 1000) - timestamp_ms) > 10 * 60 * 1000:
            return Response({"detail": "Retour KPay expiré."}, status=400)
        message = "|".join((status_value, reference, external_id, timestamp))
        expected = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()
        if not signature or not hmac.compare_digest(signature.lower(), expected):
            return Response({"detail": "Signature du retour KPay invalide."}, status=400)
        payment = KPayPayment.objects.filter(external_id=external_id).first()
        # Ne jamais transformer status_value en statut payé ici : seul le
        # webhook authentifié et traité ci-dessus peut établir le statut final.
        return Response({
            "verified": True,
            "returnedStatus": status_value,
            "externalId": external_id,
            "reference": reference,
            "paymentStatus": payment.status if payment else None,
            "message": "Retour vérifié. Le statut définitif est confirmé par le webhook KPay.",
        }, status=200)


class KPayStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, external_id):
        payment = _paiements_visibles(request.user).filter(external_id=external_id).first()
        if not payment:
            return Response({"detail": "Paiement introuvable."}, status=404)
        checked = False
        if payment.kpay_id:
            try:
                data = kpay_api_request("GET", chemin_statut_kpay(payment.kpay_id))
                _appliquer_reponse_kpay(payment, data)
                checked = True
            except (KPayAPIError, KPayConfigurationError) as error:
                logger.warning("Lecture du statut KPay impossible pour %s: %s", external_id, error)
        return Response(_payment_response(payment, provider_checked=checked), status=200)
