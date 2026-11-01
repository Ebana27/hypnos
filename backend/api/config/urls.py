"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

# Vues des pages HTML servies par Django (accueil, apercu et page 404). Elles
# sont ecrites dans l'application `main`, mais routees ici : ce fichier est le
# seul a pouvoir repondre sur la racine `/`, `main.urls` etant inclus sous le
# prefixe `api/`.
from main.views import HomeView, preview_404, unknown_url

# Import des vues pour les tokens d'authentification
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)


urlpatterns = [
    path('admin/', admin.site.urls),

    # Page d'accueil : `/` ne doit plus tomber sur une 404.
    path('', HomeView.as_view(), name='home'),
    # Rendu de la page 404 sans avoir a se tromper d'URL.
    path('404-preview/', preview_404, name='404-preview'),

    # Routes pour les tokens d'authentification (JWT)
    # POST /api/token/ : Obtenir un token (Login)
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # POST /api/token/refresh/ : Rafraîchir le token d'accès
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # POST /api/token/verify/ : Vérifier la validité d'un token
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),

    # ------------------------------------------------------
    #   URL DES APPLICATIONS
    # ------------------------------------------------------
    # `main.urls` est declare une seule fois ici : il expose /api/notifications/.
    path('api/', include('accounts.urls')),
    # Pages allauth (connexion, mot de passe oublie) : declarees ici et non
    # dans accounts.urls, car un `include` dans un module avec app_name
    # enfermerait ces routes dans le namespace "accounts" et leurs templates
    # feraient echouer reverse("account_login") avec un NoReverseMatch.
    path('api/auth/', include('allauth.urls')),
    path('api/', include('hotels.urls')),
    path('api/', include('main.urls')),
    path('api/', include('reservations.urls')),
    # Synchronisation : file d'attente des demandes, propositions de chambres
    # et validation par l'agent. Le perimetre (demandes / reservations) est
    # explique dans sync/urls.py.
    path('api/sync/', include('sync.urls')),

    # DERNIERE ROUTE, A NE PAS DEPLACER.
    # Toute URL qui n'a pas ete reconnue arrive ici et est rendue par la page
    # 404.html (ou du JSON sous /api/), meme avec DEBUG=True. Sans elle, Django
    # afficherait sa page technique car il ignore handler404 des que DEBUG est
    # actif. Elle doit rester apres toutes les autres : `<path:...>` avale tout
    # ce qui reste.
    path('<path:unknown>', unknown_url, name='not-found'),
]

# Filet de securite : si une vue leve Http404 alors que la route fourre-tout
# n'a pas ete atteinte, c'est quand meme la page Hypnos qui est servie.
handler404 = "main.views.not_found"
