from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from hotels.models import Chambre, Hotel


class Client(models.Model):
    """
    Fiche client saisie au moment de la demande.

    CE N'EST PAS UN COMPTE. Client n'herite pas de AbstractUser et n'a
    aucun mot de passe : il n'existe que pour porter les informations
    laissees par l'hote. Il n'y a donc ni session, ni JWT, ni django-allauth
    pour cette table (les comptes techniques sont dans accounts.User).

    Une nouvelle ligne est creee a chaque demande : `email` est donc indexe
    mais NON unique, pour qu'un meme hote puisse reserver plusieurs fois.
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
        max_length=255, blank=True, help_text="Type/numero de piece d'identite."
    )
    # Rajouter un help_text sur preference
    preference = models.CharField(max_length=255, blank=True)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES)
    loyalty = models.BooleanField(default=False)

    class Meta:
        db_table = "client"
        indexes = [
            models.Index(fields=["nom", "prenom"], name="client_nom_prenom_idx"),
        ]

    def __str__(self):
        return f"{self.prenom} {self.nom}"


class _ReglesMetier(models.Model):
    """
    Regles communes a Demande et Reservation.

    Mixin abstrait, jamais utilise comme table. `Meta.abstract` suffit a
    dire a Django de ne pas creer de table : aucun champ n'est declare ici,
    chaque classe fille declare les siens, et les methodes ci-dessous y
    accedent par `self`.

    Factorise ce qui est IDENTIQUE entre une demande et une reservation :
        - la coherence hotel / chambre (incoherence 2)
        - l'ordre des dates
        - le nombre de personnes
    """

    class Meta:
        abstract = True

    def _chambre_de_reference(self):
        """La chambre qui porte la regle de capacite pour cet objet."""
        raise NotImplementedError

    def _nom_champ_chambre(self):
        """Nom du champ a signaler en cas de chambre d'un autre hotel."""
        raise NotImplementedError

    def _verifier_capacite(self):
        chambre = self._chambre_de_reference()
        if chambre is None or not self.nombreDePersonne:
            return
        capacite = chambre.type_chambre.capacite
        if self.nombreDePersonne > capacite:
            raise ValidationError(
                {
                    "nombreDePersonne": (
                        f"La chambre {chambre.numero} accepte au maximum "
                        f"{capacite} personne(s)."
                    )
                }
            )

    def _verifier_meme_hotel(self, chambre, champ):
        """
        Coherence 2 : la chambre et l'objet doivent appartenir au meme hotel.

        `hotel_id` est porte par l'objet, `chambre.hotel_id` par la chambre.
        Comme ce sont deux colonnes, rien ne les lie au niveau base : d'ou
        cette verification. Elle est appelee par clean() ET reappliquee par
        les CheckConstraint / validations de `save()`.
        """
        if chambre is None or self.hotel_id is None:
            return
        if chambre.hotel_id != self.hotel_id:
            raise ValidationError(
                {
                    champ: (
                        f"La chambre {chambre.numero} n'appartient pas a cet "
                        f"hotel. Elle a ete reservee dans un autre etablissement."
                    )
                }
            )

    def _verifier_dates(self):
        if self.date_debut and self.date_fin and self.date_fin <= self.date_debut:
            raise ValidationError(
                {"date_fin": "Le depart doit etre posterieur a l'arrivee."}
            )

    @property
    def nombre_de_nuits(self):
        """
        Duree du sejour, en nuits.

        On compte les nuits, donc sur les dates et non sur les heures :
        une arrivee le 1er a 22 h et un depart le 3 a 11 h font 2 nuits,
        meme si la premiere nuit est tres courte.
        """
        if not self.date_debut or not self.date_fin:
            return 0
        return max((self.date_fin.date() - self.date_debut.date()).days, 0)

    def clean(self):
        self._verifier_dates()
        self._verifier_meme_hotel(self._chambre_de_reference(), self._nom_champ_chambre())
        self._verifier_capacite()

    def save(self, *args, **kwargs):
        # Django n'appelle clean() que depuis un ModelForm. On le branche ici
        # pour que les regles s'appliquent aussi quand du code appelle
        # .save() directement.
        self.full_clean()
        super().save(*args, **kwargs)


