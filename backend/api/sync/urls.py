"""
URLs de l'application `sync`.

Branchees dans config/urls.py sous `/api/sync/`.

    GET  demandes/                     file des demandes en attente
    GET  demandes/<num>/propositions/  3 chambres libres alternatives
    POST demandes/<num>/valider/       l'agent accepte (chambre) ou refuse (motif)

Les URLs suivent l'objet `Demande` et non `Reservation` : une demande n'existe
que tant qu'elle n'a pas ete traitee, et c'est elle que l'agent manipule.

Chaque vue exige un compte actif (permission `HypnosPermission`) et ne traite
que l'hotel du compte : un agent de l'hotel A ne voit ni ne peut valider la
file de l'hotel B.
"""

from django.urls import path

from .views import FileAttenteView, PropositionsView, ValiderDemandeView

app_name = "sync"

urlpatterns = [
    path("demandes/", FileAttenteView.as_view(), name="demandes"),
    path(
        "demandes/<int:num>/propositions/",
        PropositionsView.as_view(),
        name="propositions",
    ),
    path(
        "demandes/<int:num>/valider/",
        ValiderDemandeView.as_view(),
        name="valider",
    ),
]