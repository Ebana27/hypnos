import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from django.conf import settings


class KPayConfigurationError(Exception):
    """Configuration absente ou environnement de paiement non autorisé."""


class KPayAPIError(Exception):
    def __init__(self, message, status_code=None, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


def verifier_configuration_kpay():
    api_key = getattr(settings, "KPAY_API_KEY", "").strip()
    secret_key = getattr(settings, "KPAY_SECRET_KEY", "").strip()
    webhook_secret = getattr(settings, "KPAY_WEBHOOK_SECRET", "").strip()
    base_url = getattr(settings, "KPAY_BASE_URL", "https://admin.kpay.site").rstrip("/")

    if not api_key or not secret_key:
        raise KPayConfigurationError("Les clés KPAY_API_KEY et KPAY_SECRET_KEY ne sont pas configurées.")
    if api_key.startswith("kpay_test_"):
        is_test = True
    elif api_key.startswith("kpay_live_"):
        if not getattr(settings, "KPAY_ALLOW_LIVE_PAYMENTS", False):
            raise KPayConfigurationError(
                "Les paiements réels sont désactivés. Configurez une clé kpay_test_ pour tester."
            )
        is_test = False
    else:
        raise KPayConfigurationError("La clé KPay doit commencer par kpay_test_ ou kpay_live_.")
    if not webhook_secret:
        raise KPayConfigurationError("KPAY_WEBHOOK_SECRET est requis pour vérifier les callbacks signés.")
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise KPayConfigurationError("KPAY_BASE_URL doit être une URL HTTPS valide.")
    return {"api_key": api_key, "secret_key": secret_key, "base_url": base_url, "is_test": is_test}


def kpay_api_request(method, path, payload=None):
    config = verifier_configuration_kpay()
    url = config["base_url"] + path
    headers = {
        "X-API-Key": config["api_key"],
        "X-Secret-Key": config["secret_key"],
        "Accept": "application/json",
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = Request(url, data=data, headers=headers, method=method.upper())
    timeout = getattr(settings, "KPAY_TIMEOUT_SECONDS", 15)

    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status_code = response.status
    except HTTPError as error:
        raw = error.read()
        try:
            detail = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            detail = {"message": "KPay a refusé la requête."}
        raise KPayAPIError(
            str(detail.get("message", "KPay a refusé la requête.")),
            status_code=error.code,
            payload=detail,
        ) from error
    except (URLError, TimeoutError, OSError) as error:
        raise KPayAPIError("KPay est momentanément injoignable; vérifiez le statut avant de réessayer.") from error

    if status_code >= 400:
        raise KPayAPIError("KPay a refusé la requête.", status_code=status_code)
    if not raw:
        return {}
    try:
        result = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise KPayAPIError("KPay a renvoyé une réponse JSON invalide.", status_code=status_code) from error
    if not isinstance(result, dict):
        raise KPayAPIError("KPay a renvoyé une réponse inattendue.", status_code=status_code)
    return result


def chemin_statut_kpay(payment_id):
    return "/api/v1/payments/{}".format(quote(str(payment_id), safe=""))
