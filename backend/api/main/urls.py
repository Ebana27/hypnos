"""
URLs de l'application `main`.

`main` ne detient aucun modele metier propre a un domaine : ses URLs servent
de point de rallie pour regrouper les routes transverses.

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/", include("main.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path

app_name = "main"

urlpatterns = [
    # Les vues DRF se declarent ici, par exemple :
    # path("notifications/", NotificationListView.as_view(), name="notifications"),
]
