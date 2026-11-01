"""
URLs de l'application `hotels` (hotels, types de chambre, chambres, personnel).

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/hotels/", include("hotels.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HotelViewSet, TypeDeChambreViewSet, ChambreViewSet, PersonnelViewSet

app_name = "hotels"

# 1. On crée le routeur générique de DRF.
# trailing_slash vaut True par défaut (cf. accounts/urls.py pour pourquoi).
router = DefaultRouter()

# 2. On enregistre le ViewSet.
# Cela va créer automatiquement les routes :
# - GET /api/hotels/ (Pour lister les hôtels)
# - POST /api/hotels/ (Pour créer un hôtel)
# - GET /api/hotels/<id>/ (Pour voir un hôtel spécifique)
# - PUT/PATCH /api/hotels/<id>/ (Pour modifier)
# - DELETE /api/hotels/<id>/ (Pour supprimer)
# -----------------------------------------------------------
# Cette logique est prépondérente pour chaque route Ex : Remplacer hotels par personnels. 
# - GET /api/personnels/ (Pour lister les membres du personnel)
router.register(r'hotels', HotelViewSet, basename='hotel')
router.register(r'types-chambre', TypeDeChambreViewSet, basename='types-chambre')
router.register(r'chambres', ChambreViewSet, basename='chambre')
router.register(r'personnels', PersonnelViewSet, basename='personnel')

urlpatterns = [
    # 3. On inclut toutes les URLs générées par le routeur
    path("", include(router.urls)),
]
