from django.conf import settings
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import User
from .serializers import BootstrapSerializer, UserSerializer
from .permissions import (
    BlocageAutorise,
    BloquerComptePermission,
    BootstrapPermission,
    HotelProprietaireMixin,
    HypnosPermission,
)


class UserViewSet(HotelProprietaireMixin, viewsets.ModelViewSet):
    """
    Comptes techniques, un par agent.

    Trois points de sécurité :

    * le queryset est filtre sur l'hotel du compte connecte, donc un agent
      de l'hotel A ne voit meme pas l'existence d'un compte de l'hotel B ;
    * `is_active` n'est pas modifiable par la voie normale : le blocage
      passe par l'action `bloquer` ci-dessous, qui verifie qui a le droit
      de suspendre qui ;
    * la table vide ouvre une seule fois la creation du premier compte, sur
      `POST /api/users/`, et referme aussitot (voir `create`).
    """

    queryset = User.objects.order_by("id_user")
    serializer_class = UserSerializer
    permission_classes = [BootstrapPermission]

    def create(self, request, *args, **kwargs):
        """
        Creer un compte, ou le tout premier compte de l'installation.

        Tant que la table est vide, l'appel est anonyme et doit presenter le
        jeton d'installation (`X-Bootstrap-Token`). Le compte cree est un
        superadmin sans hotel : c'est le proprietaire de la plateforme, celui
        qui ensuite cree les hotelys et leurs agents.

        Des que la table contient un compte, cette porte se ferme et la
        creation repasse sous les permissions habituelles -- un agent ne
        peut donc pas s'attribuer un role.
        """
        if not User.objects.exists():
            return self.creer_premier_compte(request)

        return super().create(request, *args, **kwargs)

    def creer_premier_compte(self, request):
        """ Porte de demarrage : table vide + jeton d'installation."""
        attendu = getattr(settings, "BOOTSTRAP_TOKEN", "")
        fourni = request.headers.get("X-Bootstrap-Token", "")

        # Sans jeton configure, la porte reste fermee meme sur une base
        # neuve : c'est un oubli de deploiement, pas une invitation.
        if not attendu or fourni != attendu:
            return Response(
                {"detail": "Creation initiale refusee : envoyez l'en-tete "
                           "X-Bootstrap-Token avec le jeton d'installation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        donnees = BootstrapSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)

        # `select_for_update` referme la porte a deux lancements simultanes
        # sur une base neuve : sans verrou, deux postes tout frais pourraient
        # chacun voir la table vide et creer deux proprietaires.
        with transaction.atomic():
            User.objects.select_for_update().filter(pk__isnull=False).exists()
            if User.objects.exists():
                return Response(
                    {"detail": "Un compte existe deja."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            compte = donnees.save()

        return Response(UserSerializer(compte).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[BlocageAutorise, BloquerComptePermission],
    )
    def bloquer(self, request, pk=None):
        """
        Suspendre un compte (`is_active = False`).

        Suspendre, pas supprimer : les reservations, decisions et traces de
        l'agent restent rattaches a son compte. Le role ne change pas, le
        compte ne peut simplement plus se connecter ni appeler l'API — y
        compris avec un token deja obtenu, ce que verifie `HypnosPermission`.

        Seuls un superadmin (bloquer n'importe qui) ou le manager de
        l'hotel (bloquer les receptionnistes de son hotel) y sont
        autorises ; `BloquerComptePermission` tranche.
        """
        compte = self.get_object()
        autorise = BloquerComptePermission().has_object_permission(
            request, self, compte
        )
        if not autorise:
            return Response(
                {"detail": BloquerComptePermission.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        if compte.pk == request.user.pk:
            return Response(
                {"detail": "Un compte ne peut pas se bloquer lui-meme."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compte.is_active = False
        compte.save(update_fields=["is_active"])
        return Response(UserSerializer(compte).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[BlocageAutorise, BloquerComptePermission],
    )
    def reactiver(self, request, pk=None):
        """Contrepartie de `bloquer` : le compte peut de nouveau se connecter."""
        compte = self.get_object()
        autorise = BloquerComptePermission().has_object_permission(
            request, self, compte
        )
        if not autorise:
            return Response(
                {"detail": BloquerComptePermission.message},
                status=status.HTTP_403_FORBIDDEN,
            )

        compte.is_active = True
        compte.save(update_fields=["is_active"])
        return Response(UserSerializer(compte).data)