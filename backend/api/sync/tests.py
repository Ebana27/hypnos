"""
Tests de l'application `sync` (file d'attente, disponibilite, validation).

Ce module teste la LOGIQUE METIER directement (sync.services), sans passer
par HTTP : c'est ici que se trouvent les regles de disponibilite, donc la
majorite des bugs possibles.

Commande locale :  python manage.py test sync
"""

import datetime as dt

from django.core.exceptions import ValidationError
from django.test import TestCase

from hotels.models import Chambre, Hotel, TypeDeChambre
from reservations.models import Client, Reservation
from sync import services
from sync.models import JournalSync, SyncCursor

D1 = dt.date(2026, 10, 1)
D2 = dt.date(2026, 10, 5)


class DisponibiliteTests(TestCase):
    """Calcul des chambres libres."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=3, nombre_chambres=0,
        )
        # Type "Simple" a 50 EUR, 1 personne.
        cls.type_simple = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=1
        )
        # Type "Double" a 90 EUR, 2 personnes.
        cls.type_double = TypeDeChambre.objects.create(
            label="Double", prix="90.00", capacite=2
        )
        cls.chambre_101 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_simple, numero="101", etage=1
        )
        cls.chambre_102 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="102", etage=1
        )
        cls.chambre_103 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="103", etage=1
        )
        cls.chambre_104 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="104", etage=1
        )
        cls.guest = Client.objects.create(
            nom="Dupont", prenom="Marie", tel="0600000000",
            email="marie@mail.dev", sexe="F",
        )

    def reserver(self, chambre, debut=D1, fin=D2, statut=Reservation.STATUT_CONFIRMEE):
        return Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=chambre,
            date_debut=debut, date_fin=fin, nombreDePersonne=1, statut=statut,
        )

    def test_all_rooms_free_when_no_reservation(self):
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, nombre_personne=1, limite=10
        )
        self.assertEqual(len(dispo), 4)

    def test_reserved_room_is_excluded(self):
        self.reserver(self.chambre_101)
        numeros = {
            c.numero
            for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertNotIn("101", numeros)
        self.assertEqual(len(numeros), 3)

    def test_cancelled_reservation_frees_the_room(self):
        resa = self.reserver(self.chambre_101)
        resa.statut = Reservation.STATUT_ANNULEE
        resa.save()
        numeros = {
            c.numero
            for c in services.chambres_disponibles(self.hotel, D1, D2, limite=10)
        }
        self.assertIn("101", numeros)

    def test_maintenance_room_is_excluded(self):
        self.chambre_101.statut = Chambre.STATUT_MAINTENANCE
        self.chambre_101.save()
        numeros = {
            c.numero
            for c in services.chambres_disponibles(self.hotel, D1, D2, limite=10)
        }
        self.assertNotIn("101", numeros)

    def test_room_outside_the_period_is_free(self):
        # Reservation en juin, on cherche en octobre : la chambre est libre.
        self.reserver(self.chambre_101, dt.date(2026, 6, 1), dt.date(2026, 6, 3))
        numeros = {
            c.numero
            for c in services.chambres_disponibles(self.hotel, D1, D2, limite=10)
        }
        self.assertIn("101", numeros)

    def test_touching_periods_do_not_overlap(self):
        # Une sortie le 1er et une entree le 1er : compatible.
        # C'est le cas limite qui casse si on utilise <= au lieu de <.
        self.reserver(
            self.chambre_101, dt.date(2026, 9, 28), dt.date(2026, 10, 1)
        )
        numeros = {
            c.numero
            for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertIn("101", numeros)

    def test_capacity_filters_rooms(self):
        # 2 personnes : la chambre Simple (capacite 1) est exclue.
        numeros = {
            c.numero
            for c in services.chambres_disponibles(
                self.hotel, D1, D2, nombre_personne=2, limite=10
            )
        }
        self.assertNotIn("101", numeros)
        self.assertIn("102", numeros)

    def test_rooms_are_sorted_by_price(self):
        # La moins chere d'abord, pour que l'agent propose les 3 meilleur
        # choix. 101 (50 EUR) avant 102 (90 EUR).
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, limite=10
        )
        prix = [float(c.type_chambre.prix) for c in dispo]
        self.assertEqual(prix, sorted(prix))
        self.assertEqual(dispo[0].numero, "101")

    def test_limit_returns_at_most_three(self):
        # C'est la demande fonctionnelle : 3 propositions.
        self.assertEqual(
            len(services.chambres_disponibles(self.hotel, D1, D2, limite=3)), 3
        )

    def test_no_room_available_returns_empty_list(self):
        for chambre in [self.chambre_101, self.chambre_102,
                        self.chambre_103, self.chambre_104]:
            self.reserver(chambre)
        self.assertEqual(
            services.chambres_disponibles(self.hotel, D1, D2, limite=3), []
        )

    def test_inverted_period_returns_empty(self):
        # Garde-fou : pas de crash si le site envoie des dates inversees.
        self.assertEqual(
            services.chambres_disponibles(self.hotel, D2, D1), []
        )

    def test_rooms_of_another_hotel_are_not_proposed(self):
        autre = Hotel.objects.create(
            name="Autre", adresse="a", ville="v", tel="t", email="x@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )
        Chambre.objects.create(
            hotel=autre, type_chambre=self.type_double, numero="999", etage=1
        )
        numeros = {
            c.numero
            for c in services.chambres_disponibles(self.hotel, D1, D2, limite=99)
        }
        self.assertNotIn("999", numeros)

    def test_exclude_lets_a_reservation_be_reconsidered(self):
        # Quand l'agent change de chambre, la chambre qu'il quitte ne doit
        # pas rester bloquee par sa propre reservation.
        resa = self.reserver(self.chambre_101)
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, limite=10, exclure=resa
        )
        self.assertIn("101", [c.numero for c in dispo])


class FileAttenteTests(TestCase):
    """File des pseudo-reservations vues par l'agent."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )
        cls.autre = Hotel.objects.create(
            name="Autre", adresse="a", ville="v", tel="t", email="x@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )
        cls.type = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=2
        )
        cls.chambre = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type, numero="101", etage=1
        )
        cls.guest = Client.objects.create(
            nom="Dupont", prenom="Marie", tel="06", email="m@mail.dev", sexe="F"
        )

    def test_pending_reservation_appears_in_the_queue(self):
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        file = services.pseudo_reservations_en_attente(self.hotel)
        self.assertEqual(file.count(), 1)

    def test_confirmed_reservation_leaves_the_queue(self):
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
            statut=Reservation.STATUT_CONFIRMEE,
        )
        self.assertEqual(
            services.pseudo_reservations_en_attente(self.hotel).count(), 0
        )

    def test_queue_is_scoped_to_one_hotel(self):
        # Un hotel ne doit pas voir la file d'un autre.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        Reservation.objects.create(
            hotel=self.autre, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        self.assertEqual(
            services.pseudo_reservations_en_attente(self.hotel).count(), 1
        )

    def test_cursor_filters_out_already_seen_items(self):
        import time

        from django.utils import timezone

        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        moment = timezone.now()
        time.sleep(0.01)  # SQLite stocke avec une precision de microsecondes
        # Aucune reservation encore, au moment du curseur : file vide.
        self.assertEqual(
            services.pseudo_reservations_en_attente(
                self.hotel, depuis=moment
            ).count(),
            0,
        )
        # Celle creee apres le curseur est renvoyee.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        self.assertEqual(
            services.pseudo_reservations_en_attente(
                self.hotel, depuis=moment
            ).count(),
            1,
        )


