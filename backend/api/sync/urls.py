"""
URLs de l'application `sync`.

Ces routes ne sont PAS encore cablees dans config/urls.py (celui-ci est
reste dans son etat d'origine). Pour les activer, ajouter dans
config/urls.py :

    path("api/sync/", include("sync.urls")),

Les vues ne sont pas encore ecrites : `sync/services.py` contient toute la
logique metier et est teste directement dans `sync/tests.py`. Les endpoints
HTTP ne feront qu'appeler ces fonctions, ce qui evite de dupliquer les
regles de disponibilite.

Points d'entree a prevoir :

    GET  en-attente/          file des pseudo-reservations a valider
    GET  res/<num>/propositions/   3 chambres libres alternatives
    POST res/<num>/valider/    l'agent confirme (chambre) ou refuse (motif)

Chaque point d'entree doit :
    - exiger un JWT valide (JWT de simplejwt, deja configure dans
      config/settings.py) ;
    - reserver l'agent a son hotel via request.user.hotel, pour qu'un agent
      de l'hotel A ne puisse pas valider la file de l'hotel B.
"""

from django.urls import path

app_name = "sync"

urlpatterns = [
    # path("en-attente/", FileAttenteView.as_view(), name="en-attente"),
    # path("res/<int:num>/propositions/", PropositionsView.as_view(), name="propositions"),
    # path("res/<int:num>/valider/", ValiderView.as_view(), name="valider"),
]
