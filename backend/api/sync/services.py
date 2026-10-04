"""
Regles metier de la synchronisation.

Ce module contient la logique, volontairement hors de `views.py` pour que
les tests puissent l'appeler directement sans passer par HTTP.

Flux, tel qu'il decoule du schema Hypnos :

    1. Le client reserve EN LIGNE depuis le site web. La demande est
       enregistree comme DEMANDE (statut "en_attente") : elle porte la
       chambre souhaitee mais AUCUNE chambre attribuee.
    2. Le logiciel desktop interroge l'API : "Des demandes en attente ?"
    3. L'API repond oui et renvoie la file d'attente.
    4. L'agent valide. Si la chambre demandee est occupee ou en
       maintenance, l'API lui propose 3 chambres libres alternatives.
    5. L'agent accepte ou refuse :
         - acceptation  -> une RESERVATION est creee, la chambre est bloquee
         - refus        -> la demande passe a "refusee", rien n'est bloque

Avant la separation Demande / Reservation, une "reservation sans chambre"
servait de demande : il fallait alors un statut bloquant, une chambre
nullable, et une contrainte "confirmee implique une chambre". Ces
contournements ont disparu.
"""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Exists, OuterRef
from django.utils import timezone

from hotels.models import Chambre
from reservations.models import Demande, Reservation

# Statuts qui bloquent une chambre. Une reservation annulee ou terminee ne
# bloque plus rien.
STATUTS_BLOQUANTS = [
    Reservation.STATUT_CONFIRMEE,
    Reservation.STATUT_TERMINEE,
]


def chambres_occupantes(chambre, date_debut, date_fin, exclure=None):
    """
    Reservations actives qui bloquent une chambre sur la plage donnee.

    `date_debut` et `date_fin` sont des INSTANTS (check-in / check-out), pas
    des dates : deux intervalles [a1,b1] et [a2,b2] se chevauchent si
    a1 < b2 ET a2 < b1. Les bornes sont exclues, donc la chambre reste
    libre entre le depart de l'un et l'arrivee de l'autre -- soit, avec un
    check-out a 11 h et un check-in a 15 h, une journee de transition
    possible, et pas davantage.

    Les Demandes n'apparaissent pas ici : par construction elles n'ont pas
    de chambre attribuee, donc elles ne bloquent rien tant que l'agent n'a
    pas repondu.
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

    La comparaison se fait sur les instants (voir chambres_occupantes).

    Le tri est par prix croissant puis par numero, afin que les 3
    propositions proposees a l'agent soient les plus accessibles.

    `exclure` : une Reservation a ne pas prendre en compte dans le calcul
    (utilise quand on propose des alternatives a une reservation qu'on
    edite).
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


def demandes_en_attente(hotel, depuis=None):
    """
    File d'attente affichee a l'agent : les demandes du site web qui n'ont
    pas encore recu de reponse.

    `depuis` = horodatage du curseur du poste. Si fourni, seules les
    demandes creees ou modifiees apres cet instant sont renvoyees, ce qui
    evite de renvoyer toute la file a chaque ouverture du logiciel.
    """
    qs = Demande.objects.filter(hotel=hotel, statut=Demande.STATUT_EN_ATTENTE)
    if depuis is not None:
        qs = qs.filter(updated_at__gt=depuis)

    return qs.select_related(
        "client", "chambre_demandee", "chambre_demandee__type_chambre"
    ).order_by("date_debut")


def valider_demande(demande, chambre=None, refusee=False, motif=""):
    """
    Applique la decision de l'agent sur une demande.

    Trois cas :
        - `chambre` fournie  : une Reservation est creee, la demande passe
                               a "acceptee". La chambre bloquee les dates.
        - `refusee=True`     : la demande passe a "refusee" avec le motif,
                               aucune chambre n'est bloquee.
        - ni l'un ni l'autre : erreur, la demande reste en attente.

    Renvoie la Demande mise a jour (et la Reservation creee, dans le cas
    d'une acceptation) via l'attribut `demande.reservation_creee`.

    L'operation est atomique ET la chambre est verifiee sous verrou : deux
    agents qui traitent la meme demande au meme moment ne peuvent pas
    attribuer deux fois la meme chambre, ni creer deux reservations.
    """
    if chambre is None and not refusee:
        raise ValidationError(
            "Il faut soit une chambre, soit un refus explicite pour valider."
        )
    if chambre is not None and refusee:
        raise ValidationError(
            "On ne peut pas attribuer une chambre ET refuser en meme temps."
        )
    if not demande.est_en_attente:
        raise ValidationError(
            f"La demande #{demande.num} a deja recu une reponse "
            f"({demande.get_statut_display()})."
        )

    if refusee:
        demande.statut = Demande.STATUT_REFUSEE
        demande.motif_refus = motif[:255] if motif else ""
        demande.date_decision = timezone.now()
        # save() appelle full_clean() : dates, hotel et chambre demandee
        # restent valides a ce stade.
        demande.save()
        demande.reservation_creee = None
        return demande

    with transaction.atomic():
        # select_for_update serialise les deux agents sur CETTE demande.
        verrou = Demande.objects.select_for_update().get(pk=demande.pk)
        if not verrou.est_en_attente:
            raise ValidationError(
                f"La demande #{verrou.num} vient d'etre traitee par un autre agent."
            )

        # La chambre est reverifiee sous verrou : elle a pu etre prise ou
        # passee en maintenance depuis que les propositions ont ete
        # calculees.
        chambre_fraiche = Chambre.objects.select_for_update().get(pk=chambre.pk)
        if chambre_fraiche.hotel_id != demande.hotel_id:
            raise ValidationError(
                f"La chambre {chambre_fraiche.numero} n'appartient pas a cet hotel."
            )
        if chambre_fraiche.statut != Chambre.STATUT_DISPONIBLE:
            raise ValidationError(
                f"La chambre {chambre_fraiche.numero} est en maintenance, "
                f"elle ne peut pas etre attribuee."
            )
        if chambre_fraiche.type_chambre.capacite < demande.nombreDePersonne:
            raise ValidationError(
                f"La chambre {chambre_fraiche.numero} n'accepte que "
                f"{chambre_fraiche.type_chambre.capacite} personne(s)."
            )
        if chambres_occupantes(
            chambre_fraiche, demande.date_debut, demande.date_fin
        ).exists():
            raise ValidationError(
                f"La chambre {chambre_fraiche.numero} n'est plus libre sur "
                f"cette periode."
            )

        # La Reservation herite de la demande. Sa propre clean() revérifie
        # la coherence hotel / chambre et l'absence de double occupation.
        reservation = Reservation(
            hotel_id=demande.hotel_id,
            client=demande.client,
            chambre=chambre_fraiche,
            demande=verrou,
            date_debut=demande.date_debut,
            date_fin=demande.date_fin,
            nombreDePersonne=demande.nombreDePersonne,
            statut=Reservation.STATUT_CONFIRMEE,
        )
        reservation.save()

        verrou.statut = Demande.STATUT_ACCEPTEE
        verrou.date_decision = timezone.now()
        verrou.save(update_fields=["statut", "date_decision", "updated_at"])

    demande.statut = Demande.STATUT_ACCEPTEE
    demande.date_decision = verrou.date_decision
    demande.reservation_creee = reservation
    return demande
