"""
Tests de l'application `accounts` (modele User et jetons JWT).

Commande locale :  python manage.py test accounts
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

User = get_user_model()


class UserModelTests(TestCase):
    """Le modele User est le point d'ancrage de toute l'authentification."""

    def test_pk_is_named_id_user(self):
        # settings.AUTH_USER_MODEL pointe bien sur le bon modele, dans la
        # bonne application.
        self.assertEqual(User._meta.label, "accounts.User")
        # Le nom de la cle primaire conditionne SIMPLE_JWT["USER_ID_FIELD"].
        self.assertEqual(User._meta.pk.name, "id_user")

    def test_create_user_hashes_password(self):
        user = User.objects.create_user(
            username="recep", email="recep@hypnos.dev", password="MotDePasse123!"
        )
        self.assertNotEqual(user.password, "MotDePasse123!")
        self.assertTrue(user.password.startswith("pbkdf2_"))
        self.assertTrue(user.check_password("MotDePasse123!"))

    def test_default_role_is_receptionniste(self):
        user = User.objects.create_user(username="x", email="x@h.dev", password="p")
        self.assertEqual(user.role, User.ROLE_RECEPTIONNISTE)

    def test_email_is_unique(self):
        User.objects.create_user(username="a", email="dup@h.dev", password="p")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(username="b", email="dup@h.dev", password="p")

    def test_allauth_email_address_accepts_custom_user(self):
        # allauth cree EmailAddress avec une FK vers settings.AUTH_USER_MODEL.
        # Ce test casse si le modele n'est plus compatible avec allauth.
        from allauth.account.models import EmailAddress

        user = User.objects.create_user(username="m", email="m@h.dev", password="p")
        addr = EmailAddress.objects.create(
            user=user, email=user.email, primary=True, verified=True
        )
        self.assertEqual(addr.user, user)


class UserHotelTests(TestCase):
    """Un compte depose dans un seul hotel."""

    @classmethod
    def setUpTestData(cls):
        from hotels.models import Hotel

        cls.hotel_a = Hotel.objects.create(
            name="A", adresse="a", ville="v", tel="t", email="a@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )
        cls.hotel_b = Hotel.objects.create(
            name="B", adresse="b", ville="v", tel="t", email="b@h.dev",
            nombre_etages=2, nombre_chambres=1,
        )

    def test_account_belongs_to_one_hotel(self):
        from hotels.models import Personnel

        user = User.objects.create_user(
            username="a", email="a@hypnos.dev", password="p", hotel=self.hotel_a
        )
        Personnel.objects.create(
            user=user, hotel=self.hotel_a, nom="Nom", prenom="Pre",
            sexe="M", poste="Reception",
        )
        self.assertEqual(user.hotel, self.hotel_a)
        self.assertFalse(user.est_administrateur_plateforme)
        # related_name : hotel_a.comptes contient le compte.
        self.assertIn(user, self.hotel_a.comptes.all())

    def test_platform_admin_has_no_hotel(self):
        # Cas de fuite : un compte sans hotel voit tous les etablissements.
        user = User.objects.create_user(
            username="root", email="root@hypnos.dev", password="p"
        )
        self.assertIsNone(user.hotel)
        self.assertTrue(user.est_administrateur_plateforme)

    def test_hotel_deletion_is_blocked_while_accounts_exist(self):
        # on_delete=PROTECT : supprimer un hotel effacerait les comptes de
        # tout son personnel.
        from django.db.models import ProtectedError

        User.objects.create_user(
            username="a", email="a@hypnos.dev", password="p", hotel=self.hotel_a
        )
        with self.assertRaises(ProtectedError):
            self.hotel_a.delete()


class JWTTokenTests(TestCase):
    """simplejwt doit retrouver l'utilisateur via le champ renomme en id_user."""

    def test_refresh_token_contains_user_id(self):
        from rest_framework_simplejwt.tokens import RefreshToken

        user = User.objects.create_user(username="j", email="j@h.dev", password="p")
        token = RefreshToken.for_user(user)
        # PyJWT >= 2.10 serialise le payload en JSON : l'id devient un str.
        self.assertEqual(str(token.access_token["user_id"]), str(user.pk))
