"""
Quotas de l'API.

Pourquoi : `POST /api/demandes/` est la seule ecriture accessible a un
visiteur qui n'a pas de compte. Sans quota, un script pourrait remplir la
table `demande` (et, a chaque appel, une ligne de `client`) en quelques
minutes, depuis n'importe quelle adresse IP.

Les quotas sont volontairement stricts sur l'anonyme et larges sur les
comptes authentifies : le logiciel de l'agent interroge l'API en boucle
pendant sa journee de travail, un hotel de 80 chambres traite largement plus
de 20 demandes par heure, et 20/h le bloquerait.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

# Les valeurs vivent dans `config/settings.py`
# (DEFAULT_THROTTLE_RATES). Elles ne sont pas importees ici : le module
# `config.throttle` ne doit jamais etre importe depuis settings.py, sinon DRF
# lit `settings.REST_FRAMEWORK` avant sa definition et perd le JWT.
# Voir le commentaire de QUOTA_ANONYME dans settings.py.


class DemandePubliqueThrottle(AnonRateThrottle):
    """Un seul quota pour le POST public, sans dependre du reste du site."""

    scope = "demande_publique"


class CompteRateThrottle(UserRateThrottle):
    scope = "compte"