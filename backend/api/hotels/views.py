from rest_framework import viewsets
from .models import Hotel, TypeDeChambre, Chambre, Personnel
from .serializers import HotelSerializer, TypeDeChambreSerializer, ChambreSerializer, PersonnelSerializer
from accounts.permissions import (
    HotelParSonIdMixin,
    HotelProprietaireMixin,
    HypnosPermission,
)


class HotelViewSet(HotelParSonIdMixin, viewsets.ModelViewSet):
    # PAGE_SIZE vaut 50 dans les settings, donc la liste est paginee. Sans
    # tri explicite, SQL ne garantit aucun ordre et un meme element peut
    # apparaitre sur deux pages ou disparaitre (UnorderedObjectListWarning).
    # L'attribut `ordering` d'un ViewSet ne suffirait pas : il n'est lu que
    # par OrderingFilter, absent des filter_backends par defaut.
    queryset = Hotel.objects.order_by("hotel_id")
    serializer_class = HotelSerializer
    # `hotel_id` est la cle : un manager ne doit pas pouvoir s'attribuer la
    # main sur l'hotel d'un autre en envoyant son identifiant.
    permission_classes = [HypnosPermission]


class TypeDeChambreViewSet(viewsets.ModelViewSet):
    # Catalogue global : un type de chambre n'appartient a aucun hotel
    # (choix du schema), il n'y a donc rien a filtrer par hotel. Seul le
    # droit d'ecrire reste regle.
    queryset = TypeDeChambre.objects.order_by("id_type")
    serializer_class = TypeDeChambreSerializer
    permission_classes = [HypnosPermission]


class ChambreViewSet(HotelProprietaireMixin, viewsets.ModelViewSet):
    queryset = Chambre.objects.order_by("id_chambre")
    serializer_class = ChambreSerializer
    permission_classes = [HypnosPermission]


class PersonnelViewSet(HotelProprietaireMixin, viewsets.ModelViewSet):
    # `Personnel` n'a pas de colonne `hotel` : le rattachement passe par le
    # compte. D'ou `user__hotel` plutot que `hotel`.
    champ_hotel = "user__hotel"

    queryset = Personnel.objects.order_by("matricule")
    serializer_class = PersonnelSerializer
    permission_classes = [HypnosPermission]