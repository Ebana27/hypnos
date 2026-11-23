from django.urls import path

from .kpay_views import KPayInitView, KPayReturnView, KPayStatusView, KPayWebhookView

urlpatterns = [
    path("init/", KPayInitView.as_view(), name="kpay-init"),
    path("webhook/", KPayWebhookView.as_view(), name="kpay-webhook"),
    path("return/", KPayReturnView.as_view(), name="kpay-return"),
    path("status/<str:external_id>/", KPayStatusView.as_view(), name="kpay-status"),
]
