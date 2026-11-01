from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Compte technique servant a se connecter au logiciel Hypnos.

    Seul modele de l'application `accounts`, et seul modele du projet
    autorise a se connecter : Personnel et Client n'en heritent pas.

    Herite de AbstractUser, donc herite de : password, last_login,
    is_superuser, is_staff, is_active, date_joined, first_name, last_name,
    groups et user_permissions.

    Choix de conception
    ------------------
    * primary_key = "id_user" : la cle primaire est renommee pour respecter
      le nommage de la base (idem que hotel_id, id_client, id_chambre...).
      Consequence : le champ "id" n'existe PAS. Toute reference a
      settings.AUTH_USER_MODEL doit viser "id_user", en particulier
      SIMPLE_JWT["USER_ID_FIELD"] dans config/settings.py.
    * email unique : indispensable car allauth authentifie par e-mail
      (ACCOUNT_LOGIN_METHODS = {"username", "email"}). L'unicite est aussi
      garantie au niveau base, pas seulement dans les formulaires.
    * role : un compte est soit administrateur, soit receptionniste, soit
      manager. Les permissions Django (is_staff / groups) restent
      disponibles et ne sont pas remplacees par ce champ.
    * "user" reste un mot reserve dans PostgreSQL. Le nom de table est
      inoffensif en SQLite (developpement) mais devra etre guillemet
      (ou renomme) lors du passage a PostgreSQL.

    ATTENTION : AUTH_USER_MODEL est declare dans config/settings.py. Si
    cette valeur a deja ete appliquee a une base, la changer exige de
    regenerer l'ensemble des migrations (Django refuse autrement).
    """

    ROLE_ADMIN = "admin"
    ROLE_RECEPTIONNISTE = "receptionniste"
    ROLE_MANAGER = "manager"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Administrateur"),
        (ROLE_RECEPTIONNISTE, "Receptionniste"),
        (ROLE_MANAGER, "Manager"),
    ]

    id_user = models.AutoField(primary_key=True)
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(max_length=255, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(
        max_length=30, choices=ROLE_CHOICES, default=ROLE_RECEPTIONNISTE
    )
    # Regle metier : « a chaque hotel son utilisateur ». Un compte
    # appartient donc exactement a un hotel, comme ses employes.
    #
    # null=True reste autorise UNIQUEMENT pour is_superuser : sinon
    # impossible de creer le tout premier compte, puisque createsuperuser
    # doit fonctionner avant qu'un hotel existe. La contrainte ci-dessous
    # rend cette exception explicite AU NIVEAU BASE, donc un compte sans
    # hotel ne peut etre qu'un superadministrateur, jamais un simple oubli.
    hotel = models.ForeignKey(
        "hotels.Hotel",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="comptes",
        help_text="Hotel de rattachement. Vide uniquement pour un superadministrateur.",
    )

    class Meta:
        db_table = "user"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hotel__isnull=False) | models.Q(is_superuser=True),
                name="user_hotel_ou_superuser",
            ),
        ]

    def __str__(self):
        return self.username

    @property
    def est_administrateur_plateforme(self):
        """Vrai pour le compte sans hotel, qui voit tous les etablissements."""
        return self.hotel_id is None
