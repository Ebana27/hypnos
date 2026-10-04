"""
Politique d'acces de l'API Hypnos.

Trois niveaux, et pas un de plus. Le projet n'a pas besoin d'une grille de
roles : un role par hotel suffit, et le reste se deduit du modele.

    is_superuser (sans hotel)  -> voit et ecrit partout, bloque n'importe qui
    manager (d'un hotel)        -> ecrit dans SON hotel, lit son hotel,
                                  suspend les comptes de son hotel
    admin (d'un hotel)          -> lit son hotel, suspend les comptes de son
                                  hotel, mais n'ecrit aucune donnee
    receptionniste (d'un hotel)-> lit son hotel. Aucune ecriture.

Choix de conception
------------------
* Un seul role ecrit les donnees (`manager`) : "gerer l hotel" est une seule
  activite, et c'est le role que ton logiciel utilise.
* Suspendre un compte n'est pas ecrire dans l'hotel, c'est de
  l'administration : les deux roles d'encadrement le peuvent, `receptionniste`
  non. D'ou la distinction admin / manager.
* Le perimetre par hotel n'est PAS une permission mais un filtrage de
  queryset (`HotelProprietaireMixin`) : c'est la seule facon d'interdire
  aussi la LECTURE croisee. Une permission seule laisserait passer
  `GET /api/reservations/999/` vers un autre hotel.
* Le blocage passe par `is_active`, un champ que Django fournit deja.
  Il est refuse a la connexion par SimpleJWT ; on le verifie en plus ici,
  parce qu'un token deja delivre continuerait de marcher pendant une heure.
* `POST /api/demandes/` est la seule ecriture ouverte a un visiteur sans
  compte, et elle ne cree qu'une demande : le client ne s'accorde jamais
  lui-meme (voir `read_only_fields` de DemandeSerializer).
"""

from rest_framework import permissions

from .models import User

METHODES_ECRITURE = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class HypnosPermission(permissions.BasePermission):
    """
    Regle unique, appliquee a toutes les vues de l'API metier.

    - compte authentifie et actif, sinon refus ;
    - lecture (GET/HEAD/OPTIONS) : tout compte actif ;
    - ecriture : `manager` de l'hotel, ou superadmin.

    Le perimetre (quelles lignes) est traite separement, par
    `HotelProprietaireMixin`.
    """

    message_bloque = "Ce compte est bloque. Contactez l'administrateur."
    message_ecriture = (
        "Seul le manager de l'hotel ou un administrateur peut ecrire. "
        "Votre compte est en lecture seule."
    )
    message_anonyme = "Authentification requise."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            self.message = self.message_anonyme
            return False
        if not user.is_active:
            self.message = self.message_bloque
            return False
        if request.method in METHODES_ECRITURE:
            if not self.peut_ecrire(user):
                self.message = self.message_ecriture
                return False
        return True

    @staticmethod
    def peut_ecrire(user):
        return user.is_superuser or user.role == User.ROLE_MANAGER


class BootstrapPermission(HypnosPermission):
    """
    Ouvre la creation du tout premier compte, et seulement celui-la.

    Sans ce passage, une base neuve n'a personne pour se connecter : il faut
    soit une commande Django sur le serveur, soit laisser la porte ouverte a
    tout le monde. On choisit une porte etroite et fermee :

    * la table des comptes doit etre VIDE -- des la premiere creation, la
      regle rend la main et `HypnosPermission` s'applique normalement ;
    * un appel sans jeton est refuse des qu'un compte existe.

    Le jeton lui-meme est verifie dans `UserViewSet.create` : ici on ne
    autorise que le POST, pas les autres methodes ni la lecture.
    """

    def has_permission(self, request, view):
        if (
            request.method == "POST"
            and not request.user.is_authenticated
            and not User.objects.exists()
        ):
            return True
        return super().has_permission(request, view)


class AgentDeTraitement(HypnosPermission):
    """
    La file de synchronisation est un outil de traitement, pas de consultation.

    Un `receptionniste` lit deja les demandes de son hotel par
    `GET /api/demandes/`. Lui ouvrir aussi la file de traitement lui donnerait
    un second endroit ou l'agent se melange a la consultation, sans rien
    ajouter : la lecture y est plus pauvre que celle de l'API metier.

    On reserve donc la file a celui qui repond, ce qui rend la regle lisible
    d'une seule facon : `/api/sync/` ecrit, `/api/` separe les lectures.
    """

    message_file = (
        "La file de synchronisation est reservee au compte qui traite les "
        "demandes. Utilisez l'API des demandes pour consulter."
    )

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if not self.peut_ecrire(request.user):
            self.message = self.message_file
            return False
        return True


