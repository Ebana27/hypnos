"""
Tests de l'application `reservations` (Client, Demande, Reservation).

Commande locale :  python manage.py test reservations
"""

import datetime as dt

from django.contrib.auth.models import AbstractBaseUser
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from hotels.models import Chambre, Hotel, TypeDeChambre
from hotels.serializers import HotelSerializer
from reservations.models import Client, Demande, Reservation
from reservations.serializers import DemandeSerializer, ReservationSerializer

# `date_debut` / `date_fin` sont des INSTANTS. On se cale sur les heures de
# reference d'un hotel : arrivee a 15 h, depart a 11 h.
HEURE_ARRIVEE = dt.time(15, 0)
HEURE_DEPART = dt.time(11, 0)


def instant(annee, mois, jour, heure=HEURE_ARRIVEE):
    """Instant UTC, comme stocke par Django (TIME_ZONE = "UTC")."""
    return dt.datetime(annee, mois, jour, heure.hour, heure.minute, tzinfo=dt.UTC)


D1 = instant(2026, 10, 1)
D2 = instant(2026, 10, 5, HEURE_DEPART)


class ClientModelTests(TestCase):
    """Client est une fiche invite, PAS un compte."""

    def test_client_has_no_password_field(self):
        noms = {f.name for f in Client._meta.get_fields()}
        self.assertNotIn("password", noms)

    def test_client_is_not_an_auth_user(self):
        # Il ne doit surtout pas heriter de AbstractUser, sinon allauth et
        # JWT le traiteraient comme un compte.
        self.assertFalse(issubclass(Client, AbstractBaseUser))

    def test_same_email_can_reserve_twice(self):
        # Une fiche par demande : l'email n'est pas unique.
        for i in range(2):
            Client.objects.create(
                nom="Dupont", prenom=f"Marie{i}", tel="0600000000",
                email="marie@mail.dev", sexe="F",
            )
        self.assertEqual(Client.objects.filter(email="marie@mail.dev").count(), 2)


