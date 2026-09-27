from django.contrib import admin

from reservations.models import Client, Reservation


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ("id_client", "nom", "prenom", "email", "tel", "loyalty")
    # `loyalty` est un BooleanField : filtrer dessus revient a cocher
    # "clients fidèles uniquement" dans la liste.
    list_filter = ("loyalty", "sexe")
    search_fields = ("nom", "prenom", "email", "tel", "document")
    ordering = ("nom", "prenom")


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ("num", "client", "chambre", "date_debut", "date_fin", "statut", "nombreDePersonne")
    list_filter = ("statut", "chambre__hotel", "date_debut")
    search_fields = ("num", "client__nom", "client__prenom", "chambre__numero")
    # Tri par date de depart : l'agent voit d'abord ce qui arrive.
    ordering = ("-date_debut",)
    date_hierarchy = "date_debut"
    # Permet de filtrer la liste par jour / semaine / mois sur date_debut.
    list_select_related = ("client", "chambre")
