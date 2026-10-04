"""
URLs de l'application `reservations` (clients et reservations).

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/reservations/", include("reservations.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, DemandeViewSet, ReservationViewSet

app_name = "reservations"

router = DefaultRouter()

router.register(r'clients', ClientViewSet, basename='client')
router.register(r'demandes', DemandeViewSet, basename='demande')
router.register(r'reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path("", include(router.urls)),
]