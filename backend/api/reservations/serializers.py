"""
Serializers de l'application `reservations`.

Point d'attention : `date_debut` et `date_fin` sont des INSTANTS (heure
precise), pas de simples dates. Voir `ChampPeriode` plus bas pour les deux
formes acceptees en entree.
"""

from datetime import datetime, time

from django.utils import timezone
from rest_framework import serializers

from .models import Client, Demande, Reservation


class ChampPeriode(serializers.Field):
    """
    Champ d'arrivee / de depart, accepte sous deux formes :

        "2026-10-01"                    -> l'heure de l'hotel est appliquee
        "2026-10-01T22:30:00"          -> l'heure demandee est conservee

    Pourquoi : le site public ne propose que deux dates (formulaire
    `<input type="date">`), alors que l'agent saisie lui une heure reelle
    ("arrivee prevue 22h30"). Les deux doivent passer par le meme champ.

    Le champ se contente de lire la valeur ; c'est
    `avec_heure_de_reference()`, appele par le serializer parent, qui applique
    l'heure de l'hotel -- le parent etant le seul endroit ou l'hotel de la
    ligne est deja connu.

    Le resultat est toujours un datetime aware : une date seule est
    interpretee dans le fuseau de Django (TIME_ZONE = "UTC" ici).
    """

    default_error_messages = {
        "invalide": "Format attendu : AAAA-MM-JJ ou AAAA-MM-JJTHH:MM[:SS].",
    }

    def __init__(self, champ_heure, heure_par_defaut, **kwargs):
        self.champ_heure = champ_heure
        self.heure_par_defaut = heure_par_defaut
        # Le champ ne fait que signaler ce qu'il a lu ; l'heure est posee
        # plus tard, par le serializer parent.
        self.date_seule = False
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if isinstance(data, datetime):
            self.date_seule = False
            return self._rendre_aware(data)

        if not isinstance(data, str):
            self.fail("invalide")

        texte = data.strip()
        try:
            moment = datetime.fromisoformat(texte)
        except ValueError:
            self.fail("invalide")

        # 10 caracteres = "AAAA-MM-JJ" : le client n'a donne qu'un jour.
        self.date_seule = len(texte) <= 10
        return self._rendre_aware(moment)

    def to_representation(self, value):
        return value.isoformat()

    def avec_heure_de_reference(self, moment, hotel):
        """
        Pose l'heure de l'hotel sur un jour sans heure.

        Ne fait rien si le client a lui-meme donne une heure : dans ce cas,
        c'est sa demande qui fait foi, l'agent pourra l'ajuster ensuite.
        """
        if not self.date_seule:
            return moment
        heure = self._heure_de_reference(hotel)
        return moment.replace(
            hour=heure.hour, minute=heure.minute, second=0, microsecond=0
        )

    def _heure_de_reference(self, hotel):
        if hotel is None:
            return self.heure_par_defaut
        return getattr(hotel, self.champ_heure, None) or self.heure_par_defaut

    def _rendre_aware(self, moment):
        if timezone.is_naive(moment):
            return timezone.make_aware(moment, timezone.get_default_timezone())
        return moment