class ValidationTests(TestCase):
    """Decision de l'agent : confirmer ou refuser."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=2, nombre_chambres=0,
        )
        cls.type = TypeDeChambre.objects.create(
            label="Double", prix="90.00", capacite=2
        )
        cls.chambre_101 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type, numero="101", etage=1
        )
        cls.chambre_102 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type, numero="102", etage=1
        )
        cls.guest = Client.objects.create(
            nom="Dupont", prenom="Marie", tel="06", email="m@mail.dev", sexe="F"
        )
        cls.pseudo = Reservation.objects.create(
            hotel=cls.hotel, client=cls.guest, chambre_demandee=cls.chambre_101,
            date_debut=D1, date_fin=D2, nombreDePersonne=2,
        )

    def test_confirming_assigns_the_room(self):
        resa = services.valider_reservation(self.pseudo, chambre=self.chambre_101)
        resa.refresh_from_db()
        self.assertEqual(resa.statut, Reservation.STATUT_CONFIRMEE)
        self.assertEqual(resa.chambre, self.chambre_101)
        self.assertIsNotNone(resa.date_decision)

    def test_agent_can_assign_a_different_room(self):
        resa = services.valider_reservation(self.pseudo, chambre=self.chambre_102)
        resa.refresh_from_db()
        self.assertEqual(resa.chambre, self.chambre_102)
        # La demande initiale reste tracee.
        self.assertEqual(resa.chambre_demandee, self.chambre_101)
        # Et la chambre demandee est restee libre.
        self.assertEqual(self.chambre_101.reservations.count(), 0)

    def test_refusal_cancels_without_blocking_a_room(self):
        resa = services.valider_reservation(
            self.pseudo, refusee=True, motif="Plus de chambre disponible"
        )
        resa.refresh_from_db()
        self.assertEqual(resa.statut, Reservation.STATUT_ANNULEE)
        self.assertIsNone(resa.chambre)
        self.assertIn("Plus de chambre", resa.motif_refus)
        self.assertEqual(self.chambre_101.reservations.count(), 0)

    def test_decision_without_room_or_refusal_is_rejected(self):
        with self.assertRaises(ValidationError):
            services.valider_reservation(self.pseudo)

    def test_cannot_confirm_into_an_occupied_room(self):
        # La chambre a ete prise entre-temps par une autre reservation.
        Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre=self.chambre_102,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
            statut=Reservation.STATUT_CONFIRMEE,
        )
        with self.assertRaises(ValidationError):
            services.valider_reservation(self.pseudo, chambre=self.chambre_102)
        # La reservation reste en attente, pas dans un etat incoherent.
        self.pseudo.refresh_from_db()
        self.assertEqual(self.pseudo.statut, Reservation.STATUT_EN_ATTENTE)
        self.assertIsNone(self.pseudo.chambre)

    def test_cannot_confirm_into_a_maintenance_room(self):
        self.chambre_101.statut = Chambre.STATUT_MAINTENANCE
        self.chambre_101.save()
        with self.assertRaises(ValidationError):
            services.valider_reservation(self.pseudo, chambre=self.chambre_101)

    def test_cannot_confirm_a_room_with_insufficient_capacity(self):
        petit = TypeDeChambre.objects.create(
            label="Solo", prix="40.00", capacite=1
        )
        chambre_solo = Chambre.objects.create(
            hotel=self.hotel, type_chambre=petit, numero="103", etage=1
        )
        with self.assertRaises(ValidationError):
            # La reservation est pour 2 personnes.
            services.valider_reservation(self.pseudo, chambre=chambre_solo)

    def test_confirmed_reservation_blocks_those_dates(self):
        services.valider_reservation(self.pseudo, chambre=self.chambre_101)
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, nombre_personne=2, limite=10
        )
        self.assertNotIn("101", [c.numero for c in dispo])


class SyncCursorTests(TestCase):
    def setUp(self):
        self.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )

    def test_one_cursor_per_device(self):
        SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")
        with self.assertRaises(Exception):
            SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")

    def test_same_device_name_in_two_hotels(self):
        # Un poste peut theoriquement servir deux hotels.
        autre = Hotel.objects.create(
            name="A", adresse="a", ville="v", tel="t", email="a@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )
        SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")
        SyncCursor.objects.create(hotel=autre, appareil="pc-01")
        self.assertEqual(SyncCursor.objects.filter(appareil="pc-01").count(), 2)

    def test_marquer_consulte_advances_the_cursor(self):
        from django.utils import timezone

        curseur = SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")
        self.assertIsNone(curseur.derniere_consultation)
        services_avant = timezone.now()
        curseur.marquer_consulte(services_avant)
        curseur.refresh_from_db()
        self.assertEqual(curseur.derniere_consultation, services_avant)
        self.assertEqual(curseur.nombre_appels, 1)


class JournalSyncTests(TestCase):
    def setUp(self):
        self.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )
        self.type = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=1
        )
        self.chambre = Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type, numero="101", etage=1
        )
        self.guest = Client.objects.create(
            nom="D", prenom="M", tel="06", email="m@m.dev", sexe="F"
        )
        self.pseudo = Reservation.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=self.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )

    def test_journal_records_a_successful_decision(self):
        JournalSync.objects.create(
            hotel=self.hotel, reservation=self.pseudo, appareil="pc-01",
            action="Confirmer", succes=True, detail="Chambre 101 attribuee",
        )
        journal = JournalSync.objects.get(reservation=self.pseudo)
        self.assertTrue(journal.succes)
        self.assertEqual(journal.appareil, "pc-01")

    def test_journal_is_ordered_newest_first(self):
        # Les horodatages sont poses explicitement : on teste le TRI, pas
        # la resolution de l'horloge (deux insertions en memetime CPU
        # peuvent partager la meme microseconde).
        from datetime import timedelta

        from django.utils import timezone

        base = timezone.now()
        ancien = JournalSync.objects.create(
            hotel=self.hotel, reservation=self.pseudo, action="Propositions"
        )
        recent = JournalSync.objects.create(
            hotel=self.hotel, reservation=self.pseudo, action="Erreur", succes=False
        )
        JournalSync.objects.filter(pk=ancien.pk).update(horodatage=base)
        JournalSync.objects.filter(pk=recent.pk).update(
            horodatage=base + timedelta(minutes=5)
        )

        self.assertEqual(JournalSync.objects.first().action, "Erreur")
        self.assertEqual(JournalSync.objects.last().action, "Propositions")

    def test_journal_records_failures_with_details(self):
        # Un echec doit etre consultable : c'est ce qui permet de
        # repondre a "le logiciel ne me propose aucune chambre".
        JournalSync.objects.create(
            hotel=self.hotel, reservation=self.pseudo, appareil="pc-01",
            action="Confirmer", succes=False,
            detail="La chambre 101 n'est plus libre sur cette periode",
        )
        echec = JournalSync.objects.get(succes=False)
        self.assertIn("plus libre", echec.detail)
        self.assertEqual(echec.appareil, "pc-01")
