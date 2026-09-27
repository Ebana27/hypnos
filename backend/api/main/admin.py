from django.contrib import admin

from main.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("id_notif", "title", "user", "lu", "created_at")
    # `lu` est le filtre principal : l'agent veut "mes non-lus".
    list_filter = ("lu", "created_at")
    search_fields = ("title", "detail", "user__username")
    # Tri par plus recent en tete.
    ordering = ("-created_at",)
    list_select_related = ("user",)
    # Champs non modifiables : une notification deja envoyee ne se rejoue pas.
    readonly_fields = ("created_at",)
