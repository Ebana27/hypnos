"""
Tests de l'application `reservations` (Client, Reservation).

Commande locale :  python manage.py test reservations
"""

import datetime as dt

from django.contrib.auth.models import AbstractBaseUser
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from hotels.models import Chambre, Hotel, TypeDeChambre
from reservations.models import Client, Reservation


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
        # Une fiche par reservation : l'email n'est pas unique.
        for i in range(2):
            Client.objects.create(
                nom="Dupont", prenom=f"Marie{i}", tel="0600000000",
                email="marie@mail.dev", sexe="F",
            )
        self.assertEqual(Client.objects.filter(email="marie@mail.dev").count(), 2)


class ReservationRulesTests(TestCase):
    """Regles de gestion : dates, capacite, disponibilite."""

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
        cls.reservation = Reservation.objects.create(
            hotel=cls.hotel, client=cls.guest, chambre=cls.chambre_101,
            date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
            nombreDePersonne=2,
        )

    def test_default_status_is_en_attente(self):
        self.assertEqual(self.reservation.statut, Reservation.STATUT_EN_ATTENTE)

    def test_end_date_must_be_after_start_date(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
                date_debut=dt.date(2026, 11, 10), date_fin=dt.date(2026, 11, 1),
                nombreDePersonne=1,
            )

    def test_cannot_exceed_room_capacity(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
                date_debut=dt.date(2026, 11, 10), date_fin=dt.date(2026, 11, 12),
                nombreDePersonne=9,
            )

    def test_overlapping_reservation_is_rejected(self):
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
                date_debut=dt.date(2026, 10, 3), date_fin=dt.date(2026, 10, 7),
                nombreDePersonne=1,
            )

    def test_adjacent_reservation_is_allowed(self):
        # Sortie le 5, entree le 5 : pas de chevauchement, c'est valide.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=dt.date(2026, 10, 5), date_fin=dt.date(2026, 10, 8),
            nombreDePersonne=1,
        )
        self.assertEqual(self.chambre_101.reservations.count(), 2)

    def test_cancelled_reservation_frees_the_room(self):
        self.reservation.statut = Reservation.STATUT_ANNULEE
        self.reservation.save()
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_101,
            date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
            nombreDePersonne=1,
        )

    def test_database_check_constraint_enforces_date_order(self):
        # Bypass clean() : on ecrit en SQL brut, seule la base peut arreter.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Reservation.objects.filter(pk=self.reservation.pk).update(
                    date_debut=dt.date(2026, 12, 10), date_fin=dt.date(2026, 12, 1)
                )

    def test_deleting_client_is_blocked_while_reservations_exist(self):
        # on_delete=PROTECT : l'historique de facturation est preserve.
        from django.db.models import ProtectedError

        with self.assertRaises(ProtectedError):
            self.guest.delete()


class PseudoReservationTests(TestCase):
    """
    Le site web cree une pseudo-reservation : des dates et une chambre
    demandee, mais aucune chambre attribuee. L'agent la valide ensuite.
    """

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="Hotel Test", adresse="1 rue Test", ville="Paris",
            tel="0102030405", email="h@h.dev",
            nombre_etages=3, nombre_chambres=3,
        )
        cls.type = TypeDeChambre.objects.create(
            label="Double", prix="89.90", capacite=2
        )
        cls.chambre = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type, numero="101", etage=1
        )
        cls.guest = Client.objects.create(
            nom="Dupont", prenom="Marie", tel="0600000000",
            email="marie@mail.dev", sexe="F",
        )

    def test_pseudo_reservation_has_no_room(self):
        # C'est le cas normal d'une demande depuis le site.
        resa = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
            nombreDePersonne=2,
        )
        self.assertTrue(resa.est_pseudo_reservation)
        self.assertIsNone(resa.chambre)
        # La chambre demandee est bien conservee.
        self.assertEqual(resa.chambre_demandee, self.chambre)

    def test_pseudo_reservation_does_not_block_the_requested_room(self):
        # Sans chambre attribuee, elle ne bloque encore aucune chambre :
        # deux demandes sur la meme chambre doivent coexister en attente.
        for _ in range(2):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
                date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
                nombreDePersonne=1,
            )
        self.assertEqual(
            Reservation.objects.filter(chambre_demandee=self.chambre).count(), 2
        )

    def test_capacity_checked_on_requested_room(self):
        # Erreur detectee a la demande, pas au moment de la validation.
        with self.assertRaises(ValidationError):
            Reservation.objects.create(
                hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
                date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
                nombreDePersonne=9,
            )

    def test_confirming_without_room_is_blocked_by_the_database(self):
        # Contrainte SQL : bypass complet de clean() et de save().
        resa = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
            nombreDePersonne=1,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Reservation.objects.filter(pk=resa.pk).update(
                    statut=Reservation.STATUT_CONFIRMEE, chambre=None
                )

    def test_agent_can_assign_another_room(self):
        # L'agent propose une autre chambre : la demande reste tracee.
        autre = Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type, numero="102", etage=1
        )
        resa = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=dt.date(2026, 10, 1), date_fin=dt.date(2026, 10, 5),
            nombreDePersonne=2,
        )
        resa.chambre = autre
        resa.statut = Reservation.STATUT_CONFIRMEE
        resa.save()

        resa.refresh_from_db()
        self.assertFalse(resa.est_pseudo_reservation)
        self.assertEqual(resa.chambre, autre)
        # L'historique de la demande est preserve.
        self.assertEqual(resa.chambre_demandee, self.chambre)
        # Et la chambre initialement demandee reste libre.
        self.assertEqual(self.chambre.reservations.count(), 0)
