from django.contrib import admin

from sync.models import JournalSync, SyncCursor


@admin.register(SyncCursor)
class SyncCursorAdmin(admin.ModelAdmin):
    list_display = (
        "appareil", "hotel", "derniere_consultation", "nombre_appels", "mis_a_jour",
    )
    list_filter = ("hotel",)
    search_fields = ("appareil",)
    ordering = ("-mis_a_jour",)


@admin.register(JournalSync)
class JournalSyncAdmin(admin.ModelAdmin):
    list_display = ("horodatage", "action", "demande", "hotel", "appareil", "succes")
    list_filter = ("action", "succes", "hotel")
    search_fields = ("appareil", "detail")
    # Journal de diagnostic : on lit toujours du plus recent au plus ancien.
    ordering = ("-horodatage",)
    date_hierarchy = "horodatage"
    list_select_related = ("demande", "hotel")
    # Un journal ne se modifie pas a posteriori.
    readonly_fields = ("horodatage",)
