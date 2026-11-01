from django.contrib import admin

from hotels.models import Chambre, Hotel, Personnel, TypeDeChambre


@admin.register(Hotel)
class HotelAdmin(admin.ModelAdmin):
    list_display = (
        "hotel_id", "nom", "ville", "tel", "nombre_etages", "nombre_chambres",
        "heure_arrivee", "heure_depart",
    )
    search_fields = ("nom", "ville", "adresse")
    list_filter = ("ville",)
    ordering = ("nom",)
    # `heure_arrivee` / `heure_depart` ne sont pas dans `list_display` avant
    # cette version : elles sont regables ici, et servent de valeur par
    # defaut des reservations de cet etablissement (voir reservations).
    fieldsets = (
        (None, {"fields": (
            "nom", "adresse", "ville", "tel", "email",
            "nombre_etages", "nombre_chambres",
        )}),
        ("Heures de reference", {"fields": ("heure_arrivee", "heure_depart")}),
    )


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
    search_fields = ("numero", "hotel__nom")
    ordering = ("hotel__nom", "numero")
    autocomplete_fields = ("hotel", "type_chambre")


@admin.register(Personnel)
class PersonnelAdmin(admin.ModelAdmin):
    # `hotel`, `nom` et `prenom` sont des proprietes lues via `user`.
    # Elles marchent en affichage et en recherche, mais PAS en list_filter
    # ni en ordering : l'admin exige de vrais champs de base, donc on
    # traverse la relation `user__...`.
    list_display = ("matricule", "nom", "prenom", "poste", "hotel", "sexe", "user")
    list_filter = ("sexe", "poste", "user__hotel")
    search_fields = ("user__last_name", "user__first_name", "poste", "user__username")
    ordering = ("user__last_name", "user__first_name")
    autocomplete_fields = ("user",)
