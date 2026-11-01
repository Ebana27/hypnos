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
    """
    L'employe EST le compte.

    Personnel ne porte plus ni `hotel` ni `nom`/`prenom` : tout vient de
    `user`. C'est ce qui rend impossible desynchroniser un compte et sa
    fiche employe.
    """

    @classmethod
    def setUpTestData(cls):
        from accounts.models import User

        cls.hotel = Hotel.objects.create(
            name="H", adresse="a", ville="v", tel="t", email="e@h.dev",
            nombre_etages=2, nombre_chambres=0,
        )
        cls.user = User.objects.create_user(
            username="durand", email="durand@h.dev", password="p",
            hotel=cls.hotel, first_name="Paul", last_name="Durand",
        )

    def test_personnel_must_have_an_account(self):
        # Regle : tout employe a un compte. Un compte sans employe reste
        # possible (agent plateforme), l'inverse non.
        p = Personnel.objects.create(
            user=self.user, sexe="M", poste="Agent de nuit"
        )
        self.assertEqual(p.user, self.user)

    def test_account_without_personnel_record_is_allowed(self):
        # Un compte n'a PAS besoin d'une fiche employe : c'est l'inverse
        # qui est interdit.
        from accounts.models import User

        autre = User.objects.create_user(
            username="solo", email="solo@h.dev", password="p", hotel=self.hotel
        )
        self.assertFalse(hasattr(autre, "personnel"))

    def test_hotel_nom_come_from_the_account(self):
        p = Personnel.objects.create(
            user=self.user, sexe="M", poste="Reception"
        )
        # Proprietes de lecture : aucune colonne dupliquee.
        self.assertEqual(p.hotel, self.hotel)
        self.assertEqual(p.hotel_id, self.hotel.hotel_id)
        self.assertEqual(p.nom, "Durand")
        self.assertEqual(p.prenom, "Paul")

    def test_name_cannot_diverge_from_the_account(self):
        # C'est tout l'interet de la suppression des colonnes : il n'existe
        # aucun moyen d'avoir p.nom != user.last_name.
        concret = {f.name for f in Personnel._meta.get_fields()}
        for absent in ("nom", "prenom", "hotel"):
            # aucune colonne...
            self.assertNotIn(absent, concret)
            # ... mais une propriete de lecture, donc utilisable en template
            self.assertIsInstance(getattr(Personnel, absent), property)

    def test_query_must_go_through_the_user_relation(self):
        # Une propriete n'existe pas en SQL : le filtre passe par user__.
        p = Personnel.objects.create(
            user=self.user, sexe="M", poste="Reception"
        )
        self.assertEqual(
            Personnel.objects.filter(user__hotel=self.hotel).count(), 1
        )
        with self.assertRaises(Exception):
            Personnel.objects.filter(hotel=self.hotel).count()

    def test_deleting_account_is_blocked(self):
        # on_delete=PROTECT : on ne perd pas un employe en cours d'activite.
        from django.db.models import ProtectedError

        Personnel.objects.create(user=self.user, sexe="M", poste="Reception")
        with self.assertRaises(ProtectedError):
            self.user.delete()
