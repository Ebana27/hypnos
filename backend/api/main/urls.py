"""
URLs de l'application `main`.

`main` ne detient aucun modele metier propre a un domaine : ses URLs servent
de point de rallie pour regrouper les routes transverses.

Ce fichier est inclus SOUS le prefixe `api/` (voir config/urls.py), donc une
route `''` y repondrait sur /api/ -- et serait de toute facon masquee par la
racine du DefaultRouter, qui matche deja `^$`. La page d'accueil (`/`), la
route d'apercu et le handler 404 sont donc declares dans config/urls.py, qui
est le seul fichier a exprimer le prefixe racine.

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/", include("main.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotifViewSet

app_name = "main"

router = DefaultRouter()

router.register(r'notifications', NotifViewSet, basename='notif')

urlpatterns = [
    path("", include(router.urls)),
]
