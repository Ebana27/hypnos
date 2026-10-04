from rest_framework import viewsets
from .models import Client, Demande, Reservation
from .serializers import ClientSerializer, DemandeSerializer, ReservationSerializer
from accounts.permissions import (
    DemandePubliquePermission,
    HotelProprietaireMixin,
    HypnosPermission,
)
from config.throttle import DemandePubliqueThrottle


class ClientViewSet(viewsets.ModelViewSet):
    # `Client` n'a pas de colonne `hotel` : une fiche client est globale.
    # Conséquence assumée : un compte authentifié lit tous les clients, et le
    # nom, le prénom et le téléphone de tous les clients de tous les hôtels
    # sont lisibles depuis l'API. Isoler les clients par hôtel demanderait
    # une colonne `hotel` sur la table, donc une migration et une décision de
    # schema : c'est tracé, pas fait en douce.
    queryset = Client.objects.order_by("id_client")
    serializer_class = ClientSerializer
    permission_classes = [HypnosPermission]


class DemandeViewSet(HotelProprietaireMixin, viewsets.ModelViewSet):
    # Seul le POST est ouvert a un visiteur sans compte (le formulaire
    # public). La lecture et la modification restent reservees a l'agent de
    # l'hotel, grace au filtrage du queryset.
    queryset = Demande.objects.order_by("date_debut")
    serializer_class = DemandeSerializer
    permission_classes = [DemandePubliquePermission]
    throttle_classes = [DemandePubliqueThrottle]


class ReservationViewSet(HotelProprietaireMixin, viewsets.ModelViewSet):
    # Aucune reservation ne se cree par l'API publique : une reservation
    # n'existe qu'apres la validation d'une demande par l'agent (voir
    # sync.services.valider_demande). Un `ModelViewSet` complet donnerait
    # au public le droit de bloquer une chambre sans passer par la demande.
    queryset = Reservation.objects.order_by("date_debut")
    serializer_class = ReservationSerializer
    permission_classes = [HypnosPermission]