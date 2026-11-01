"""
Heures de reference de l'etablissement.

Les reservations portent des instants (voir reservations.0002) ; quand le
client n'envoie qu'une date -- ce que fait le site public -- ce sont ces
deux heures qui sont retenues. 15 h pour le check-in, 11 h pour le check-out.

Modifiable dans l'admin, sur la fiche de l'hotel.
"""

import datetime

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hotels", "0002_rename_name_hotel_nom"),
    ]

    operations = [
        migrations.AddField(
            model_name="hotel",
            name="heure_arrivee",
            field=models.TimeField(
                default=datetime.time(15, 0),
                help_text="Heure de check-in : heure d'arrivee retenue quand le client ne precise pas l'heure.",
            ),
        ),
        migrations.AddField(
            model_name="hotel",
            name="heure_depart",
            field=models.TimeField(
                default=datetime.time(11, 0),
                help_text="Heure de check-out : heure de depart retenue quand le client ne precise pas l'heure.",
            ),
        ),
    ]