"""
Points d'entree HTTP de la synchronisation.

Toute la regle metier vit dans `services.py`, teste directement sans HTTP.
Ces vues ne font que : authentifier, reserver a l'hotel du compte, appeler un
service, mettre le resultat en forme. Aucune decision ici.

Perimetre
---------
La synchronisation ne porte QUE sur les demandes et les reservations, parce que
ce sont les seules choses qui changent d'etat a deux mains : le site public
depose une demande, l'agent y repond. Tout le reste (hotels, chambres, types
de chambre, comptes) se regle dans l'admin et par le proprietaire, et n'a donc
rien a synchroniser.
"""

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import AgentDeTraitement
from hotels.models import Chambre, Hotel
from reservations.models import Demande
from . import services
from .serializers import (
    DemandeEnAttenteSerializer,
    PropositionSerializer,
    ReservationSerializer,
    ValiderDemandeSerializer,
)


class VueSync(APIView):
    """Base commune : reserve a un compte actif qui traite les demandes."""

    permission_classes = [AgentDeTraitement]

    def hotel_de_la_requete(self, request):
        """
        L'hotel dont la file est traitee.

        Un compte ordinaire n'en a qu'un, c'est `request.user.hotel`. Un
        administrateur n'appartient a aucun hotel : il doit nommer celui qu'il
        regarde, sinon il recevrait par defaut les demandes de tous les
        etablissements confondus.

        Renvoie None si aucun hotel n'est designable : c'est une requete
        incomplete, pas interdite, et chaque vue traduit cela en 400.
        """
        if request.user.hotel_id is not None:
            return request.user.hotel

        identifiant = request.query_params.get("hotel")
        if identifiant is None:
            return None
        return get_object_or_404(Hotel, pk=identifiant)

    def demande_de_l_hotel(self, request, num):
        """
        La demande, uniquement si elle appartient a l'hotel traite.

        Filtrer sur le seul `num` laisserait un agent de l'hotel A valider les
        demandes de l'hotel B : c'est ce filtre qui l'empeche, et il doit
        rester.
        """
        return get_object_or_404(
            Demande.objects.filter(hotel=self.hotel_de_la_requete(request)), num=num
        )

    @staticmethod
    def sans_hotel():
        return Response(
            {"detail": "Precisez ?hotel=<id> : un administrateur n'appartient "
                       "a aucun hotel."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class FileAttenteView(VueSync):
    """
    GET /api/sync/demandes/

    Les demandes en attente de l'hotel, de la plus proche dans le temps.

`?depuis=` (horodatage ISO 8601) limite la reponse aux demandes creees ou
        modifiees apres cet instant : le logiciel n'envoie que l'horodatage de son
        dernier rafraichissement au lieu de toute la file a chaque ouverture.

        Ecrire le suffixe `Z` plutot que `+00:00` : dans une chaine de requete
        HTTP, `+` signifie un espace, donc `...?depuis=...T15:00:00+00:00`
        arrive chez Django avec l'offset casse.
        """

    def get(self, request):
        hotel = self.hotel_de_la_requete(request)
        if hotel is None:
            return self.sans_hotel()

        depuis = None
        if request.query_params.get("depuis"):
            depuis = parse_datetime(request.query_params["depuis"])
            if depuis is None:
                return Response(
                    {"detail": "?depuis= doit etre un horodatage ISO 8601."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        demandes = services.demandes_en_attente(hotel, depuis=depuis)
        return Response(DemandeEnAttenteSerializer(demandes, many=True).data)


class PropositionsView(VueSync):
    """
    GET /api/sync/demandes/<num>/propositions/

    Trois chambres libres sur la plage demandee, les moins cheres d'abord,
    pour quand la chambre souhaitee n'est plus disponible.

    Si la chambre demandee est encore libre, la liste est vide et `detail`
    l'explique : l'agent n'a rien a arbitrer.

    La reponse garde TOUJOURS la meme forme, `{"propositions": [...]}`,
    libre ou non. Sans cela le logiciel devrait deviner sur le type de la
    reponse pour savoir s'il a une liste ou un objet a lire.
    """

    def get(self, request, num):
        demande = self.demande_de_l_hotel(request, num)

        if not demande.est_en_attente:
            return Response(
                {"detail": f"La demande #{demande.num} a deja recu une reponse "
                           f"({demande.get_statut_display()})."},
                status=status.HTTP_409_CONFLICT,
            )

        if demande.chambre_demandee is not None and not services.chambres_occupantes(
            demande.chambre_demandee, demande.date_debut, demande.date_fin
        ).exists():
            return Response({
                "detail": "La chambre demandee est encore libre.",
                "propositions": [],
            })

        candidates = services.chambres_disponibles(
            demande.hotel,
            demande.date_debut,
            demande.date_fin,
            nombre_personne=demande.nombreDePersonne,
            limite=3,
        )

        type_demande = (
            demande.chambre_demandee.type_chambre
            if demande.chambre_demandee is not None
            else None
        )
        propositions = [
            {
                "chambre": chambre,
                "type_label": chambre.type_chambre.label,
                "capacite": chambre.type_chambre.capacite,
                "prix": chambre.type_chambre.prix,
                "est_equivalente": (
                    type_demande is not None
                    and chambre.type_chambre_id == type_demande.id_type
                ),
            }
            for chambre in candidates
        ]
        return Response({
            "detail": None,
            "propositions": PropositionSerializer(propositions, many=True).data,
        })


class ValiderDemandeView(VueSync):
    """
    POST /api/sync/demandes/<num>/valider/

    L'agent repond a la demande.

        {"chambre": 12}                    -> acceptation, une reservation est creee
        {"refusee": true, "motif": "..."}  -> refus, aucune chambre n'est bloquee

    La regle vit dans `services.valider_demande`, qui reverifie la chambre sous
    verrou : deux agents ne peuvent pas attribuer la meme chambre, meme en
    traitant la demande au meme instant.

    Toute `ValidationError` du service (chambre occupee, en maintenance, trop
    petite, demande deja traitee) devient un 400 avec son message, pas une 500.
    """

    def post(self, request, num):
        demande = self.demande_de_l_hotel(request, num)

        donnees = ValiderDemandeSerializer(data=request.data)
        donnees.is_valid(raise_exception=True)

        chambre = None
        identifiant = donnees.validated_data.get("chambre")
        if identifiant is not None:
            # `hotel=` dans le filtre : proposer la chambre d'un autre etablissement
            # doit repondre 404, pas tenter une attribution hors perimetre.
            chambre = get_object_or_404(
                Chambre, pk=identifiant, hotel=demande.hotel
            )

        try:
            services.valider_demande(
                demande,
                chambre=chambre,
                refusee=donnees.validated_data["refusee"],
                motif=donnees.validated_data.get("motif", ""),
            )
        except ValidationError as erreur:
            return Response({"detail": erreur.messages},
                            status=status.HTTP_400_BAD_REQUEST)

        reservation = getattr(demande, "reservation_creee", None)
        return Response(
            {
                "demande": DemandeEnAttenteSerializer(demande).data,
                "reservation": ReservationSerializer(reservation).data
                if reservation
                else None,
            }
        )