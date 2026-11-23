import hashlib
import hmac
import json
import time
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import KPayPayment


@override_settings(
    KPAY_API_KEY="kpay_test_demo",
    KPAY_SECRET_KEY="test-secret",
    KPAY_WEBHOOK_SECRET="webhook-secret",
    KPAY_GATEWAY_SECRET="gateway-secret",
    KPAY_BASE_URL="https://admin.kpay.site",
    KPAY_PUBLIC_BASE_URL="https://api.hypnos.example",
    KPAY_ALLOW_LIVE_PAYMENTS=False,
)
class KPayIntegrationTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_superuser(
            username="kpay-test-admin",
            email="kpay-test@example.invalid",
            password="not-a-real-password-123",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @staticmethod
    def _gateway_response():
        return {
            "id": "kp_test_payment_001",
            "reference": "KPAY-TEST-001",
            "status": "PENDING",
            "isTest": True,
            "gatewayUrl": "https://pay.kpay.cm/pay/kp_test_payment_001",
        }

    def test_gateway_card_payment_returns_approved_sandbox_url(self):
        payload = {
            "mode": "GATEWAY",
            "paymentMethod": "CARD",
            "amount": 1000,
            "currency": "XAF",
            "externalId": "hypnos-card-001",
            "description": "Réservation de test",
        }
        with patch("payments.kpay_views.kpay_api_request", return_value=self._gateway_response()) as api:
            response = self.client.post("/api/payments/kpay/init/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(response.data["isTest"])
        self.assertEqual(response.data["status"], KPayPayment.Status.PENDING)
        self.assertEqual(response.data["gatewayUrl"], self._gateway_response()["gatewayUrl"])
        sent_payload = api.call_args.args[2]
        self.assertEqual(sent_payload["paymentMethod"], "CARD")
        self.assertEqual(sent_payload["returnUrl"], "https://api.hypnos.example/api/payments/kpay/return/")
        self.assertEqual(KPayPayment.objects.get(external_id="hypnos-card-001").status, "PENDING")

    def test_ussd_mobile_money_payload_normalizes_congo_phone(self):
        payload = {
            "mode": "USSD",
            "amount": 500,
            "currency": "XAF",
            "externalId": "hypnos-momo-001",
            "provider": "MTN_MOMO_COG",
            "phoneNumber": "+242 06 123 45 67",
        }
        with patch("payments.kpay_views.kpay_api_request", return_value={
            "id": "kp_test_momo_001", "reference": "KPAY-MOMO-001",
            "status": "PENDING", "isTest": True,
        }) as api:
            response = self.client.post("/api/payments/kpay/init/", payload, format="json")

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(api.call_args.args[2]["provider"], "MTN_MOMO_COG")
        self.assertEqual(api.call_args.args[2]["phoneNumber"], "242061234567")
        self.assertNotIn("returnUrl", api.call_args.args[2])

    def test_external_id_is_idempotent_and_does_not_start_second_payment(self):
        payload = {
            "mode": "GATEWAY", "paymentMethod": "CARD", "amount": 1000,
            "currency": "XAF", "externalId": "hypnos-idempotent-001",
            "description": "Test idempotence",
        }
        with patch("payments.kpay_views.kpay_api_request", return_value=self._gateway_response()) as api:
            first = self.client.post("/api/payments/kpay/init/", payload, format="json")
            second = self.client.post("/api/payments/kpay/init/", payload, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.data["idempotent"])
        self.assertEqual(api.call_count, 1)
        self.assertEqual(KPayPayment.objects.filter(external_id="hypnos-idempotent-001").count(), 1)

    def test_live_key_is_rejected_without_explicit_opt_in(self):
        payload = {
            "mode": "USSD", "amount": 500, "currency": "XAF",
            "externalId": "hypnos-live-blocked", "provider": "AIRTEL_COG",
            "phoneNumber": "061234567",
        }
        with override_settings(KPAY_API_KEY="kpay_live_not-for-tests", KPAY_ALLOW_LIVE_PAYMENTS=False):
            with patch("payments.kpay_views.kpay_api_request") as api:
                response = self.client.post("/api/payments/kpay/init/", payload, format="json")
        self.assertEqual(response.status_code, 503)
        api.assert_not_called()
        self.assertFalse(KPayPayment.objects.filter(external_id="hypnos-live-blocked").exists())

    def _post_signed_webhook(self, body, event="payment.completed", secret="webhook-secret"):
        raw = json.dumps(body, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
        return self.client.generic(
            "POST",
            "/api/payments/kpay/webhook/",
            raw,
            content_type="application/json",
            HTTP_X_KPAY_SIGNATURE=signature,
            HTTP_X_KPAY_EVENT=event,
        )

    def test_signed_webhook_completes_payment_idempotently(self):
        payment = KPayPayment.objects.create(
            external_id="hypnos-webhook-001", created_by=self.user, amount=1000,
            currency="XAF", mode="GATEWAY", payment_method="CARD", is_test=True,
        )
        body = {
            "event": "payment.completed",
            "data": {"externalId": payment.external_id, "id": "kp_webhook_001", "amount": 1000, "reference": "KPAY-WEBHOOK-1"},
        }
        first = self._post_signed_webhook(body)
        second = self._post_signed_webhook(body)
        payment.refresh_from_db()
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(payment.status, KPayPayment.Status.COMPLETED)
        self.assertEqual(payment.kpay_id, "kp_webhook_001")

    def test_invalid_webhook_signature_is_rejected(self):
        body = {"event": "payment.completed", "data": {"externalId": "missing"}}
        response = self._post_signed_webhook(body, secret="wrong-secret")
        self.assertEqual(response.status_code, 400)

    def test_signed_browser_return_does_not_mark_payment_complete(self):
        payment = KPayPayment.objects.create(
            external_id="hypnos-return-001", created_by=self.user, amount=1000,
            currency="XAF", mode="GATEWAY", payment_method="CARD",
            status=KPayPayment.Status.PENDING,
        )
        timestamp = str(int(time.time() * 1000))
        message = "|".join(("COMPLETED", "KPAY-RETURN-1", payment.external_id, timestamp))
        signature = hmac.new(b"gateway-secret", message.encode("utf-8"), hashlib.sha256).hexdigest()
        response = self.client.get("/api/payments/kpay/return/", {
            "status": "COMPLETED", "reference": "KPAY-RETURN-1",
            "externalId": payment.external_id, "ts": timestamp, "sig": signature,
        })
        payment.refresh_from_db()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["paymentStatus"], KPayPayment.Status.PENDING)
        self.assertEqual(payment.status, KPayPayment.Status.PENDING)

    def test_anonymous_client_cannot_initiate_a_payment(self):
        anonymous = APIClient()
        response = anonymous.post("/api/payments/kpay/init/", {"mode": "USSD", "amount": 1}, format="json")
        self.assertEqual(response.status_code, 401)