class DemandePubliquePermission(HypnosPermission):
    """
    Variante pour `DemandeViewSet` : le formulaire public du site doit
    pouvoir deposer une demande SANS compte.

    Seul le POST est ouvert a un visiteur, et seulement pour creer. Get /
    Put / Patch / Delete restent reserves a un compte authentifie : ouvrir
    toute la vue a AllowAny rendrait la liste des demandes de tous les
    hotels publique, ce qui n'est pas l'effet recherche.

    Un seul appel par compte reste possible sans authentification, d'ou le
    quota (voir DEFAULT_THROTTLE_RATES et `throttle_classes`).
    """

    message_anonyme = "Authentification requise."

    def has_permission(self, request, view):
        if request.method == "POST" and not request.user.is_authenticated:
            return True
        return super().has_permission(request, view)

    def has_object_permission(self, request, view, obj):
        # Un visiteur ne cree rien d'autre : la lecture et la modification
        # d'une demande restent reservees a l'agent de l'hotel concerne.
        return self.has_permission(request, view)


class BloquerComptePermission(permissions.BasePermission):
    """
    Qui a le droit de suspendre un compte (`is_active`).

    Un seul role ecrit les donnees de l'hotel (`manager`), mais bloquer un
    compte n'est pas ecrire dans l'hotel : c'est une decision
    d'administration. Les deux roles d'encadrement (`admin` et `manager`)
    peuvent donc suspendre un compte de leur propre hotel. Le superadmin
    suspend n'importe qui.

    Regle unique et sans exception : ni soi-meme, ni un superadmin, ni un
    compte d'un autre hotel. Le queryset etant deja filtre par hotel, un
    compte etranger n'est meme pas accessible.
    """

    message = "Vous ne pouvez pas modifier ce compte."

    def has_object_permission(self, request, view, obj):
        if request.method not in METHODES_ECRITURE:
            return True

        acteur = request.user
        if acteur.is_superuser:
            return True
        if acteur.role not in (User.ROLE_ADMIN, User.ROLE_MANAGER):
            return False
        return not obj.is_superuser and obj.hotel_id == acteur.hotel_id


class BlocageAutorise(permissions.BasePermission):
    """
    Garde-fou des actions `bloquer` / `reactiver`.

    Suspendre un compte n'est pas ecrire une donnee de l'hotel, mais
    `HypnosPermission` reserve toute ecriture au `manager`. Sans cette classe
    dediee, un `admin` ne pourrait pas suspendre un receptionniste alors que
    c'est precisement son role : superviser sans toucher aux donnees.
    """

    message = "Seul l'encadrement peut suspendre un compte."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated or not user.is_active:
            return False
        return user.is_superuser or user.role in (
            User.ROLE_ADMIN,
            User.ROLE_MANAGER,
        )


class HotelProprietaireMixin:
    """
    Filtre les lignes visibles sur `request.user.hotel`.

    Sans ce mixin, n'importe quel compte authentifie lisait et modifiait les
    hotes d'un autre : c'est le defaut le plus grave du projet, il donneait
    a un receptionnaire de l'hotel A la main sur l'hotel B.

    `champ_hotel` nomme l'attribut de filtrage. Trois cas :
        "hotel"      -> la FK existe (Chambre, Demande, Reservation, User)
        "user__hotel"-> l'objet passe par un compte (Personnel)
        None         -> pas de perimetre possible (Hotel, TypeDeChambre,
                        Client : ces tables sont globales par construction)
    """

    champ_hotel = "hotel"

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if self.champ_hotel is None:
            return queryset
        if user.hotel_id is None:
            # Un compte sans hotel qui n'est pas superuser ne voit rien :
            # la contrainte `user_hotel_ou_superuser` rend le cas theorique,
            # on ne lui laisse pas pour autant un acces global.
            return queryset.none()
        return queryset.filter(**{self.champ_hotel: user.hotel_id})


class HotelParSonIdMixin(HotelProprietaireMixin):
    """Variante pour `HotelViewSet`, ou la cle est `hotel_id` et non `hotel`."""

    def get_queryset(self):
        queryset = super(HotelProprietaireMixin, self).get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if user.hotel_id is None:
            return queryset.none()
        return queryset.filter(hotel_id=user.hotel_id)