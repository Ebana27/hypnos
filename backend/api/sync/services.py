"""
Regles metier de la synchronisation.

Ce module contient la logique, volontairement hors de `views.py` pour que
les tests puissent l'appeler directement sans passer par HTTP.

Rappel du flux tire du schema Hypnos :

    1. Le client reserve EN LIGNE depuis le site web. L'information est
       stockee comme PSEUDO-RESERVATION (statut "en_attente"), avec la
       chambre qu'il a demandee mais sans chambre attribuee.
    2. Le logiciel desktop interroge l'API : "Des reservations en attente ?"
    3. L'API repond oui et renvoie la file d'attente.
    4. L'agent valide. Si la chambre demandee est occupee ou en
       maintenance, l'API lui propose 3 chambres libres alternatives.
    5. L'agent en choisit une (ou refuse). La reservation devient
       "confirmee" et la chambre est bloquee pour ces dates.
"""

from django.db.models import Exists, OuterRef
from django.utils import timezone

from hotels.models import Chambre
from reservations.models import Reservation

# Statuts qui bloquent une chambre. "en_attente" n'entre dans cette liste
# que lorsqu'une chambre a deja ete attribuee (donc reservation validee) :
# une pseudo-reservation sans chambre ne bloque rien.
STATUTS_BLOQUANTS = [
    Reservation.STATUT_EN_ATTENTE,
    Reservation.STATUT_CONFIRMEE,
    Reservation.STATUT_TERMINEE,
]


def chambres_occupantes(chambre, date_debut, date_fin, exclure=None):
    """
    Reservations actives qui bloquent une chambre sur la plage donnee.

    Deux intervalles [a1,b1] et [a2,b2] se chevauchent si a1 < b2 ET a2 < b1.
    Les bornes sont exclues : une sortie le jour de l'entree d'un autre
    client reste possible, sinon la chambre serait bloquee a tort pour la
    nuit de transition.
    """
    qs = Reservation.objects.filter(
        chambre=chambre,
        statut__in=STATUTS_BLOQUANTS,
        date_debut__lt=date_fin,
        date_fin__gt=date_debut,
    )
    if exclure is not None:
        # Permet de proposer des chambres a une reservation qu'on edite,
        # en ignorant sa propre occupation.
        qs = qs.exclude(pk=exclure.pk)
    return qs


def chambres_disponibles(
    hotel, date_debut, date_fin, nombre_personne=1, limite=3, exclure=None
):
    """
    Chambres libres pour un hotel et une plage de dates.

    Est libre une chambre si :
        - elle appartient a l'hotel demande,
        - son statut n'est pas "maintenance",
        - sa capacite suffit pour nombre_personne,
        - aucune reservation active ne la bloque sur la plage.

    Le tri est par prix croissant puis par numero, afin que les 3
    propositions proposees a l'agent soient les plus accessibles.

    `exclure` : une Reservation a ne pas prendre en compte dans le calcul
    (utilise quand on propose des alternatives a une reservation en cours
    de validation).
    """
    if date_fin <= date_debut:
        return []

    occupation = Exists(
        chambres_occupantes(OuterRef("pk"), date_debut, date_fin, exclure=exclure)
    )

    return list(
        Chambre.objects.filter(
            hotel=hotel,
            statut=Chambre.STATUT_DISPONIBLE,
            type_chambre__capacite__gte=nombre_personne,
        )
        .annotate(est_occupe=occupation)
        .filter(est_occupe=False)
        .select_related("type_chambre")
        .order_by("type_chambre__prix", "numero")[:limite]
    )


def pseudo_reservations_en_attente(hotel, depuis=None):
    """
    File d'attente affichee a l'agent : les pseudo-reservations du site web
    qui n'ont pas encore de chambre attribuee.

    `depuis` = horodatage du curseur du poste. Si fourni, seules les
    reservations creees ou modifiees apres cet instant sont renvoyees, ce qui
    evite de renvoyer toute la file a chaque ouverture du logiciel.
    """
    qs = Reservation.objects.filter(
        hotel=hotel,
        statut=Reservation.STATUT_EN_ATTENTE,
        chambre__isnull=True,
    )
    if depuis is not None:
        qs = qs.filter(updated_at__gt=depuis)

    return qs.select_related(
        "client", "chambre_demandee", "chambre_demandee__type_chambre"
    ).order_by("date_debut")


def valider_reservation(reservation, chambre=None, refusee=False, motif=""):
    """
    Applique la decision de l'agent.

    Trois cas :
        - `chambre` fournie  : la reservation passe a "confirmee" et la
                               chambre est bloquee. Si la chambre demandee
                               etait differente, elle reste tracee dans
                               `chambre_demandee`.
        - `refusee=True`     : la reservation passe a "annulee", aucune
                               chambre n'est bloquee.
        - ni l'un ni l'autre : erreur, la reservation reste en attente.

    Lève django.core.exceptions.ValidationError si la chambre proposee
    n'est plus libre (elle a pu etre prise entre temps) : dans ce cas la
    reservation reste en attente et l'agent doit redemander des
    propositions.
    """
    from django.core.exceptions import ValidationError

    if chambre is None and not refusee:
        raise ValidationError(
            "Il faut soit une chambre, soit un refus explicite pour valider."
        )

    if refusee:
        reservation.statut = Reservation.STATUT_ANNULEE
        reservation.chambre = None
        reservation.motif_refus = motif[:255] if motif else ""
        reservation.date_decision = timezone.now()
        # full_clean() est appele par save() et verifie notamment que le
        # statut "confirmee" imply une chambre attribuee.
        reservation.save()
        return reservation

    # Le client a peut-etre demande une chambre deja occupee ou en
    # maintenance. On refuse de valider dans ce cas plutot que de
    # silencieusement attribuer une chambre occupee.
    if chambre.statut != Chambre.STATUT_DISPONIBLE:
        raise ValidationError(
            f"La chambre {chambre.numero} est en maintenance, elle ne peut pas etre attribuee."
        )
    if chambre.type_chambre.capacite < reservation.nombreDePersonne:
        raise ValidationError(
            f"La chambre {chambre.numero} n'accepte que "
            f"{chambre.type_chambre.capacite} personne(s)."
        )
    if chambres_occupantes(chambre, reservation.date_debut, reservation.date_fin).exists():
        raise ValidationError(
            f"La chambre {chambre.numero} n'est plus libre sur cette periode."
        )

    reservation.chambre = chambre
    reservation.statut = Reservation.STATUT_CONFIRMEE
    reservation.date_decision = timezone.now()
    reservation.save()
    return reservation