class Demande(_ReglesMetier):
    """
    Demande de chambre emmanant du site web, en attente de l'agent.

    C'est une DEMANDE, pas une reservation : elle ne contient aucune
    chambre attribuee. La chambre que le client a demandee est conservee
    dans `chambre_demandee`, meme si l'agent attribue finalement une autre
    chambre -- c'est ce qui permet de mesurer le taux de changement.

    Quand l'agent accepte, `sync.services.valider_demande()` cree une
    Reservation a partir de cette demande et passe la demande a "acceptee".
    Les deux lignes sont conservees : la demande garde la trace de ce que le
    client voulait, la reservation porte ce qui est reellement bloque.
    """

    STATUT_EN_ATTENTE = "en_attente"
    STATUT_ACCEPTEE = "acceptee"
    STATUT_REFUSEE = "refusee"
    STATUT_CHOICES = [
        (STATUT_EN_ATTENTE, "En attente"),
        (STATUT_ACCEPTEE, "Acceptee"),
        (STATUT_REFUSEE, "Refusee"),
    ]

    num = models.AutoField(primary_key=True)
    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.PROTECT,
        related_name="demandes",
        db_column="hotel_id",
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name="demandes",
        db_column="id_client",
    )
    # SET_NULL : supprimer une chambre ne doit pas supprimer la demande,
    # on garde la demande et on perd seulement le choix du client.
    chambre_demandee = models.ForeignKey(
        Chambre,
        on_delete=models.SET_NULL,
        related_name="demandes",
        null=True,
        blank=True,
    )
    date_debut = models.DateTimeField(
        help_text="Instant d'arrivee prevu (check-in de l'hotel si le client n'a pas precise l'heure).",
    )
    date_fin = models.DateTimeField(
        help_text="Instant de depart prevu (check-out de l'hotel si le client n'a pas precise l'heure).",
    )
    nombreDePersonne = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES, default=STATUT_EN_ATTENTE
    )
    # Trace de la decision de l'agent. Renseignee par
    # sync.services.valider_demande(), jamais par le client du site.
    date_decision = models.DateTimeField(null=True, blank=True)
    motif_refus = models.CharField(
        max_length=255,
        blank=True,
        help_text="Raison indiquee au client si l'agent refuse la demande.",
    )
    # `default=timezone.now` et non `auto_now_add=True` : les deux posent la
    # date a l'insertion, mais auto_now_add oblige Django a demander une
    # valeur pour les lignes deja presentes, ce qui bloque `makemigrations`
    # en mode non interactif (utilise par la CI). `editable=False` empeche
    # un client de forcer une autre date via l'API.
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "demande"
        ordering = ["date_debut"]
        verbose_name = "Demande de chambre"
        verbose_name_plural = "Demandes de chambres"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(date_fin__gt=models.F("date_debut")),
                name="demande_fin_apres_debut",
            ),
            models.CheckConstraint(
                condition=models.Q(nombreDePersonne__gte=1),
                name="demande_min_une_personne",
            ),
        ]
        indexes = [
            # Requete la plus frequente de l'agent : la file d'attente, les
            # plus anciennes d'abord.
            models.Index(fields=["statut", "date_debut"], name="demande_statut_date_idx"),
            models.Index(fields=["date_debut", "date_fin"], name="demande_dates_idx"),
        ]

    def _chambre_de_reference(self):
        return self.chambre_demandee

    def _nom_champ_chambre(self):
        return "chambre_demandee"

    def __str__(self):
        return f"Demande #{self.num} - {self.client}"

    @property
    def est_en_attente(self):
        return self.statut == self.STATUT_EN_ATTENTE

    def valider(self, **kwargs):
        """Raccourci vers sync.services.valider_demande()."""
        from sync import services

        return services.valider_demande(self, **kwargs)


