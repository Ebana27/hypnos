"""
URLs de l'application `reservations` (clients et reservations).

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/reservations/", include("reservations.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path

app_name = "reservations"

urlpatterns = [
    # Les vues DRF se declarent ici, par exemple :
    # path("disponibilite/", DisponibiliteView.as_view(), name="disponibilite"),
]