class BaseFixtures(TestCase):
    """Hotel avec deux chambres, un type, un client."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="Hotel Test", adresse="1 rue Test", ville="Paris",
            tel="0102030405", email="h@h.dev",
            nombre_etages=3, nombre_chambres=2,
        )
        cls.type_double = TypeDeChambre.objects.create(
            label="Double", prix="89.90", capacite=2
        )
        cls.chambre_101 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="101", etage=1
        )
        cls.chambre_102 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="102", etage=2
        )
        cls.guest = Client.objects.create(
            nom="Dupont", prenom="Marie", tel="0600000000",
            email="marie@mail.dev", sexe="F",
        )


class DemandeTests(BaseFixtures):
    """
    Une DEMANDE est ce que le site web envoie : des dates et une chambre
    souhaitee, mais aucune chambre attribuee.
    """

    def test_demande_has_no_attributed_room(self):
        d = Demande.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=2,
        )
        self.assertTrue(d.est_en_attente)
        # Le point central de la separation : ce modele n'a meme pas de
        # champ `chambre`. Impossible d'y loger une reservation.
        self.assertNotIn("chambre", {f.name for f in Demande._meta.get_fields()})
        self.assertEqual(d.chambre_demandee, self.chambre_101)

    def test_demande_does_not_block_the_requested_room(self):
        # Tant que l'agent n'a pas repondu, rien n'est bloque : deux
        # demandes sur la meme chambre coexistent en attente.
        for _ in range(2):
            Demande.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
                date_debut=D1, date_fin=D2, nombreDePersonne=1,
            )
        self.assertEqual(
            Demande.objects.filter(chambre_demandee=self.chambre_101).count(), 2
        )

    def test_demande_without_requested_room_is_allowed(self):
        # Le client peut reserver sans choisir de chambre.
        d = Demande.objects.create(
            hotel=self.hotel, client=self.guest, date_debut=D1, date_fin=D2,
            nombreDePersonne=1,
        )
        self.assertIsNone(d.chambre_demandee)

    def test_capacity_is_checked_on_the_requested_room(self):
        # Erreur detectee a la demande, pas au moment de la validation.
        with self.assertRaises(ValidationError):
            Demande.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
                date_debut=D1, date_fin=D2, nombreDePersonne=9,
            )

    def test_end_date_must_be_after_start_date(self):
        with self.assertRaises(ValidationError):
            Demande.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
                date_debut=instant(2026, 11, 10), date_fin=instant(2026, 11, 1),
                nombreDePersonne=1,
            )

    def test_same_day_depart_after_arrival_is_refused(self):
        # Arrivee a 20 h puis depart le meme jour a 11 h : le depart est
        # anterieur a l'arrivee, meme si les deux tombent le meme jour.
        with self.assertRaises(ValidationError) as ctx:
            Demande.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
                date_debut=instant(2026, 11, 10, dt.time(20, 0)),
                date_fin=instant(2026, 11, 10, HEURE_DEPART),
                nombreDePersonne=1,
            )
        self.assertIn("date_fin", ctx.exception.message_dict)

    def test_database_check_constraint_enforces_date_order(self):
        # Bypass clean() : on ecrit en SQL brut, seule la base peut arreter.
        d = Demande.objects.create(
            hotel=self.hotel, client=self.guest, date_debut=D1, date_fin=D2,
            nombreDePersonne=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Demande.objects.filter(pk=d.pk).update(
                    date_debut=instant(2026, 12, 10), date_fin=instant(2026, 12, 1)
                )

    def test_deleting_client_is_blocked_while_demandes_exist(self):
        from django.db.models import ProtectedError

        Demande.objects.create(
            hotel=self.hotel, client=self.guest, date_debut=D1, date_fin=D2,
            nombreDePersonne=1,
        )
        with self.assertRaises(ProtectedError):
            self.guest.delete()


class CoherenceHotelTests(BaseFixtures):
    """
    Incoherence 2 corrigee : l'hotel de l'objet et l'hotel de sa chambre
    doivent etre le meme.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.autre_hotel = Hotel.objects.create(
            name="Autre", adresse="b", ville="Lyon", tel="0606", email="a@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )
        cls.chambre_ailleurs = Chambre.objects.create(
            hotel=cls.autre_hotel, type_chambre=cls.type_double,
            numero="999", etage=1,
        )

    def test_demande_cannot_reference_a_room_from_another_hotel(self):
        with self.assertRaises(ValidationError) as ctx:
            Demande.objects.create(
                hotel=self.hotel, client=self.guest,
                chambre_demandee=self.chambre_ailleurs,
                date_debut=D1, date_fin=D2, nombreDePersonne=1,
            )
        # L'erreur est rapportee sur le bon champ.
        self.assertIn("chambre_demandee", ctx.exception.message_dict)

    def test_reservation_cannot_reference_a_room_from_another_hotel(self):
        with self.assertRaises(ValidationError) as ctx:
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_ailleurs,
                date_debut=D1, date_fin=D2, nombreDePersonne=1,
            )
        self.assertIn("chambre", ctx.exception.message_dict)

    def test_matching_hotel_is_accepted(self):
        d = Demande.objects.create(
            hotel=self.hotel, client=self.guest,
            chambre_demandee=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        self.assertEqual(d.hotel, self.chambre_101.hotel)


class ReservationRulesTests(BaseFixtures):
    """Une Reservation existe toujours avec une chambre attribuee."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.reservation = Reservation.objects.create(
            hotel=cls.hotel, client=cls.guest, chambre=cls.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=2,
        )

    def test_chambre_is_mandatory(self):
        # La colonne est NOT NULL : plus besoin de la contrainte
        # "confirmee implique une chambre", elle est structurelle.
        # bulk_create() construit l'INSERT directement, donc sans passer par
        # save()/full_clean() : c'est bien la BASE qui refuse.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Reservation.objects.bulk_create([
                    Reservation(
                        hotel=self.hotel, client=self.guest, chambre=None,
                        date_debut=D1, date_fin=D2, nombreDePersonne=1,
                    )
                ])

    def test_default_status_is_confirmed(self):
        self.assertEqual(self.reservation.statut, Reservation.STATUT_CONFIRMEE)

    def test_end_date_must_be_after_start_date(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
                date_debut=instant(2026, 11, 10), date_fin=instant(2026, 11, 1),
                nombreDePersonne=1,
            )

    def test_cannot_exceed_room_capacity(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
                date_debut=instant(2026, 11, 10), date_fin=instant(2026, 11, 12),
                nombreDePersonne=9,
            )

    def test_overlapping_reservation_is_rejected(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
                date_debut=instant(2026, 10, 3), date_fin=instant(2026, 10, 7),
                nombreDePersonne=1,
            )

    def test_arriving_before_the_checkout_hour_is_rejected(self):
        # La chambre 101 est occupee jusqu'au 5 a 11 h. Un client qui arrive
        # le 5 a 9 h tombe dans la vacation : c'est refuse. Avec de simples
        # dates (jour, pas instant) la regle l'aurait laisse passer, puisque
        # le 5 etait jour de sortie.
        with self.assertRaises(ValidationError) as ctx:
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
                date_debut=instant(2026, 10, 5, dt.time(9, 0)),
                date_fin=instant(2026, 10, 8),
                nombreDePersonne=1,
            )
        self.assertIn("chambre", ctx.exception.message_dict)

    def test_arriving_after_the_checkout_hour_is_allowed(self):
        # Sortie le 5 a 11 h, entree le 5 a 22 h : la chambre est libre
        # depuis 11 h, l'arrivee tardive passe.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=instant(2026, 10, 5, dt.time(22, 0)),
            date_fin=instant(2026, 10, 8),
            nombreDePersonne=1,
        )
        self.assertEqual(self.chambre_101.reservations.count(), 2)

    def test_adjacent_reservation_is_allowed(self):
        # Sortie le 5 a 11 h, entree le 5 a 15 h : la journee de transition.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=instant(2026, 10, 5), date_fin=instant(2026, 10, 8),
            nombreDePersonne=1,
        )
        self.assertEqual(self.chambre_101.reservations.count(), 2)

    def test_number_of_nights_counts_nights_not_hours(self):
        # Arrivee le 1er a 22 h, depart le 3 a 11 h : 2 nuits, meme si la
        # premiere est raccourcie par l'heure d'arrivee.
        r = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
            date_debut=instant(2026, 10, 1, dt.time(22, 0)),
            date_fin=instant(2026, 10, 3, HEURE_DEPART),
            nombreDePersonne=1,
        )
        self.assertEqual(r.nombre_de_nuits, 2)

    def test_cancelled_reservation_frees_the_room(self):
        self.reservation.statut = Reservation.STATUT_ANNULEE
        self.reservation.save()
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )

    def test_reservation_keeps_a_link_to_its_demande(self):
        d = Demande.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_102,
            date_debut=D1, date_fin=D2, nombreDePersonne=2,
        )
        r = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
            date_debut=D1, date_fin=D2, nombreDePersonne=2, demande=d,
        )
        # Traçabilite : la reservation est bien issue de cette demande.
        self.assertEqual(r.demande, d)
        self.assertIn(r, d.reservations.all())
        # Et une reservation saisie en direct n'en a pas.
        self.assertIsNone(self.reservation.demande)


class PeriodeSerializerTests(BaseFixtures):
    """
    Le champ `date_debut` / `date_fin` de l'API accepte deux formes :
    une date seule (on applique l'heure de l'hotel) ou un instant complet
    (on garde l'heure demandee). C'est ce qui permet au site public, qui ne
    propose que deux dates, et a l'agent, qui saisit une heure reelle, de
    passer par le meme champ.
    """

    def _donnees_demande(self, **champs):
        base = {
            "hotel": self.hotel.pk,
            "client": self.guest.pk,
            "chambre_demandee": self.chambre_101.pk,
            "date_debut": "2026-10-01",
            "date_fin": "2026-10-05",
            "nombreDePersonne": 2,
        }
        base.update(champs)
        return base

    def test_date_seule_recoit_lheure_de_lhotel(self):
        serializer = DemandeSerializer(data=self._donnees_demande())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        # 15 h d'arrivee, 11 h de depart : les heures de reference creees
        # par hotels.0003.
        self.assertEqual(
            serializer.validated_data["date_debut"], instant(2026, 10, 1)
        )
        self.assertEqual(
            serializer.validated_data["date_fin"], instant(2026, 10, 5, HEURE_DEPART)
        )

    def test_instant_complet_est_conserve(self):
        serializer = DemandeSerializer(
            data=self._donnees_demande(
                date_debut="2026-10-01T22:30:00", date_fin="2026-10-05T09:00:00"
            )
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["date_debut"],
            instant(2026, 10, 1, dt.time(22, 30)),
        )
        self.assertEqual(
            serializer.validated_data["date_fin"], instant(2026, 10, 5, dt.time(9, 0))
        )

    def test_heures_de_lhotel_modifiees_sont_utilisees(self):
        # Un etablissement qui ouvre tard (discotheque, aeroport) regle ses
        # heures dans l'admin : le site public doit suivre automatiquement.
        self.hotel.heure_arrivee = dt.time(20, 0)
        self.hotel.heure_depart = dt.time(12, 0)
        self.hotel.save()

        serializer = DemandeSerializer(data=self._donnees_demande())
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["date_debut"], instant(2026, 10, 1, dt.time(20, 0))
        )
        self.assertEqual(
            serializer.validated_data["date_fin"], instant(2026, 10, 5, dt.time(12, 0))
        )

    def test_format_invalide_is_refused(self):
        serializer = DemandeSerializer(data=self._donnees_demande(date_debut="01/10/2026"))
        self.assertFalse(serializer.is_valid())
        self.assertIn("date_debut", serializer.errors)

    def test_sortie_avant_arrivee_est_refusee(self):
        serializer = DemandeSerializer(
            data=self._donnees_demande(date_debut="2026-10-05", date_fin="2026-10-01")
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("date_fin", serializer.errors)

    def test_modification_sans_hotel_reutilise_lhotel_de_lenregistrement(self):
        # PATCH sur une reservation existante : le client ne renvoie que la
        # date de depart, l'heure de check-out de l'hotel doit s'appliquer.
        r = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        serializer = ReservationSerializer(r, data={"date_fin": "2026-10-08"}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(
            serializer.validated_data["date_fin"], instant(2026, 10, 8, HEURE_DEPART)
        )

    def test_reponse_json_expose_linstant(self):
        r = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        donnees = ReservationSerializer(r).data
        self.assertEqual(donnees["date_debut"], "2026-10-01T15:00:00+00:00")
        self.assertEqual(donnees["date_fin"], "2026-10-05T11:00:00+00:00")


class DemandePubliqueApiTests(BaseFixtures):
    """
    Le formulaire du site public, en HTTP, sans compte.

    Ce que verifie cette classe, c'est la frontiere : ce qu'un visiteur SANS
    jeton a le droit de faire (envoyer une demande, avec son nom), et ce qu'il
    n'a pas le droit de faire (lire les demandes de l'hotel, se servir une
    reponse).
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.manager = User.objects.create_user(
            username="manager", email="manager@h.dev", password="MotDePasse123!",
            hotel=cls.hotel, role=User.ROLE_MANAGER,
        )

    def setUp(self):
        self.client = APIClient()

    def formulaire(self, **champs):
        """Le corps qu'envoie le site : des coordonnees, pas de client."""
        return {
            "hotel": self.hotel.pk,
            "date_debut": "2026-10-01",
            "date_fin": "2026-10-05",
            "nombreDePersonne": 2,
            "chambre_demandee": self.chambre_101.pk,
            "client": {
                "nom": "Martin", "prenom": "Lucie",
                "email": "lucie@exemple.dev", "tel": "0600000000", "sexe": "F",
            },
**champs,
        }

    def test_un_visiteur_peut_envoyer_une_demande_sans_compte(self):
        reponse = self.client.post("/api/demandes/", self.formulaire(), format="json")
        self.assertEqual(reponse.status_code, 201, reponse.data)

        demande = Demande.objects.get()
        # Le client n'existait pas : il est cree dans la meme requete, sinon le
        # formulaire public devrait d'abord fabriquer un compte.
        self.assertEqual(demande.client.nom, "Martin")
        # En attente, sans reservation : personne n'a repondu.
        self.assertTrue(demande.est_en_attente)
        self.assertEqual(Reservation.objects.count(), 0)
        # 15 h et 11 h : les heures de reference de l'hotel, pas minuit.
        self.assertEqual(demande.date_debut, D1)
        self.assertEqual(demande.date_fin, D2)

    def test_un_visiteur_ne_peut_pas_s_auto_accorder_ni_lire(self):
        # Le champ est envoye en connaissance de cause : le serveur l'ignore.
        reponse = self.client.post(
            "/api/demandes/",
            self.formulaire(statut=Demande.STATUT_ACCEPTEE),
            format="json",
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertTrue(Demande.objects.get().est_en_attente)
        self.assertEqual(Reservation.objects.count(), 0)

        # La POST est ouverte, la lecture ne l'est pas : ouvrir toute la vue
        # aurait publie la liste des demandes de tous les hotels.
        self.assertEqual(self.client.get("/api/demandes/").status_code, 401)

    def test_le_visiteur_ne_peut_pas_non_plus_supprimer(self):
        demande = Demande.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=2,
        )
        reponse = self.client.delete(f"/api/demandes/{demande.num}/")
        self.assertEqual(reponse.status_code, 401)
        self.assertTrue(Demande.objects.filter(pk=demande.pk).exists())

    def test_le_client_peut_etre_donne_par_son_identifiant(self):
        # Le logiciel de l'hotel renvoie la fiche existente au lieu d'en creer
        # une nouvelle a chaque envoi.
        reponse = self.client.post(
            "/api/demandes/", self.formulaire(client=self.guest.pk), format="json"
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(Demande.objects.get().client, self.guest)
        self.assertEqual(Client.objects.count(), 1)


class CloisonnementEcritureTests(BaseFixtures):
    """
    Un ecrit ne peut pas viser un autre etablissement.

    Le filtrage des listes (HotelProprietaireMixin) suffit pour la LECTURE.
    Pour l'ECRITURE, il faut une regle de plus : `POST /api/chambres/` accepte
    un champ `hotel`, et un agent qui envoie l'identifiant d'un autre hotel
    ecirait sinon chez le voisin.
    """

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.autre_hotel = Hotel.objects.create(
            name="Hotel Voisin", adresse="2 rue", ville="Lyon",
            tel="02", email="voisin@h.dev", nombre_etages=1, nombre_chambres=1,
        )
        cls.manager = User.objects.create_user(
            username="manager", email="manager@h.dev", password="MotDePasse123!",
            hotel=cls.hotel, role=User.ROLE_MANAGER,
        )

    def setUp(self):
        self.client = APIClient()
        from accounts.tests import jeton_acces

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {jeton_acces(self.manager)}"
)

    def test_un_agent_ne_voit_pas_les_chambres_du_voisin(self):
        chambre_voisine = Chambre.objects.create(
            hotel=self.autre_hotel, type_chambre=self.type_double,
            numero="999", etage=1,
        )
        # 404 et non 403 : on ne confirme pas l'existence de la chambre.
        reponse = self.client.get(f"/api/chambres/{chambre_voisine.pk}/")
        self.assertEqual(reponse.status_code, 404)

    def test_un_agent_ecrit_bien_dans_son_propre_hotel(self):
        # Le pendant du test du dessus : la regle ne doit pas tout interdire.
        reponse = self.client.post("/api/chambres/", {
            "hotel": self.hotel.pk, "numero": "103", "etage": 1,
            "type_chambre": self.type_double.pk, "statut": Chambre.STATUT_DISPONIBLE,
        })
        self.assertEqual(reponse.status_code, 201, reponse.data)
        self.assertEqual(Chambre.objects.get(numero="103").hotel, self.hotel)

    def test_une_reservation_ne_peut_pas_pointer_vers_une_chambre_du_voisin(self):
        # Meme piege par la reservation : une chambre de l'hotel B dans une
        # reservation de l'hotel A rendrait le comptage des chambres faux.
        chambre_voisine = Chambre.objects.create(
            hotel=self.autre_hotel, type_chambre=self.type_double,
numero="999", etage=1,
        )
        reponse = self.client.post("/api/reservations/", {
            "client": self.guest.pk,
            "hotel": self.hotel.pk,
            "chambre": chambre_voisine.pk,
            "date_debut": "2026-10-01", "date_fin": "2026-10-05",
            "nombreDePersonne": 1, "statut": Reservation.STATUT_CONFIRMEE,
        })
        self.assertEqual(reponse.status_code, 400, reponse.data)
        self.assertIn("chambre", reponse.data)
        self.assertEqual(Reservation.objects.count(), 0)


class HeuresHotelApiTests(BaseFixtures):
    """L'API des hotels expose les heures de reference."""

    def test_les_heures_de_reference_sont_exposees(self):
        donnees = HotelSerializer(self.hotel).data
        self.assertEqual(donnees["heure_arrivee"], "15:00:00")
        self.assertEqual(donnees["heure_depart"], "11:00:00")

        self.hotel.heure_arrivee = dt.time(14, 30)
        self.hotel.heure_depart = dt.time(10, 0)
        donnees = HotelSerializer(self.hotel).data
        self.assertEqual(donnees["heure_arrivee"], "14:30:00")
        self.assertEqual(donnees["heure_depart"], "10:00:00")
