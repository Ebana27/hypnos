"""
Les dates de sejour deviennent des INSTANTS (heure precise).

`date_debut` / `date_fin` passent de DateField a DateTimeField, sur Demande
comme sur Reservation : une reservation se fait a une heure donnee, pas
seulement a un jour.

La conversion remplit les lignes deja enregistrees avec les heures de
reference de l'hotel (check-in 15 h, check-out 11 h par defaut). Sans cette
migration de donnees, les reservations existantes se retrouveraient a
minuit : deux clients qui se suivent le meme jour ne seraient plus
separes que par l'heure, et les listes de l'admin afficheraient 00:00.

Cette migration depend de hotels.0003 : elle a besoin des colonnes
`heure_arrivee` / `heure_depart` pour choisir les heures de remplissage.
"""

from datetime import time

from django.db import migrations, models

HEURE_ARRIVEE_DEFAUT = time(15, 0)
HEURE_DEPART_DEFAUT = time(11, 0)

# (modele, colonne d'arrivee, colonne de depart)
PERIODES = [
    ("demande", "date_debut", "date_fin"),
    ("reservation", "date_debut", "date_fin"),
]


def _heures_de_reference(apps, hotel_id):
    """Heure d'arrivee et heure de depart de l'hotel concerne."""
    Hotel = apps.get_model("hotels", "Hotel")

    hotel = Hotel.objects.filter(pk=hotel_id).only(
        "heure_arrivee", "heure_depart"
    ).first()
    if hotel is None:
        return HEURE_ARRIVEE_DEFAUT, HEURE_DEPART_DEFAUT
    return (
        getattr(hotel, "heure_arrivee", None) or HEURE_ARRIVEE_DEFAUT,
        getattr(hotel, "heure_depart", None) or HEURE_DEPART_DEFAUT,
    )


def _ecrire(modele, ligne_pk, colonne, moment):
    modele.objects.filter(pk=ligne_pk).update(**{colonne: moment})


def _horodater(modele, arrivee_colonne, depart_colonne, apps):
    """Met chaque ligne a l'heure de check-in / check-out de son hotel.

    On boucle ligne par ligne parce qu'il faut l'hotel de chacune : un
    seul UPDATE ne peut pas. Le volume est celui d'un etablissement, un
    aller-retour par ligne est largement acceptable.
    """
    lignes = modele.objects.all().only("pk", "hotel_id", arrivee_colonne, depart_colonne)
    for ligne in lignes.iterator():
        arrivee, depart = _heures_de_reference(apps, ligne.hotel_id)
        _ecrire(
            modele,
            ligne.pk,
            arrivee_colonne,
            getattr(ligne, arrivee_colonne).replace(
                hour=arrivee.hour, minute=arrivee.minute, second=0, microsecond=0
            ),
        )
        _ecrire(
            modele,
            ligne.pk,
            depart_colonne,
            getattr(ligne, depart_colonne).replace(
                hour=depart.hour, minute=depart.minute, second=0, microsecond=0
            ),
        )


def _tronquer(schema_editor, modele, *colonnes):
    """Operation inverse : on ne garde que le jour, l'heure disparait.

    Impossible de passer par l'ORM ici. A ce stade du rollback les colonnes
    sont encore des DateTimeField, et SQLite recopierait tel quel le texte
    "2026-10-02 00:00:00" dans la colonne redevenue DateField : la valeur
    deviendrait illisible et le modele renverrait None. On ecrit donc le
    seul jour, "2026-10-02", que DateField sait lire.
    """
    table = schema_editor.quote_name(modele._meta.db_table)
    for colonne in colonnes:
        nom = schema_editor.quote_name(colonne)
        schema_editor.execute(
            "UPDATE %s SET %s = substr(%s, 1, 10)" % (table, nom, nom)
        )


def vers_les_instants(apps, schema_editor):
    tables = {
        "demande": apps.get_model("reservations", "Demande"),
        "reservation": apps.get_model("reservations", "Reservation"),
    }
    for nom, arrivee, depart in PERIODES:
        _horodater(tables[nom], arrivee, depart, apps)


def revenir_aux_dates(apps, schema_editor):
    tables = {
        "demande": apps.get_model("reservations", "Demande"),
        "reservation": apps.get_model("reservations", "Reservation"),
    }
    for nom, arrivee, depart in PERIODES:
        _tronquer(schema_editor, tables[nom], arrivee, depart)


class Migration(migrations.Migration):

    dependencies = [
        ("reservations", "0001_initial"),
        ("hotels", "0003_hotel_heures_reference"),
    ]

    operations = [
        migrations.AlterField(
            model_name="demande",
            name="date_debut",
            field=models.DateTimeField(
                help_text="Instant d'arrivee prevu (check-in de l'hotel si le client n'a pas precise l'heure)."
            ),
        ),
        migrations.AlterField(
            model_name="demande",
            name="date_fin",
            field=models.DateTimeField(
                help_text="Instant de depart prevu (check-out de l'hotel si le client n'a pas precise l'heure)."
            ),
        ),
        migrations.AlterField(
            model_name="reservation",
            name="date_debut",
            field=models.DateTimeField(
                help_text="Arrivee effective du client (check-in de l'hotel par defaut)."
            ),
        ),
        migrations.AlterField(
            model_name="reservation",
            name="date_fin",
            field=models.DateTimeField(
                help_text="Depart effectif du client (check-out de l'hotel par defaut)."
            ),
        ),
        migrations.RunPython(vers_les_instants, revenir_aux_dates),
    ]