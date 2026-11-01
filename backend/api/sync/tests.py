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
from reservations.models import Client, Demande, Reservation
from sync import services
from sync.models import JournalSync, SyncCursor

# `date_debut` / `date_fin` sont des INSTANTS : arrivee a 15 h, depart a
# 11 h, les heures de reference de l'hotel.
HEURE_ARRIVEE = dt.time(15, 0)
HEURE_DEPART = dt.time(11, 0)


def instant(annee, mois, jour, heure=HEURE_ARRIVEE):
    """Instant UTC, comme stocke par Django (TIME_ZONE = "UTC")."""
    return dt.datetime(annee, mois, jour, heure.hour, heure.minute, tzinfo=dt.UTC)


D1 = instant(2026, 10, 1)
D2 = instant(2026, 10, 5, HEURE_DEPART)


class BaseHotel(TestCase):
    """Hotel avec 3 chambres Double + un client."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=3, nombre_chambres=0,
        )
        cls.type_double = TypeDeChambre.objects.create(
            label="Double", prix="90.00", capacite=2
        )
        cls.type_simple = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=1
        )
        cls.chambre_101 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="101", etage=1
        )
        cls.chambre_102 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="102", etage=1
        )
        cls.chambre_103 = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type_double, numero="103", etage=1
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

    def demander(self, chambre_demandee=None, debut=D1, fin=D2, personnes=1):
        return Demande.objects.create(
            hotel=self.hotel, client=self.guest, chambre_demandee=chambre_demandee,
            date_debut=debut, date_fin=fin, nombreDePersonne=personnes,
        )


class DisponibiliteTests(BaseHotel):
    """Calcul des chambres libres."""

    def test_all_rooms_free_when_no_reservation(self):
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, nombre_personne=1, limite=10
        )
        self.assertEqual(len(dispo), 3)

    def test_reserved_room_is_excluded(self):
        self.reserver(self.chambre_101)
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertNotIn("101", numeros)
        self.assertEqual(len(numeros), 2)

    def test_cancelled_reservation_frees_the_room(self):
        r = self.reserver(self.chambre_101)
        r.statut = Reservation.STATUT_ANNULEE
        r.save()
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertIn("101", numeros)

    def test_maintenance_room_is_excluded(self):
        self.chambre_101.statut = Chambre.STATUT_MAINTENANCE
        self.chambre_101.save()
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertNotIn("101", numeros)

    def test_pending_demandes_do_not_block_any_room(self):
        # Difference cle avec l'ancien modele : une demande n'a pas de
        # chambre attribuee, donc elle ne peut rien bloquer. Avant la
        # separation, il fallait une liste de statuts bloquants pour
        # expliquer ce cas.
        for _ in range(3):
            self.demander(self.chambre_101)
        self.assertEqual(
            len(services.chambres_disponibles(self.hotel, D1, D2, limite=10)), 3
        )

    def test_room_outside_the_period_is_free(self):
        self.reserver(self.chambre_101, instant(2026, 6, 1), instant(2026, 6, 3, HEURE_DEPART))
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertIn("101", numeros)

    def test_touching_periods_do_not_overlap(self):
        # Cas limite : depart le 1er a 11 h puis entree le 1er a 15 h. C'est
        # ce qui casse si on utilise <= au lieu de <, maintenant que les
        # deux bornes sont des instants et non des jours.
        self.reserver(
            self.chambre_101, instant(2026, 9, 28), instant(2026, 10, 1, HEURE_DEPART)
        )
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, limite=10
            )
        }
        self.assertIn("101", numeros)

    def test_early_arrival_on_a_departure_day_is_not_free(self):
        # Le depart est a 11 h : une arrivee a 9 h le meme jour trouve la
        # chambre encore occupee, elle ne doit pas etre proposee. C'est
        # precisement ce que la seule date ne permettait pas de voir.
        self.reserver(
            self.chambre_101, instant(2026, 9, 28), instant(2026, 10, 1, HEURE_DEPART)
        )
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel,
                instant(2026, 10, 1, dt.time(9, 0)),
                instant(2026, 10, 3, HEURE_DEPART),
                limite=10,
            )
        }
        self.assertNotIn("101", numeros)

    def test_late_arrival_on_a_departure_day_is_free(self):
        # Arrivee a 22 h, apres le check-out de 11 h : la chambre est libre.
        self.reserver(
            self.chambre_101, instant(2026, 9, 28), instant(2026, 10, 1, HEURE_DEPART)
        )
        numeros = {
            c.numero for c in services.chambres_disponibles(
                self.hotel,
                instant(2026, 10, 1, dt.time(22, 0)),
                instant(2026, 10, 3, HEURE_DEPART),
                limite=10,
            )
        }
        self.assertIn("101", numeros)

    def test_capacity_filters_rooms(self):
        Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type_simple, numero="104", etage=1
        )
        self.assertIn("104", [
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, nombre_personne=1, limite=10
            )
        ])
        # 2 personnes : la Simple (capacite 1) est exclue.
        self.assertNotIn("104", [
            c.numero for c in services.chambres_disponibles(
                self.hotel, D1, D2, nombre_personne=2, limite=10
            )
        ])

    def test_rooms_are_sorted_by_price(self):
        # Une chambre moins chere doit passer devant : l'agent propose
        # ainsi les options les plus accessibles pour le client.
        Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type_simple, numero="104", etage=1
        )
        dispo = services.chambres_disponibles(self.hotel, D1, D2, limite=10)
        prix = [float(c.type_chambre.prix) for c in dispo]
        self.assertEqual(prix, sorted(prix))
        # 104 (Simple, 50) d'abord, puis les 3 Double (90) par numero.
        self.assertEqual(
            [c.numero for c in dispo], ["104", "101", "102", "103"]
        )

    def test_limit_returns_at_most_three(self):
        self.assertEqual(
            len(services.chambres_disponibles(self.hotel, D1, D2, limite=3)), 3
        )

    def test_no_room_available_returns_empty_list(self):
        for c in (self.chambre_101, self.chambre_102, self.chambre_103):
            self.reserver(c)
        self.assertEqual(
            services.chambres_disponibles(self.hotel, D1, D2, limite=3), []
        )

    def test_inverted_period_returns_empty(self):
        # Garde-fou : pas de crash si le site envoie des dates inversees.
        self.assertEqual(services.chambres_disponibles(self.hotel, D2, D1), [])

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
        r = self.reserver(self.chambre_101)
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, limite=10, exclure=r
        )
        self.assertIn("101", [c.numero for c in dispo])


class FileAttenteTests(BaseHotel):
    """File des demandes vues par l'agent."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.autre = Hotel.objects.create(
            name="Autre", adresse="a", ville="v", tel="t", email="x@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )
        cls.chambre_autre = Chambre.objects.create(
            hotel=cls.autre, type_chambre=cls.type_simple, numero="999", etage=1
        )

    def test_pending_demande_appears_in_the_queue(self):
        self.demander(self.chambre_101)
        self.assertEqual(services.demandes_en_attente(self.hotel).count(), 1)

    def test_accepted_demande_leaves_the_queue(self):
        d = self.demander(self.chambre_101)
        services.valider_demande(d, chambre=self.chambre_101)
        self.assertEqual(services.demandes_en_attente(self.hotel).count(), 0)

    def test_refused_demande_leaves_the_queue(self):
        d = self.demander(self.chambre_101)
        services.valider_demande(d, refusee=True, motif="Complet")
        self.assertEqual(services.demandes_en_attente(self.hotel).count(), 0)

    def test_queue_is_scoped_to_one_hotel(self):
        # Un hotel ne doit pas voir la file d'un autre.
        self.demander(self.chambre_101)
        Demande.objects.create(
            hotel=self.autre, client=self.guest,
            chambre_demandee=self.chambre_autre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )
        self.assertEqual(services.demandes_en_attente(self.hotel).count(), 1)
        self.assertEqual(services.demandes_en_attente(self.autre).count(), 1)

    def test_cursor_filters_out_already_seen_items(self):
        import time as _t

        from django.utils import timezone

        moment = timezone.now()
        # Une demande anterieure au curseur n'est pas renvoyee.
        d = self.demander(self.chambre_101)
        Demande.objects.filter(pk=d.pk).update(updated_at=moment)
        _t.sleep(0.01)
        self.assertEqual(
            services.demandes_en_attente(self.hotel, depuis=moment).count(), 0
        )
        # Celle creee apres le curseur est renvoyee.
        self.demander(self.chambre_101)
        self.assertEqual(
            services.demandes_en_attente(self.hotel, depuis=moment).count(), 1
        )