class Reservation(_ReglesMetier):
    """
    Reservation effective : une chambre est bloquee pour une plage d'instants.

    `date_debut` et `date_fin` sont des DateTimeField, pas des dates : une
    reservation se fait a une heure precise (l'heure de check-in de l'hotel
    si le client n'en a pas donne, voir Hotel.heure_arrivee). C'est ce qui
    permet de laisser la chambre a un client qui part a 11 h et a un autre
    qui arrive a 15 h le meme jour, tout en refusant une arrivee a 22 h
    un jour de depart.

    N'existe QU'APRES acceptation d'une Demande par l'agent. `chambre` est
    donc NOT NULL, et la regle "une reservation confirmee a toujours une
    chambre" devient structurelle : plus aucune contrainte speciale n'est
    necessaire, la colonne ne peut pas etre vide.

    Foreign keys
    ------------
    * hotel        -> PROTECT : hotel de rattachement, verifie egalement
      contre `chambre.hotel_id` (coherence 2).
    * client       -> PROTECT : un client peut avoir plusieurs reservations.
    * chambre      -> PROTECT : protege l'historique et les dates bloquees.
    * demande      -> SET_NULL : la Demande a l'origine, si elle existe.
    """

    STATUT_CONFIRMEE = "confirmee"
    STATUT_TERMINEE = "terminee"
    STATUT_ANNULEE = "annulee"
    STATUT_CHOICES = [
        (STATUT_CONFIRMEE, "Confirmee"),
        (STATUT_TERMINEE, "Terminee"),
        (STATUT_ANNULEE, "Annulee"),
    ]

    num = models.AutoField(primary_key=True)
    hotel = models.ForeignKey(
        Hotel,
        on_delete=models.PROTECT,
        related_name="reservations",
        db_column="hotel_id",
    )
    client = models.ForeignKey(
        Client,
        on_delete=models.PROTECT,
        related_name="reservations",
        db_column="id_client",
    )
    chambre = models.ForeignKey(
        Chambre,
        on_delete=models.PROTECT,
        related_name="reservations",
        db_column="id_chambre",
    )
    demande = models.ForeignKey(
        Demande,
        on_delete=models.SET_NULL,
        related_name="reservations",
        null=True,
        blank=True,
        help_text="Demande du site web a l'origine de cette reservation.",
    )
    date_debut = models.DateTimeField(
        help_text="Arrivee effective du client (check-in de l'hotel par defaut).",
    )
    date_fin = models.DateTimeField(
        help_text="Depart effectif du client (check-out de l'hotel par defaut).",
    )
    nombreDePersonne = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    statut = models.CharField(
        max_length=20, choices=STATUT_CHOICES, default=STATUT_CONFIRMEE
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "reservation"
        ordering = ["-date_debut"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(date_fin__gt=models.F("date_debut")),
                name="reservation_fin_apres_debut",
            ),
            models.CheckConstraint(
                condition=models.Q(nombreDePersonne__gte=1),
                name="reservation_min_une_personne",
            ),
        ]
        indexes = [
            models.Index(fields=["statut", "date_debut"], name="reservation_statut_date_idx"),
            models.Index(fields=["date_debut", "date_fin"], name="reservation_dates_idx"),
        ]

    def _chambre_de_reference(self):
        return self.chambre

    def _nom_champ_chambre(self):
        return "chambre"

    def __str__(self):
        return f"Reservation #{self.num} - {self.client} - {self.chambre}"

    def clean(self):
        super().clean()
        self._verifier_pas_de_doublon()

    def _verifier_pas_de_doublon(self):
        """
        Pas de double reservation sur la meme chambre.

        Les dates etant des INSTANTS, la comparaison se fait a la minute
        pres. Deux intervalles [a1,b1] et [a2,b2] se chevauchent si
        a1 < b2 ET a2 < b1, bornes exclues : la chambre est libre entre
        le depart de l'un et l'arrivee de l'autre.

        Concretement, avec un check-out a 11 h et un check-in a 15 h :
            - un client qui part le 5 a 11 h et un autre qui arrive le 5
              a 15 h se succedent, c'est autorise ;
            - un client qui arrive le 5 a 22 h, alors que la chambre est
              encore occupee jusqu'a 11 h ce jour-la, est refuse.

        Seules les reservations actives comptent : une reservation annulee
        ou terminee ne bloque plus rien.
        """
        if not self.chambre_id or not self.date_debut or not self.date_fin:
            return
        conflits = Reservation.objects.filter(
            chambre_id=self.chambre_id,
            statut__in=[self.STATUT_CONFIRMEE, self.STATUT_TERMINEE],
            date_debut__lt=self.date_fin,
            date_fin__gt=self.date_debut,
        )
        if self.pk:
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