class _HeuresDeReferenceMixin:
    """
    Applique les heures de l'hotel aux champs envoyes sans heure.

    Mixin voluntarily minimal : il rend le modele "une date seule prend
    l'heure de l'etablissement" explicite dans chaque serializer, plutot que
    cache dans le champ.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # `hotel` precede `date_debut` / `date_fin` dans `Meta.fields` : il
        # est deja valide. Sur une modification (PATCH) qui ne le renvoie
        # pas, on prend celui de l'enregistrement modifie.
        hotel = attrs.get("hotel") or getattr(self.instance, "hotel", None)
        for nom in ("date_debut", "date_fin"):
            champ = self.fields[nom]
            if isinstance(champ, ChampPeriode) and nom in attrs:
                attrs[nom] = champ.avec_heure_de_reference(attrs[nom], hotel)

        # L'ordre des instants est verifie ici et non seulement dans le
        # modele : sinon la CheckConstraint de la base explosait en 500 sur
        # une simple erreur de saisie du client.
        debut, fin = attrs.get("date_debut"), attrs.get("date_fin")
        if debut and fin and fin <= debut:
            raise serializers.ValidationError(
                {"date_fin": "Le depart doit etre posterieur a l'arrivee."}
            )

        self.verifier_chambre_du_meme_hotel(attrs)
        return attrs

    def verifier_chambre_du_meme_hotel(self, attrs):
        """
        La chambre visee doit etre celle de l'etablissement annonce.

        La regle existe deja dans `Reservation.clean()`. Mais une erreur levee
        par `full_clean()` pendant un `save()` n'est pas une erreur de
        validation DRF : elle remonte jusqu'a Django et l'API repond 500. On
        la verifie donc ici, ou elle devient un 400 nomme, comme le veut une
        simple erreur de saisie.

        Le nom du champ differe (`chambre` / `chambre_demandee`), d'ou la
        detection plutot qu'un parametre.
        """
        hotel = attrs.get("hotel") or getattr(self.instance, "hotel", None)
        if hotel is None:
            return

        for nom in ("chambre", "chambre_demandee"):
            if nom not in attrs:
                continue
            chambre = attrs[nom]
            if chambre is not None and chambre.hotel_id != hotel.pk:
                raise serializers.ValidationError({
                    nom: "La chambre n'appartient pas a cet hotel."
                })
            return


class ClientSerializer(serializers.ModelSerializer):
    """ Client Serializer """

    class Meta:
        model = Client
        fields = [
            'id_client',
            'nom',
            'prenom',
            'tel',
            'email',
            'document',
            'preference',
            'sexe',
            'loyalty'
        ]


class ClientInformationSerializer(serializers.ModelSerializer):
    """
    Ce qu'un visiteur sans compte peut donner sur lui-meme.

    Voluntaryment etroit : ni `document`, ni `loyalty`, ni `preference`.
    Le formulaire public declare une identite, il ne demande pas la piece
    d'identite du visiteur et ne lui accorde pas de points de fidelite.
    `sexe` reste facultatif : le modele l'exige en base, mais on ne doit
    pas refuser une reservation pour un champ secondaire.
    """

    class Meta:
        model = Client
        fields = ['nom', 'prenom', 'email', 'tel', 'sexe']
        extra_kwargs = {
            'sexe': {'required': False, 'allow_blank': True},
        }


class ClientPourDemande(serializers.Field):
    """
    `client` accepte deux formes :

        3                                  -> client deja connu (logiciel)
        {"nom": "...", "email": "..."}      -> a creer (formulaire public)

    Pourquoi deux formes : une demande porte toujours un client, mais le
    visiteur du site n'a pas de compte et donc aucune fiche. Impossible de
    "retrouver ou creer" par e-mail : `Client.email` est indexe mais NON
    unique (deux personnes peuvent partager une adresse), donc le premier
    nom venu serait le mauvais. Creer la fiche a chaque demande est le seul
    comportement correct, et c'est ce que fait le modele depuis le début.

    La reponse reste `"client": 3` : la forme envoyee ne change pas la
    forme lue, le logiciel de l'agent n'a rien a adapter.
    """

    default_error_messages = {
        "introuvable": "Client inconnu.",
        "forme_attendue": (
            "Fournir soit un numero de client, soit un objet "
            '{"nom", "prenom", "email", "tel"}.'
        ),
    }

    MARQUEUR = "__client_a_creer__"

    def __init__(self, **kwargs):
        # `serializers.Field` n'accepte pas `queryset` (contrairement aux
        # champs de relation DRF), on le garde donc pour nous.
        self.queryset = kwargs.pop("queryset", None) or Client.objects.all()
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            informations = ClientInformationSerializer(data=data)
            # `is_valid(raise_exception=True)` leve une ValidationError dont
            # le detail est deja au bon format pour la reponse JSON.
            informations.is_valid(raise_exception=True)
            return {self.MARQUEUR: informations.validated_data}
        try:
            return self.queryset.get(pk=data)
        except (Client.DoesNotExist, TypeError, ValueError):
            self.fail("introuvable")

    def to_representation(self, value):
        return value.pk


class DemandeSerializer(_HeuresDeReferenceMixin, serializers.ModelSerializer):
    """ Demande Serializer """

    # Champ declare a la main : il accepte une date seule comme un instant
    # complet (voir ChampPeriode). `hotel` reste avant les dates dans
    # `Meta.fields`, ce dont `_HeuresDeReferenceMixin.validate()` a besoin.
    date_debut = ChampPeriode(
        champ_heure="heure_arrivee",
        heure_par_defaut=time(15, 0),
        help_text="Date seule (AAA-MM-JJ) ou instant complet. Heure par defaut : check-in de l'hotel.",
    )
    date_fin = ChampPeriode(
        champ_heure="heure_depart",
        heure_par_defaut=time(11, 0),
        help_text="Date seule (AAA-MM-JJ) ou instant complet. Heure par defaut : check-out de l'hotel.",
    )
    # Declare a la main pour accepter aussi bien un numero de client (usage
    # agent) qu'un objet d'identite (formulaire public). Voir
    # `ClientPourDemande`.
    client = ClientPourDemande()

    class Meta:
        model = Demande
        fields = [
            'num',
            'hotel',
            'client',
            'chambre_demandee',
            'date_debut',
            'date_fin',
            'nombreDePersonne',
            'statut',
            'date_decision',
            'motif_refus',
            'created_at',
            'updated_at',
        ]
        # La decision appartient au logiciel, pas au client.
        #
        # Sans ce bloc, DRF rendait ces trois champs modifiables : un POST
        # du site public pouvait envoyer "statut": "acceptee" et s'accorder
        # sa propre demande, alors que le modele dit (models.py) que ces
        # champs sont renseignes par sync.services et "jamais par le
        # client". Les champs restent dans la REPONSE, parce que le
        # logiciel a besoin de lire la decision affichee au client.
        read_only_fields = ['statut', 'date_decision', 'motif_refus']

    def create(self, validated_data):
        """
        Cree la demande, et la fiche Client si le formulaire public en a
        envoye une.

        `ClientPourDemande` renvoie soit une instance de Client (usage
        agent), soit un dictionnaire marque. On ne peut pas le laisser
        tel quel dans `Demande.objects.create()` : la cle etrangere
        attend une instance.
        """
        client = validated_data.get("client")
        if isinstance(client, dict):
            client = Client.objects.create(**client[ClientPourDemande.MARQUEUR])
            validated_data["client"] = client
        return Demande.objects.create(**validated_data)


class ReservationSerializer(_HeuresDeReferenceMixin, serializers.ModelSerializer):
    """ Reservation Serializer """

    date_debut = ChampPeriode(
        champ_heure="heure_arrivee",
        heure_par_defaut=time(15, 0),
        help_text="Date seule (AAA-MM-JJ) ou instant complet. Heure par defaut : check-in de l'hotel.",
    )
    date_fin = ChampPeriode(
        champ_heure="heure_depart",
        heure_par_defaut=time(11, 0),
        help_text="Date seule (AAA-MM-JJ) ou instant complet. Heure par defaut : check-out de l'hotel.",
    )

    class Meta:
        model = Reservation
        fields = [
            'num',
            'hotel',
            'client',
            'chambre',
            'demande',
            'date_debut',
            'date_fin',
            'nombreDePersonne',
            'statut',
            'created_at',
            'updated_at',
        ]