class ValidationTests(BaseHotel):
    """Decision de l'agent : accepter ou refuser une demande."""

    def setUp(self):
        self.demande = self.demander(self.chambre_101, personnes=2)

    def test_accepting_creates_a_reservation(self):
        d = services.valider_demande(self.demande, chambre=self.chambre_101)
        d.refresh_from_db()
        self.assertEqual(d.statut, Demande.STATUT_ACCEPTEE)
        self.assertIsNotNone(d.date_decision)
        # L'acceptation ne modifie pas la demande : elle cree une reservation.
        r = d.reservation_creee
        self.assertEqual(r.chambre, self.chambre_101)
        self.assertEqual(r.statut, Reservation.STATUT_CONFIRMEE)
        self.assertEqual(r.demande, d)
        self.assertEqual(r.date_debut, D1)
        self.assertEqual(r.nombreDePersonne, 2)

    def test_agent_can_assign_another_room(self):
        d = services.valider_demande(self.demande, chambre=self.chambre_102)
        r = d.reservation_creee
        self.assertEqual(r.chambre, self.chambre_102)
        # Le choix du client reste trace sur la demande.
        self.assertEqual(d.chambre_demandee, self.chambre_101)
        # Et la chambre initialement demandee reste libre.
        self.assertEqual(self.chambre_101.reservations.count(), 0)

    def test_refusing_creates_no_reservation(self):
        d = services.valider_demande(
            self.demande, refusee=True, motif="Plus de chambre disponible"
        )
        d.refresh_from_db()
        self.assertEqual(d.statut, Demande.STATUT_REFUSEE)
        self.assertIn("Plus de chambre", d.motif_refus)
        self.assertIsNone(d.reservation_creee)
        self.assertEqual(Reservation.objects.count(), 0)
        self.assertEqual(self.chambre_101.reservations.count(), 0)

    def test_decision_without_room_or_refusal_is_rejected(self):
        with self.assertRaises(ValidationError):
            services.valider_demande(self.demande)

    def test_room_and_refusal_together_is_rejected(self):
        with self.assertRaises(ValidationError):
            services.valider_demande(
                self.demande, chambre=self.chambre_101, refusee=True
            )

    def test_cannot_decide_twice(self):
        # Deux agents qui traitent la meme demande : le second est refuse.
        services.valider_demande(self.demande, chambre=self.chambre_101)
        with self.assertRaises(ValidationError):
            services.valider_demande(self.demande, chambre=self.chambre_102)
        # Une seule reservation n'a ete creee.
        self.assertEqual(Reservation.objects.count(), 1)

    def test_cannot_accept_an_occupied_room(self):
        # La chambre a ete prise entre-temps.
        self.reserver(self.chambre_102)
        with self.assertRaises(ValidationError):
            services.valider_demande(self.demande, chambre=self.chambre_102)
        # La demande reste en attente, pas dans un etat incoherent.
        self.demande.refresh_from_db()
        self.assertTrue(self.demande.est_en_attente)
        self.assertEqual(Reservation.objects.count(), 1)  # celle d'avant

    def test_cannot_accept_a_maintenance_room(self):
        self.chambre_101.statut = Chambre.STATUT_MAINTENANCE
        self.chambre_101.save()
        with self.assertRaises(ValidationError):
            services.valider_demande(self.demande, chambre=self.chambre_101)

    def test_cannot_accept_a_room_with_insufficient_capacity(self):
        petit = TypeDeChambre.objects.create(
            label="Solo", prix="40.00", capacite=1
        )
        chambre_solo = Chambre.objects.create(
            hotel=self.hotel, type_chambre=petit, numero="104", etage=1
        )
        with self.assertRaises(ValidationError):
            # La demande est pour 2 personnes.
            services.valider_demande(self.demande, chambre=chambre_solo)

    def test_accepted_room_blocks_those_dates(self):
        services.valider_demande(self.demande, chambre=self.chambre_101)
        dispo = services.chambres_disponibles(
            self.hotel, D1, D2, nombre_personne=2, limite=10
        )
        self.assertNotIn("101", [c.numero for c in dispo])


class SyncCursorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )

    def test_one_cursor_per_device(self):
        from django.db import IntegrityError, transaction

        SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                SyncCursor.objects.create(hotel=self.hotel, appareil="pc-01")

    def test_same_device_name_in_two_hotels(self):
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
        instant = timezone.now()
        curseur.marquer_consulte(instant)
        curseur.refresh_from_db()
        self.assertEqual(curseur.derniere_consultation, instant)
        self.assertEqual(curseur.nombre_appels, 1)


class JournalSyncTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="h@h.dev",
            nombre_etages=1, nombre_chambres=1,
        )
        cls.type = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=1
        )
        cls.chambre = Chambre.objects.create(
            hotel=cls.hotel, type_chambre=cls.type, numero="101", etage=1
        )
        cls.guest = Client.objects.create(
            nom="D", prenom="M", tel="06", email="m@m.dev", sexe="F"
        )
        cls.demande = Demande.objects.create(
            hotel=cls.hotel, client=cls.guest, chambre_demandee=cls.chambre,
            date_debut=D1, date_fin=D2, nombreDePersonne=1,
        )

    def test_journal_records_a_successful_decision(self):
        JournalSync.objects.create(
            hotel=self.hotel, demande=self.demande, appareil="pc-01",
            action="Confirmer", succes=True, detail="Chambre 101 attribuee",
        )
        journal = JournalSync.objects.get(demande=self.demande)
        self.assertTrue(journal.succes)
        self.assertEqual(journal.appareil, "pc-01")

    def test_journal_records_failures_with_details(self):
        # Un echec doit etre consultable : c'est ce qui permet de
        # repondre a "le logiciel ne me propose aucune chambre".
        JournalSync.objects.create(
            hotel=self.hotel, demande=self.demande, appareil="pc-01",
            action="Confirmer", succes=False,
            detail="La chambre 101 n'est plus libre sur cette periode",
        )
        echec = JournalSync.objects.get(succes=False)
        self.assertIn("plus libre", echec.detail)
        self.assertEqual(echec.appareil, "pc-01")

    def test_journal_is_ordered_newest_first(self):
        # Horodatages poses explicitement : on teste le TRI, pas la
        # resolution de l'horloge.
        from datetime import timedelta

        from django.utils import timezone

        base = timezone.now()
        ancien = JournalSync.objects.create(
            hotel=self.hotel, demande=self.demande, action="Propositions"
        )
        recent = JournalSync.objects.create(
            hotel=self.hotel, demande=self.demande, action="Erreur", succes=False
        )
        JournalSync.objects.filter(pk=ancien.pk).update(horodatage=base)
        JournalSync.objects.filter(pk=recent.pk).update(
            horodatage=base + timedelta(minutes=5)
        )
        self.assertEqual(JournalSync.objects.first().action, "Erreur")
        self.assertEqual(JournalSync.objects.last().action, "Propositions")
