from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from accounts.models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin du compte technique.

    Herite de django.contrib.auth.admin.UserAdmin, qui fournit deja les
    formulaires de creation / modification et la gestion du mot de passe.
    Sans cet heritage, la page d'ajout d'utilisateur n'afficherait pas les
    champs de mot de passe et la verification d'unicite du username.
    """

    # colonnes affichees dans la liste des comptes
    list_display = (
        "id_user", "username", "email", "role", "hotel", "is_staff", "is_active",
    )
    list_filter = ("role", "hotel", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("username",)

    # On ajoute `role` et `hotel` au formulaire d'edition existant plutot
    # que de redefinir add_fieldsets, sinon le formulaire herite perd ses
    # champs. `hotel` est requis pour tout compte non-superadmin.
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Hypnos", {"fields": ("role", "hotel")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Hypnos", {"fields": ("email", "role", "hotel")}),
    )
