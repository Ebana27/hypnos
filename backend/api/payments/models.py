import uuid

from django.conf import settings
from django.db import models


class KPayPayment(models.Model):
    """Trace locale d'un pay-in KPay-NOW; seul le webhook signé fait foi."""

    class Status(models.TextChoices):
        CREATED = "CREATED", "Créé"
        PENDING = "PENDING", "En attente"
        PROCESSING = "PROCESSING", "En cours"
        COMPLETED = "COMPLETED", "Payé"
        FAILED = "FAILED", "Échoué"
        CANCELLED = "CANCELLED", "Annulé"
        INITIATION_UNKNOWN = "INITIATION_UNKNOWN", "Résultat d'initialisation inconnu"

    class Mode(models.TextChoices):
        USSD = "USSD", "Mobile Money USSD"
        GATEWAY = "GATEWAY", "Page de paiement hébergée"

    class PaymentMethod(models.TextChoices):
        USSD = "USSD", "Mobile Money USSD"
        AUTO = "AUTO", "Choix sur la page KPay"
        CARD = "CARD", "Carte bancaire"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    external_id = models.CharField(max_length=120, unique=True)
    kpay_id = models.CharField(max_length=128, blank=True, null=True, unique=True)
    reference = models.CharField(max_length=128, blank=True, null=True, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpay_payments",
    )
    hotel = models.ForeignKey(
        "hotels.Hotel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="kpay_payments",
    )
    amount = models.PositiveBigIntegerField()
    currency = models.CharField(max_length=3, default="XAF")
    mode = models.CharField(max_length=12, choices=Mode.choices)
    payment_method = models.CharField(
        max_length=12, choices=PaymentMethod.choices, default=PaymentMethod.AUTO
    )
    provider = models.CharField(max_length=32, blank=True)
    phone_number = models.CharField(max_length=24, blank=True)
    customer_name = models.CharField(max_length=160, blank=True)
    customer_email = models.EmailField(blank=True)
    description = models.CharField(max_length=200, blank=True)
    status = models.CharField(
        max_length=24, choices=Status.choices, default=Status.CREATED, db_index=True
    )
    gateway_url = models.URLField(max_length=2048, blank=True)
    is_test = models.BooleanField(default=True)
    failure_reason = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    provider_data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["hotel", "created_at"], name="kpay_hotel_created_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="kpay_amount_positive"),
        ]

    def __str__(self):
        return f"{self.external_id} — {self.status}"
