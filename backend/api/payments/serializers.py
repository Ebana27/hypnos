import re

from rest_framework import serializers


PROVIDERS_COG = ("AIRTEL_COG", "MTN_MOMO_COG")
CURRENCIES_KPAY = ("CDF", "KES", "RWF", "SLE", "UGX", "USD", "XAF", "XOF", "ZMW")


def normaliser_numero_congo(value):
    """Formate un numéro COG au format international attendu par KPay (242…)."""
    chiffres = re.sub(r"\D", "", value)
    if chiffres.startswith("00"):
        chiffres = chiffres[2:]
    if not chiffres.startswith("242"):
        chiffres = "242" + chiffres
    if not chiffres.startswith("242") or len(chiffres) != 12:
        raise serializers.ValidationError(
            "Saisissez un numéro du Congo-Brazzaville au format +242XXXXXXXXX."
        )
    return chiffres


class KPayPaymentInitSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=("USSD", "GATEWAY"))
    amount = serializers.IntegerField(min_value=1)
    currency = serializers.ChoiceField(choices=CURRENCIES_KPAY, default="XAF")
    externalId = serializers.CharField(
        required=False,
        max_length=120,
    )
    paymentMethod = serializers.ChoiceField(
        choices=("AUTO", "CARD"), required=False, default="AUTO"
    )
    provider = serializers.ChoiceField(choices=PROVIDERS_COG, required=False)
    phoneNumber = serializers.CharField(required=False, max_length=32)
    description = serializers.CharField(required=False, allow_blank=False, max_length=200)
    customerName = serializers.CharField(required=False, allow_blank=True, max_length=160)
    customerEmail = serializers.EmailField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False, default=dict)

    def validate_externalId(self, value):
        if not re.fullmatch(r"[A-Za-z0-9._:-]+", value):
            raise serializers.ValidationError("L’identifiant externe contient des caractères non autorisés.")
        return value

    def validate(self, attrs):
        mode = attrs["mode"]
        if mode == "USSD":
            if not attrs.get("provider"):
                raise serializers.ValidationError({"provider": "Choisissez MTN ou Airtel pour le Congo."})
            if not attrs.get("phoneNumber"):
                raise serializers.ValidationError({"phoneNumber": "Le numéro Mobile Money est requis."})
            if attrs["currency"] != "XAF":
                raise serializers.ValidationError({"currency": "Les opérateurs du Congo règlent en XAF."})
            attrs["phoneNumber"] = normaliser_numero_congo(attrs["phoneNumber"])
            attrs["paymentMethod"] = "USSD"
        elif attrs.get("provider") or attrs.get("phoneNumber"):
            raise serializers.ValidationError(
                "En mode GATEWAY, laissez le choix de l’opérateur et du numéro au client sur la page KPay."
            )
        if attrs.get("paymentMethod") == "CARD" and not attrs.get("description"):
            raise serializers.ValidationError({"description": "Le libellé est requis pour un paiement par carte."})
        return attrs
