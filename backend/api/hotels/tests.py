"""
Tests de l'application `hotels` (Hotel, TypeDeChambre, Chambre, Personnel).

Commande locale :  python manage.py test hotels
"""

from django.core.exceptions import ValidationError
from django.test import TestCase

from hotels.models import Chambre, Hotel, Personnel, TypeDeChambre


class ChambreRulesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="e@h.dev",
            nombre_etages=3, nombre_chambres=0,
        )
        cls.type = TypeDeChambre.objects.create(
            label="Simple", prix="50.00", capacite=1
        )

    def test_floor_cannot_exceed_hotel_height(self):
        with self.assertRaises(ValidationError):
            Chambre.objects.create(
                hotel=self.hotel, type_chambre=self.type, numero="999", etage=99
            )

    def test_room_number_unique_per_hotel(self):
        Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type, numero="101", etage=1
        )
        with self.assertRaises(ValidationError):
            Chambre.objects.create(
                hotel=self.hotel, type_chambre=self.type, numero="101", etage=1
            )

    def test_same_room_number_allowed_in_another_hotel(self):
        autre = Hotel.objects.create(
            name="H2", adresse="a", ville="v", tel="t", email="e2@h.dev",
            nombre_etages=3, nombre_chambres=1,
        )
        Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type, numero="101", etage=1
        )
        Chambre.objects.create(
            hotel=autre, type_chambre=self.type, numero="101", etage=1
        )
        self.assertEqual(Chambre.objects.filter(numero="101").count(), 2)

    def test_actual_room_count_helper(self):
        # nombre_chambres est saisi a la main et peut deriver du reel.
        self.hotel.nombre_chambres = 12
        self.hotel.save()
        Chambre.objects.create(
            hotel=self.hotel, type_chambre=self.type, numero="101", etage=1
        )
        self.assertEqual(self.hotel.nombre_chambres_reel(), 1)
        self.assertEqual(self.hotel.nombre_chambres, 12)


class PersonnelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="e@h.dev",
            nombre_etages=2, nombre_chambres=0,
        )

    def test_personnel_without_account_is_allowed(self):
        # Un employe peut ne pas avoir de compte technique.
        p = Personnel.objects.create(
            hotel=self.hotel, nom="Durand", prenom="Paul",
            sexe="M", poste="Agent de nuit",
        )
        self.assertIsNone(p.user)

    def test_deleting_account_keeps_personnel(self):
        # on_delete=SET_NULL : la fiche employe survit au compte.
        from accounts.models import User

        user = User.objects.create_user(username="p", email="p@h.dev", password="p")
        p = Personnel.objects.create(
            user=user, hotel=self.hotel, nom="Roux", prenom="Léa",
            sexe="F", poste="Reception",
        )
        user.delete()
        p.refresh_from_db()
        self.assertIsNone(p.user)
        self.assertEqual(p.nom, "Roux")
