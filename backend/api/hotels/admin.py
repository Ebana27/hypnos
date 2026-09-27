from django.contrib import admin

from hotels.models import Chambre, Hotel, Personnel, TypeDeChambre


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = ("hotel_id", "name", "ville", "tel", "nombre_etages", "nombre_chambres")
    search_fields = ("name", "ville", "adresse")
    list_filter = ("ville",)
    ordering = ("name",)


@admin.register(TypeDeChambre)
class TypeDeChambreAdmin(admin.ModelAdmin):
    list_display = ("id_type", "label", "prix", "capacite")
    search_fields = ("label",)
    ordering = ("label",)


@admin.register(Chambre)
class ChambreAdmin(admin.ModelAdmin):
    # Liste des chambres par hotel : c'est la navigation la plus utilisee.
    list_display = ("id_chambre", "numero", "hotel", "type_chambre", "etage", "statut")
    list_filter = ("statut", "hotel", "type_chambre")
    # Recherche par numero : le client le cherche par ce critere.
    search_fields = ("numero", "hotel__name")
    ordering = ("hotel__name", "numero")
    autocomplete_fields = ("hotel", "type_chambre")


@admin.register(Personnel)
class PersonnelAdmin(admin.ModelAdmin):
    list_display = ("matricule", "nom", "prenom", "poste", "hotel", "user")
    list_filter = ("hotel", "sexe", "poste")
    search_fields = ("nom", "prenom", "poste", "user__username")
    ordering = ("nom", "prenom")
