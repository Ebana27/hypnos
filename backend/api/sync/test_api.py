"""
Tests des points d'entree HTTP de la synchronisation.

`sync/tests.py` teste deja les regles metier en appelant `services`
directement. Ici on ne verifie que ce que les services ne peuvent pas voir :
le droit d'acces et le cloisonnement par etablissement.

Commande locale :  python manage.py test sync
"""

import datetime as dt

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests import jeton_acces
from hotels.models import Chambre, Hotel, TypeDeChambre
from reservations.models import Client, Demande, Reservation


class BaseSync(TestCase):
    """Deux hotels, deux chambres, un agent par hotel, une demande en attente."""

    @classmethod
    def setUpTestData(cls):
        cls.type_double = TypeDeChambre.objects.create(
            label="Double", prix="80.00", capacite=2
        )
        cls.hotel_a = Hotel.objects.create(
            name="A", adresse="1 rue", ville="Paris", tel="01", email="a@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )
        cls.hotel_b = Hotel.objects.create(
            name="B", adresse="2 rue", ville="Lyon", tel="02", email="b@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )

        cls.chambre_a = Chambre.objects.create(
            hotel=cls.hotel_a, type_chambre=cls.type_double, numero="101", etage=1
        )
        cls.chambre_b = Chambre.objects.create(
            hotel=cls.hotel_b, type_chambre=cls.type_double, numero="201", etage=1
        )

        for pseudo, hotel in (("manager_a", cls.hotel_a), ("manager_b", cls.hotel_b)):
            User.objects.create_user(
                username=pseudo, email=f"{pseudo}@h.dev", password="MotDePasse123!",
                hotel=hotel, role=User.ROLE_MANAGER,
            )
        cls.receptionniste_a = User.objects.create_user(
            username="recep_a", email="recep_a@h.dev", password="MotDePasse123!",
            hotel=cls.hotel_a,
        )

        cls.client_hote = Client.objects.create(
            nom="Curie", prenom="Marie", tel="0600000000",
            email="marie@mail.dev", sexe="F",
        )

        cls.debut = dt.datetime(2026, 10, 1, 15, 0, tzinfo=dt.UTC)
        cls.fin = dt.datetime(2026, 10, 5, 11, 0, tzinfo=dt.UTC)

    def setUp(self):
        self.client = APIClient()
        self.manager_a = User.objects.get(username="manager_a")
        self.manager_b = User.objects.get(username="manager_b")
        self.demande_a = Demande.objects.create(
            hotel=self.hotel_a, client=self.client_hote,
            chambre_demandee=self.chambre_a,
            date_debut=self.debut, date_fin=self.fin, nombreDePersonne=2,
        )
        self.demande_b = Demande.objects.create(
            hotel=self.hotel_b, client=self.client_hote,
            chambre_demandee=self.chambre_b,
            date_debut=self.debut, date_fin=self.fin, nombreDePersonne=2,
        )

    def connecter(self, user):
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {jeton_acces(user)}"
        )


class AccesSyncTests(BaseSync):
    """Qui atteint la file de traitement."""

    def test_sans_compte_la_file_est_fermee(self):
        self.assertEqual(self.client.get("/api/sync/demandes/").status_code, 401)

    def test_un_compte_en_lecture_seule_n_atteint_pas_la_file(self):
        # La lecture se fait par l'API des demandes ; la file est l'outil de
        # celui qui repond.
        self.connecter(self.receptionniste_a)
        self.assertEqual(self.client.get("/api/sync/demandes/").status_code, 403)

    def test_la_file_ne_contient_que_l_hotel_du_compte(self):
        self.connecter(self.manager_a)
        data = self.client.get("/api/sync/demandes/").json()
        self.assertEqual([d["num"] for d in data], [self.demande_a.num])

    def test_la_file_d_un_administrateur_exige_un_hotel_nomme(self):
        # Sans `?hotel=`, il ne doit pas recevoir les demandes de tous les
        # etablissements par defaut.
        root = User.objects.create_superuser(
            username="root", email="root@h.dev", password="MotDePasse123!"
        )
        self.connecter(root)
        self.assertEqual(self.client.get("/api/sync/demandes/").status_code, 400)

        data = self.client.get(f"/api/sync/demandes/?hotel={self.hotel_a.pk}").json()
        self.assertEqual([d["num"] for d in data], [self.demande_a.num])


class ValidationSyncTests(BaseSync):
    """La reponse a une demande, et son cloisonnement."""

    def test_un_agent_ne_valide_pas_la_demande_d_un_autre_hotel(self):
        self.connecter(self.manager_a)
        reponse = self.client.post(
            f"/api/sync/demandes/{self.demande_b.num}/valider/",
            {"chambre": self.chambre_b.pk},
        )
        self.assertEqual(reponse.status_code, 404)
        self.assertTrue(Demande.objects.get(pk=self.demande_b.pk).est_en_attente)
        self.assertEqual(Reservation.objects.count(), 0)

    def test_accepter_cree_la_reservation(self):
        self.connecter(self.manager_a)
        reponse = self.client.post(
            f"/api/sync/demandes/{self.demande_a.num}/valider/",
            {"chambre": self.chambre_a.pk},
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)

        reservation = Reservation.objects.get()
        self.assertEqual(reservation.chambre, self.chambre_a)
        # L'agent voit l'instant avec l'heure, pas une date nue.
        self.assertEqual(
            reponse.json()["demande"]["date_debut"], "2026-10-01T15:00:00+00:00"
        )

    def test_refuser_ne_cree_aucune_reservation(self):
        self.connecter(self.manager_a)
        reponse = self.client.post(
            f"/api/sync/demandes/{self.demande_a.num}/valider/",
            {"refusee": True, "motif": "Complet"},
        )
        self.assertEqual(reponse.status_code, 200, reponse.data)
        self.assertEqual(Reservation.objects.count(), 0)
        self.assertIsNone(reponse.json()["reservation"])

    def test_une_chambre_occupee_entre_temps_est_refusee(self):
        # La chambre est libre au moment des propositions, puis un autre
        # agent la prend : la decision echoue, elle n'ecrase pas.
        Reservation.objects.create(
            hotel=self.hotel_a, client=self.client_hote, chambre=self.chambre_a,
            date_debut=self.debut, date_fin=self.fin, nombreDePersonne=2,
            statut=Reservation.STATUT_CONFIRMEE,
        )
        self.connecter(self.manager_a)
        reponse = self.client.post(
            f"/api/sync/demandes/{self.demande_a.num}/valider/",
            {"chambre": self.chambre_a.pk},
        )
        self.assertEqual(reponse.status_code, 400)
        self.assertEqual(Reservation.objects.count(), 1)
        self.assertTrue(Demande.objects.get(pk=self.demande_a.pk).est_en_attente)


class PropositionsSyncTests(BaseSync):
    """Les alternatives proposees quand la chambre demandee est prise."""

    def test_rien_a_proposer_tant_que_la_chambre_demandee_est_libre(self):
        self.connecter(self.manager_a)
        reponse = self.client.get(
            f"/api/sync/demandes/{self.demande_a.num}/propositions/"
        )
        self.assertEqual(reponse.status_code, 200)
        self.assertEqual(reponse.json()["propositions"], [])

    def test_les_moins_cheres_libres_de_l_hotel_seulement(self):
        Reservation.objects.create(
            hotel=self.hotel_a, client=self.client_hote, chambre=self.chambre_a,
            date_debut=self.debut, date_fin=self.fin, nombreDePersonne=2,
            statut=Reservation.STATUT_CONFIRMEE,
        )
        # Le prix porte sur le TYPE de chambre : il faut des types distincts
        # pour que le tri se voie.
        for numero, prix in (("102", "70.00"), ("103", "95.00")):
            Chambre.objects.create(
                hotel=self.hotel_a,
                type_chambre=TypeDeChambre.objects.create(
                    label=f"Type {numero}", prix=prix, capacite=2
                ),
                numero=numero, etage=1,
            )

        self.connecter(self.manager_a)
        propositions = self.client.get(
            f"/api/sync/demandes/{self.demande_a.num}/propositions/"
        ).json()["propositions"]

        self.assertEqual([p["chambre"]["numero"] for p in propositions], ["102", "103"])
        # La chambre B est libre, mais elle n'est jamais proposee a l'hotel A.
        self.assertTrue(
            all(p["chambre"]["hotel"] == self.hotel_a.pk for p in propositions)
        )