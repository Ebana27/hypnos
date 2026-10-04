from django.contrib import admin

from reservations.models import Client, Demande, Reservation


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id_client", "nom", "prenom", "email", "tel", "loyalty")
    # `loyalty` est un BooleanField : filtrer dessus revient a cocher
    # "clients fidèles uniquement" dans la liste.
    list_filter = ("loyalty", "sexe")
    search_fields = ("nom", "prenom", "email", "tel", "document")
    ordering = ("nom", "prenom")


@admin.register(Demande)
class DemandeAdmin(admin.ModelAdmin):
    # File d'attente de l'agent : la vue la plus consultee du back-office.
    # `date_debut` / `date_fin` sont des instants : l'heure du check-in et
    # du check-out de l'hotel s'y ajoutent, et `nombre_de_nuits` donne la
    # duree d'un coup d'oeil.
    list_display = (
        "num", "client", "hotel", "chambre_demandee", "date_debut",
        "date_fin", "nombre_de_nuits", "nombreDePersonne", "statut",
        "date_decision",
    )
    list_filter = ("statut", "hotel", "date_debut")
    search_fields = ("num", "client__nom", "client__prenom", "chambre_demandee__numero")
    # Tri par date de depart : l'agent voit d'abord ce qui arrive.
    ordering = ("date_debut",)
    date_hierarchy = "date_debut"
    list_select_related = ("client", "chambre_demandee", "hotel")
    readonly_fields = ("created_at", "updated_at", "nombre_de_nuits")


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = (
        "num", "client", "chambre", "hotel", "date_debut", "date_fin",
        "nombre_de_nuits", "statut", "nombreDePersonne", "demande",
    )
    list_filter = ("statut", "hotel", "date_debut")
    search_fields = ("num", "client__nom", "client__prenom", "chambre__numero")
    # Tri par date de depart : l'agent voit d'abord ce qui arrive.
    ordering = ("-date_debut",)
    date_hierarchy = "date_debut"
    # Permet de filtrer la liste par jour / semaine / mois sur date_debut.
    list_select_related = ("client", "chambre", "hotel", "demande")
    readonly_fields = ("created_at", "updated_at", "nombre_de_nuits")
