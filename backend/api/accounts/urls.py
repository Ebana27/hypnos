"""
URLs de l'application `accounts`.

`router` expose /api/users (liste et modification des comptes).

Les pages allauth (connexion, mot de passe oublie) sont declarees dans
config/urls.py, SANS namespace : allauth appelle reverse("account_login")
dans ses propres templates, et cet appel echouait avec un NoReverseMatch
tant que ses routes etaient cachees dans le namespace "accounts".
"""
# Imports nécessaires pour Django
from django.urls import include, path
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from .views import UserViewSet

app_name = "accounts"

# 1. On crée le routeur générique de DRF.
# `trailing_slash` garde sa valeur par défaut (True) : toutes les routes de
# l'API conservent leur barre finale (`/api/users/`). hotels, reservations et
# main n'ont jamais eu cet override ; cette incohérence seule faisait échouer
# 10 tests de permissions.
router = DefaultRouter()

# 2. On enregistre le ViewSet.
router.register(r'users', UserViewSet, basename='user')

# L'inscription en libre-service est desactivee : la regle metier impose un
# hotel pour chaque compte et le formulaire allauth ne sait pas le demander,
# donc un POST ici echouerait sur la contrainte `user_hotel_ou_superuser`.
# Les comptes se creent depuis /admin/ (formulaire "Hypnos" : role + hotel).
def inscription_desactivee(request):
    return JsonResponse(
        {"detail": "Inscription desactivee : creer le compte depuis /admin/."},
        status=405,
    )


urlpatterns = [
    path("", include(router.urls)),
    path("auth/signup/", inscription_desactivee, name="account_signup"),
]
