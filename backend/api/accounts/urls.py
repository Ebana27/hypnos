"""
URLs de l'application `accounts` (authentification).

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/auth/", include("accounts.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path

app_name = "accounts"

urlpatterns = [
    # Les vues DRF de l'accounts se declarent ici, par exemple :
    # path("me/", MeView.as_view(), name="me"),
]
