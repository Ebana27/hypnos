from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from hotels.models import Chambre


class Client(models.Model):
    """
    Fiche client saisie au moment de la reservation.

    CE N'EST PAS UN COMPTE. Client n'herite pas de AbstractUser et n'a
    aucun mot de passe : il n'existe que pour porter les informations
    laissees par l'hote lors d'une reservation. Il n'y a donc ni session,
    ni JWT, ni django-allauth pour cette table (les comptes techniques
    sont dans accounts.User).

    Consequence : pas de champ password ici. Un ancien `password` en clair
    a ete retire : il n'etait jamais hache, donc lisible en base, et
    inutile puisque Client ne s'authentifie pas.

    Une nouvelle ligne est creee a chaque reservation : `email` est donc
    indexe mais NON unique, pour qu'un meme hote puisse reserver
    plusieurs fois.
    """

    SEXE_M = "M"
    SEXE_F = "F"
    SEXE_CHOICES = [(SEXE_M, "Masculin"), (SEXE_F, "Feminin")]

    id_client = models.AutoField(primary_key=True)
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    tel = models.CharField(max_length=30)
    email = models.EmailField(max_length=255, db_index=True)
    document = models.CharField(
        max_length=255, blank=True, help_text="Type/numerode piece d'identite."
    )
    preference = models.CharField(max_length=255, blank=True)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES)
    loyalty = models.BooleanField(default=False)

    class Meta:
        db_table = "client"
        indexes = [
            # Recherche par nom + prenom a la saisie d'une reservation.
            models.Index(fields=["nom", "prenom"], name="client_nom_prenom_idx"),
        ]

    def __str__(self):
        return f"{self.prenom} {self.nom}"


class Reservation(models.Model):
    """
    Reservation d'une chambre par un client, sur une plage de dates.

    Foreign keys
    ------------
    * client  -> PROTECT : un client peut avoir plusieurs reservations,
      l'inverse n'a pas de sens. PROTECT interdit la suppression du client
      tant qu'une reservation existe, ce qui preserve l'historique.
    * chambre -> hotels.Chambre, PROTECT : une reservation terminee fait
      partie du reporting et ne doit pas disparaitre avec la chambre.
      Seul lien entre l'application `reservations` et l'application
      `hotels`, ce qui explique que `hotels` ne depend d'aucune autre app.

    Les deux regles de gestion ci-dessous sont appliquees DEUX fois :
      1. CheckConstraint : garantie par la base, meme en cas d'INSERT brut
         via SQL ou via le shell.
      2. clean() : message d'erreur lisible, execute via full_clean() dans
         save() et automatiquement par les ModelForm / DRF serializers.
    """

    STATUT_EN_ATTENTE = "en_attente"
    STATUT_CONFIRMEE = "confirmee"
    STATUT_ANNULEE = "annulee"
    STATUT_TERMINEE = "terminee"
    STATUT_CHOICES = [
        (STATUT_EN_ATTENTE, "En attente"),
        (STATUT_CONFIRMEE, "Confirmee"),
        (STATUT_ANNULEE, "Annulee"),
        (STATUT_TERMINEE, "Terminee"),
    ]

    num = models.AutoField(primary_key=True)
    client = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name="reservations", db_column="id_client"
    )
    chambre = models.ForeignKey(
        Chambre,
        on_delete=models.PROTECT,
        related_name="reservations",
        db_column="id_chambre",
    )
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES, default=STATUT_EN_ATTENTE
    )
    nombreDePersonne = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        db_table = "reservation"
        ordering = ["-date_debut"]
        constraints = [
            # 1. La fin doit etre posterieure au debut. Ecrite en SQL pur
            #    pour que SQLite ET PostgreSQL l'appliquent.
            models.CheckConstraint(
                condition=models.Q(date_fin__gt=models.F("date_debut")),
                name="reservation_fin_apres_debut",
            ),
            # 2. Au moins une personne. Redondant avec MinValueValidator,
            #    mais verrouille la regle au niveau base.
            models.CheckConstraint(
                condition=models.Q(nombreDePersonne__gte=1),
                name="reservation_min_une_personne",
            ),
        ]
        indexes = [
            # Requete de disponibilite : quelles chambres sont libres entre
            # deux dates ? Index sur la plage, trie par date de debut.
            models.Index(fields=["date_debut", "date_fin"], name="reservation_dates_idx"),
        ]

    def __str__(self):
        return f"Reservation #{self.num} - {self.client}"

    def clean(self):
        # Regle 1 : ordering des dates.
        if self.date_debut and self.date_fin and self.date_fin <= self.date_debut:
            raise ValidationError(
                {"date_fin": "La date de fin doit etre posterieure a la date de debut."}
            )

        # Regle 2 : on ne peut pas depasser la capacite de la chambre.
        capacite = None
        if self.chambre_id and self.chambre and self.chambre.type_chambre:
            capacite = self.chambre.type_chambre.capacite
        if capacite and self.nombreDePersonne > capacite:
            raise ValidationError(
                {
                    "nombreDePersonne": (
                        f"La chambre {self.chambre.numero} accepte au maximum "
                        f"{capacite} personne(s)."
                    )
                }
            )

        # Regle 3 : pas de double reservation sur la meme chambre, meme si les
        # dates sont differentes. Seules les reservations actives comptent.
        # Deux intervalles [a1,b1] et [a2,b2] se chevauchent si
        # a1 < b2 ET a2 < b1 (bornes exclues : une sortie le jour de
        # l'entree d'un autre client reste possible).
        if self.chambre_id and self.date_debut and self.date_fin:
            conflits = Reservation.objects.filter(
                chambre_id=self.chambre_id,
                statut__in=[self.STATUT_EN_ATTENTE, self.STATUT_CONFIRMEE],
                date_debut__lt=self.date_fin,
                date_fin__gt=self.date_debut,
            )
            if self.pk:
                # Ignore la reservation en cours de modification.
                conflits = conflits.exclude(pk=self.pk)
            if conflits.exists():
                raise ValidationError(
                    {
                        "chambre": (
                            f"La chambre {self.chambre.numero} est deja reservee "
                            f"sur une partie de cette plage de dates."
                        )
                    }
                )

    def save(self, *args, **kwargs):
        # Django n'appelle clean() que depuis un ModelForm. On le branche
        # ici pour que la regle de gestion s'applique aussi quand du code
        # appelle reservation.save() directement.
        self.full_clean()
        super().save(*args, **kwargs)
