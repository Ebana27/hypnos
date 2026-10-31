from rest_framework import serializers
from .models import Hotel, TypeDeChambre, Chambre, Personnel

class HotelSerializer(serializers.ModelSerializer):
    """
    Sérialiseur pour le modèle Hotel.

    Ce sérialiseur convertit les instances du modèle Hotel en formats de données 
    natifs (comme JSON) et gère la validation des données entrantes pour la 
    création ou la mise à jour d'établissements hôteliers.
    """
    class Meta:
        model = Hotel
        fields = [
            'hotel_id', 
            'nom', 
            'adresse', 
            'ville', 
            'tel', 
            'email', 
            'nombre_etages', 
            'nombre_chambres',
            # Heures de référence de l'établissement. Sans elles, le
            # logiciel ne pouvait pas régler le check-in / check-out par
            # l'API, alors que ces heures pilotent la conversion des dates
            # seules en instants (voir reservations.serializers.ChampPeriode).
            'heure_arrivee',
            'heure_depart',
        ]

class TypeDeChambreSerializer(serializers.ModelSerializer):
    """ Type de chambre Serializer """
    
    class Meta: 
        model = TypeDeChambre
        fields = [
            'id_type', 
            'label', 
            'prix',
            'capacite'
        ]

class ChambreSerializer(serializers.ModelSerializer):
    """ Chambre Serializer """
    
    class Meta:
        model = Chambre
        fields = [
            'id_chambre',
            'hotel',
            'type_chambre',
            'numero',
            'etage',
            'statut',
        ]

class PersonnelSerializer(serializers.ModelSerializer):
    """ Personnel Serializer """
    
    class Meta:
        model = Personnel
        fields = [
            'matricule',
            'user',
            'nomComplet',
            'sexe',
            'poste',
        ]