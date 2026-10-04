from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import redirect, render
from django.urls import resolve
from django.views.generic import TemplateView
from django.views.decorators.http import require_GET
from rest_framework.viewsets import ModelViewSet

from .models import Notification
from .serializers import NotifSerializer


class NotifViewSet(ModelViewSet):
    queryset = Notification.objects.order_by("id_notif")
    serializer_class = NotifSerializer


class HomeView(TemplateView):
    """
    Page d'accueil servie sur / (routee dans config/urls.py).

    Les templates sont dans main/templates/ et sont donc designs par leur nom
    court : APP_DIRS cherche <app>/templates/<nom>. Un template 404.html doit
    IMPERATIVEMENT etre a la racine d'un dossier de templates, sinon le
    handler404 de Django ne le trouve pas.
    """

    template_name = "index.html"


# Prefixe des routes d'API : un client (site, Electron, Postman) qui se trompe
# attend du JSON, pas d'une page HTML.
API_PREFIX = "/api/"


def not_found(request, exception):
    """
    handler404, cable dans config/urls.py.

    Django n'appelle ce handler que si DEBUG=False (cf.
    django.core.handlers.exception.response_for_exception, qui renvoie
    technical_404_response tant que DEBUG est actif). En developpement, c'est
    donc la route fourre-tout `unknown_url` qui rend la page.
    """
    if request.path.startswith(API_PREFIX):
        return JsonResponse(
            {"detail": "Ressource introuvable.", "path": request.path},
            status=404,
        )
    return render(request, "404.html", status=404)


def unknown_url(request, unknown=""):
    """
    Derniere route du projet (cf. config/urls.py) : rattrape les URL inconnues
    pour servir la page Hypnos meme avec DEBUG=True.

    Un middleware ne pourrait pas faire ce travail : Django enveloppe CHAQUE
    middleware avec convert_exception_to_response, donc le Http404 du routeur
    est deja transforme en page technique avant d'atteindre le middleware
    suivant. Seul un middleware d'exceptionne peut ; il faudrait alors
    reconnaitre la page technique de Django dans la reponse, ce qui est fragile.
    Une route fourre-tout est donc plus simple et plus explicite.
    """
    if settings.DEBUG and not settings.CUSTOM_404_IN_DEBUG:
        # On rend la main a Django : la page technique listant les motifs
        # testes est plus utile quand on ecrit une URL.
        raise Http404(f"Aucune URL ne correspond a {request.path!r}.")

    reponse = _rediriger_si_il_manque_la_barre(request)
    if reponse is not None:
        return reponse
    return not_found(request, Http404())


def _barre_finale_manquante(request):
    """
    L'URL demandee est la version sans barre finale d'une route qui existe.

    Le routeur fourre-tout ci-dessus absorbe `/api/users` avant que Django
    n'ait pu rediriger vers `/api/users/`. APPEND_SLASH ne joue plus, et
    l'API repond 404 au lieu de 301.

    C'est le symptome rencontre dans Postman : le client voit un 404 sur une
    route qui existe, et un client qui suit le 301 rejoue la requete en GET et
    perd le corps JSON. On redirige donc nous-memes, mais uniquement si la
    version avec la barre repond a une VRAIE route, pas si elle retombe sur la
    route fourre-tout : `/inexistant/` doit rester une 404, pas une boucle de
    redirections.
    """
    if request.method not in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        return None
    if request.path.endswith("/"):
        return None

    with_slash = request.path + "/"
    try:
        match = resolve(with_slash)
    except Http404:
        return None

    # `unknown_url` est le nom de la route fourre-tout : si c'est elle qui
    # repond, la barre finale n'existe pas et le 404 est la bonne reponse.
    if match.url_name == "not-found":
        return None
    return with_slash


def _rediriger_si_il_manque_la_barre(request):
    """Voir `_barre_finale_manquante`. Renvoie une reponse ou None."""
    destination = _barre_finale_manquante(request)
    if destination is None:
        return None
    # 301 comme le ferait APPEND_SLASH, dont on reprend donc exactement le
    # comportement attendu par les clients de l'API. Un client qui perd son
    # corps sur une redirection POST n'en est pas un : la vraie parade est
    # d'appeler la route avec sa barre finale.
    return redirect(destination, permanent=True)


@require_GET
def preview_404(request):
    """Apercu isole de la 404, utile pour la relire sans se tromper d'URL."""
    if not settings.DEBUG:
        raise Http404("L'apercu de la 404 n'existe qu'avec DEBUG=True.")
    return render(request, "404.html")