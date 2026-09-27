"""
URLs de l'application `hotels` (hotels, types de chambre, chambres, personnel).

Pour rendre ces routes accessibles, ajouter dans config/urls.py :

    path("api/hotels/", include("hotels.urls")),

Non ajoute volontairement : le routage n'est pas dans le perimetre de la
creation des applications.
"""

from django.urls import path

app_name = "hotels"

urlpatterns = [
    # Les vues DRF se declarent ici, par exemple :
    # path("<int:hotel_id>/", HotelDetailView.as_view(), name="detail"),
]
