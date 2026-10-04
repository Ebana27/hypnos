from datetime import time as Heure

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models


class Hotel(models.Model):
    """
    Etablissement hotelier. Racine du domaine hôtelier : tout le reste de
    l'application `hotels` y est rattache.
    """

    # Heures de reference de l'etablissement. Une reservation porte des
    # instants precis (voir reservations.models.DateTimeField) : ces deux
    # heures servent de valeur par defaut quand le client ne donne qu'une
    # date -- ce qui est le cas du site public, ou le formulaire ne propose
    # que deux dates.
    HEURE_ARRIVEE_DEFAUT = Heure(15, 0)
    HEURE_DEPART_DEFAUT = Heure(11, 0)

    hotel_id = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=150)
    adresse = models.CharField(max_length=255)
    ville = models.CharField(max_length=100)
    tel = models.CharField(max_length=30)
    email = models.EmailField(max_length=255)
    nombre_etages = models.PositiveIntegerField(
        validators=[MinValueValidator(1)], help_text="Nombre de niveaux."
    )
    # Denneormalise : le nombre de chambres est saisi a la creation de
    # l'hotel. NE PAS utiliser ce champ comme reference de verite, la source
    # de verite est Hotel.chambres.count() (voir nombre_chambres_reel).
    nombre_chambres = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    heure_arrivee = models.TimeField(
        default=HEURE_ARRIVEE_DEFAUT,
        help_text="Heure de check-in : heure d'arrivee retenue quand le client ne precise pas l'heure.",
    )
    heure_depart = models.TimeField(
        default=HEURE_DEPART_DEFAUT,
        help_text="Heure de check-out : heure de depart retenue quand le client ne precise pas l'heure.",
    )

    class Meta:
        db_table = "hotel"

    def __str__(self):
        return self.nom

    def nombre_chambres_reel(self):
        """Nombre de chambres effectivement enregistrees."""
        return self.chambres.count()

    @property
    def name(self):
        """Alias pour 'nom' afin de satisfaire les references externes."""
        return self.nom

    @name.setter
    def name(self, value):
        self.nom = value


class TypeDeChambre(models.Model):
    """
    Catalogue des categories de chambres, avec tarif et capacite.
    """

    id_type = models.AutoField(primary_key=True)
    label = models.CharField(max_length=100, unique=True)
    prix = models.DecimalField(
        max_digits=10, decimal_places=2, validators=[MinValueValidator(0)]
    )
    capacite = models.PositiveIntegerField(
        validators=[MinValueValidator(1)], help_text="Nombre de personnes maxi."
    )

    class Meta:
        db_table = "type_de_chambre"

    def __str__(self):
        return self.label


class Chambre(models.Model):
    """
    Chambre physique d'un hotel.

    Foreign keys
    ------------
    * hotel        -> CASCADE  : la chambre appartient a un seul hotel.
    * type_chambre -> PROTECT : on ne peut pas supprimer un type de chambre
      encore utilise, cela rendrait les reservations existantes orphelines.

    La contrainte unique (hotel, numero) autorise le meme numero dans deux
    hotels differents tout en interdisant les doublons dans un meme hotel.
    """

    STATUT_DISPONIBLE = "disponible"
    STATUT_OCCUPEE = "occupee"
    STATUT_MAINTENANCE = "maintenance"
    STATUT_CHOICES = [
        (STATUT_DISPONIBLE, "Disponible"),
        (STATUT_OCCUPEE, "Occupee"),
        (STATUT_MAINTENANCE, "En maintenance"),
    ]

    id_chambre = models.AutoField(primary_key=True)
    hotel = models.ForeignKey(
        Hotel, on_delete=models.CASCADE, related_name="chambres", db_column="hotel_id"
    )
    type_chambre = models.ForeignKey(
        TypeDeChambre,
        on_delete=models.PROTECT,
        related_name="chambres",
        db_column="id_type",
    )
    numero = models.CharField(max_length=20)
    etage = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES, default=STATUT_DISPONIBLE
    )

    class Meta:
        db_table = "chambre"
        constraints = [
            models.UniqueConstraint(
                fields=["hotel", "numero"], name="unique_numero_par_hotel"
            ),
        ]
        indexes = [
            # Requete la plus frequente : chambres libres d'un hotel.
            models.Index(fields=["hotel", "statut"], name="chambre_hotel_statut_idx"),
        ]

    def __str__(self):
        return f"{self.hotel.nom} - Chambre {self.numero}"

    def clean(self):
        # L'etage ne peut pas depasser la hauteur de l'hotel.
        if self.hotel_id and self.etage and self.hotel.nombre_etages:
            if self.etage > self.hotel.nombre_etages:
                raise ValidationError(
                    {
                        "etage": f"L'etage ne peut pas depasser "
                        f"{self.hotel.nombre_etages} pour cet hotel."
                    }
                )

    def save(self, *args, **kwargs):
        # Django n'appelle clean() que depuis un ModelForm. On le branche
        # ici pour que la regle s'applique aussi quand du code appelle
        # chambre.save() directement, et pour valider au passage la
        # contrainte unique et les MinValueValidator.
        self.full_clean()
        super().save(*args, **kwargs)


class Personnel(models.Model):
    """
    Membre du personnel de l'hotel, rattache a un compte technique.

    Regle metier : « a chaque hotel ses employes ». L'employe EST le compte.
    Donc Personnel ne porte plus ni `hotel` ni `nom`/`prenom` -- ces
    informations viennent de User, ce qui supprime la possibilite qu'un
    compte et sa fiche soient desynchronises.

        - hotel  : lu via user.hotel_id
        - nom     : lu via user.last_name
        - prenom  : lu via user.first_name

    Foreign keys
    ------------
    * user -> settings.AUTH_USER_MODEL, PROTECT, OneToOne, NOT NULL.
      PROTECT : on ne peut pas supprimer le compte d'un employe en
      activity. SET_NULL aurait permis de laisser un employe sans compte,
      ce qui recreait exactement l'incoherence qu'on supprime ici.
    """

    SEXE_M = "M"
    SEXE_F = "F"
    SEXE_CHOICES = [(SEXE_M, "Masculin"), (SEXE_F, "Feminin")]

    matricule = models.AutoField(primary_key=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="personnel",
        db_column="id_user",
        help_text="Compte Hypnos de cet employe.",
    )
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES)
    poste = models.CharField(max_length=100)

    class Meta:
        db_table = "personnel"
        indexes = [
            models.Index(fields=["poste"], name="personnel_poste_idx"),
        ]

    def __str__(self):
        return f"{self.prenom} {self.nom} ({self.poste})"

    # -- proprietes de lecture -------------------------------------------------
    # Elles rendent le code et les templates lisibles. ATTENTION : une
    # propriete n'existe pas en SQL, donc en cas de REQUETE il faut passer
    # par la relation : Personnel.objects.filter(user__hotel=X), jamais
    # Personnel.objects.filter(hotel=X).

    @property
    def hotel(self):
        return self.user.hotel

    @property
    def hotel_id(self):
        return self.user.hotel_id

    @property
    def nom(self):
        return self.user.last_name

    @property
    def prenom(self):
        return self.user.first_name
