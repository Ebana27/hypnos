"""
Serializers de la synchronisation.

Trois vues, trois formes de reponse, toutes construites sur `sync.services`
qui porte la regle metier. Ces serializers ne font que mettre en forme ce que
les services renvoient : aucune decision ici.
"""

from rest_framework import serializers

from hotels.serializers import ChambreSerializer
from reservations.serializers import DemandeSerializer, ReservationSerializer


class DemandeEnAttenteSerializer(DemandeSerializer):
    """
    Une demande de la file d'attente, avec les seules informations dont
    l'agent a besoin pour repondre.

    Herite de DemandeSerializer, donc les dates sortent deja en instant avec
    l'heure de check-in / check-out : l'agent voit "15:00 -> 11:00" et non
    deux dates nues, et peut juger si le client a demande une heure tardive.
    """

    class Meta(DemandeSerializer.Meta):
        pass


class PropositionSerializer(serializers.Serializer):
    """
    Une chambre libre proposee en remplacement de celle demandee.

    Le prix est envoye avec la chambre parce que l'agent arbitre sur le prix :
    proposer trois chambres dont deux hors budget ne lui sert a rien.
    `est_equivalente` signale si la proposition a exactement la meme
    capacite que le type demande, donc si le client ne verrait aucune
    difference.
    """

    chambre = ChambreSerializer()
    type_label = serializers.CharField()
    capacite = serializers.IntegerField()
    prix = serializers.DecimalField(max_digits=10, decimal_places=2)
    est_equivalente = serializers.BooleanField()


class ValiderDemandeSerializer(serializers.Serializer):
    """
    Decision de l'agent.

    Deux formes exclusives :
        {"chambre": 12}                    -> on accepte, une reservation est creee
        {"refusee": true, "motif": "..."}  -> on refuse, rien n'est bloque

    Ni l'un ni l'autre est une erreur : c'est la seule facon d'accepter
    (`sync.services.valider_demande` leve une ValidationError). Le message
    d'erreur du service est renvoye tel quel, il est deja en francais et
    dit precisement ce qui coince (chambre occupee, en maintenance, trop
    petite...).
    """

    chambre = serializers.IntegerField(required=False)
    refusee = serializers.BooleanField(required=False, default=False)
    motif = serializers.CharField(required=False, allow_blank=True, max_length=255)


class DecisionSerializer(serializers.Serializer):
    """Ce que renvoie `valider` : la demande decidee, et la reservation creee."""

    demande = DemandeSerializer()
    reservation = ReservationSerializer(allow_null=True)