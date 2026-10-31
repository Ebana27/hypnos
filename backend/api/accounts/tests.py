"""
Tests de l'application `accounts` (modele User et jetons JWT).

Commande locale :  python manage.py test accounts
"""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from hotels.models import Hotel

from .serializers import UserSerializer

User = get_user_model()


def creer_hotel(nom):
    return Hotel.objects.create(
        name=nom, adresse="a", ville="v", tel="t", email=f"{nom}@h.dev",
        nombre_etages=2, nombre_chambres=1,
    )


def jeton_acces(user):
    """Jeton d'acces, et non le refresh token.

    RefreshToken.for_user() renvoie un token de type "refresh", que
    JWTAuthentication rejette avec 401 'Token has wrong type' : l'en-tete
    Authorization attend un access token, celui qui expire en 1 h.
    """
    from rest_framework_simplejwt.tokens import RefreshToken

    return RefreshToken.for_user(user).access_token


class UserModelTests(TestCase):
    """Le modele User est le point d'ancrage de toute l'authentification."""

    @classmethod
    def setUpTestData(cls):
        cls.hotel = creer_hotel("H1")

    def test_pk_is_named_id_user(self):
        # settings.AUTH_USER_MODEL pointe bien sur le bon modele, dans la
        # bonne application.
        self.assertEqual(User._meta.label, "accounts.User")
        # Le nom de la cle primaire conditionne SIMPLE_JWT["USER_ID_FIELD"].
        self.assertEqual(User._meta.pk.name, "id_user")

    def test_create_user_hashes_password(self):
        user = User.objects.create_user(
            username="recep", email="recep@hypnos.dev",
            password="MotDePasse123!", hotel=self.hotel,
        )
        self.assertNotEqual(user.password, "MotDePasse123!")
        self.assertTrue(user.password.startswith("pbkdf2_"))
        self.assertTrue(user.check_password("MotDePasse123!"))

    def test_default_role_is_receptionniste(self):
        user = User.objects.create_user(
            username="x", email="x@h.dev", password="p", hotel=self.hotel
        )
        self.assertEqual(user.role, User.ROLE_RECEPTIONNISTE)

    def test_email_is_unique(self):
        User.objects.create_user(
            username="a", email="dup@h.dev", password="p", hotel=self.hotel
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create_user(
                    username="b", email="dup@h.dev", password="p", hotel=self.hotel
                )

    def test_allauth_email_address_accepts_custom_user(self):
        # allauth cree EmailAddress avec une FK vers settings.AUTH_USER_MODEL.
        # Ce test casse si le modele n'est plus compatible avec allauth.
        from allauth.account.models import EmailAddress

        user = User.objects.create_user(
            username="m", email="m@h.dev", password="p", hotel=self.hotel
        )
        addr = EmailAddress.objects.create(
            user=user, email=user.email, primary=True, verified=True
        )
        self.assertEqual(addr.user, user)


class UserHotelTests(TestCase):
    """
    Regle metier : « a chaque hotel son utilisateur ».

    Un compte appartient a exactement un hotel. La SEULE exception est le
    superadministrateur, qui doit pouvoir etre cree avant qu'un hotel
    existe. Cette exception est garantie par une CheckConstraint.
    """

    @classmethod
    def setUpTestData(cls):
        cls.hotel_a = creer_hotel("A")
        cls.hotel_b = creer_hotel("B")

    def test_account_belongs_to_one_hotel(self):
        user = User.objects.create_user(
            username="a", email="a@hypnos.dev", password="p", hotel=self.hotel_a
        )
        self.assertEqual(user.hotel, self.hotel_a)
        self.assertFalse(user.est_administrateur_plateforme)
        # related_name : hotel_a.comptes contient le compte.
        self.assertIn(user, self.hotel_a.comptes.all())

    def test_account_cannot_be_created_without_hotel(self):
        # La regle est appliquee PAR LA BASE, pas seulement par le formulaire.
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                User.objects.create(
                    username="orphelin", email="orphelin@h.dev", password="p",
                    hotel=None, is_superuser=False,
                )

    def test_superuser_may_exist_without_hotel(self):
        # Cas du tout premier compte : il doit exister avant tout hotel.
        # Impossible de faire autrement, donc la contrainte l'autorise.
        root = User.objects.create_superuser(
            username="root", email="root@hypnos.dev", password="p"
        )
        self.assertIsNone(root.hotel)
        self.assertTrue(root.est_administrateur_plateforme)

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

        hotel = creer_hotel("H1")
        user = User.objects.create_user(
            username="j", email="j@h.dev", password="p", hotel=hotel
        )
        token = RefreshToken.for_user(user)
        # PyJWT >= 2.10 serialise le payload en JSON : l'id devient un str.
        self.assertEqual(str(token.access_token["user_id"]), str(user.pk))


class UserSerializerTests(TestCase):
    """
    Le serializer est la seule barriere entre le JSON du client et la base.

    Deux risques couverts ici :
      * la fuite du hash de tous les mots de passe via GET /api/users,
      * le stockage en clair via POST /api/users.
    """

    @classmethod
    def setUpTestData(cls):
        cls.hotel = creer_hotel("H1")

    def test_password_never_appears_in_the_response(self):
        user = User.objects.create_user(
            username="recep", email="recep@h.dev",
            password="MotDePasse123!", hotel=self.hotel,
        )
        self.assertNotIn("password", UserSerializer(user).data)

    def test_create_hashes_the_password(self):
        serializer = UserSerializer(data={
            "username": "ebana",
            "email": "ebana@hypnos.dev",
            "password": "MotDePasse123!",
            "hotel": self.hotel.pk,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        # Un ModelSerializer sans set_password() ecrirait le texte en clair.
        self.assertNotEqual(user.password, "MotDePasse123!")
        self.assertTrue(user.password.startswith("pbkdf2_"))
        self.assertTrue(user.check_password("MotDePasse123!"))
        self.assertEqual(user.hotel, self.hotel)
        self.assertNotIn("password", serializer.data)

    def test_create_without_hotel_is_rejected_with_400_not_500(self):
        # Sans ce controle, la CheckConstraint du modele levait une
        # IntegrityError, donc reponse 500 et trace au serveur.
        serializer = UserSerializer(data={
            "username": "orphelin",
            "email": "orphelin@hypnos.dev",
            "password": "MotDePasse123!",
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("hotel", serializer.errors)

    def test_create_with_explicit_null_hotel_is_rejected(self):
        serializer = UserSerializer(data={
            "username": "orphelin",
            "email": "orphelin@hypnos.dev",
            "password": "MotDePasse123!",
            "hotel": None,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("hotel", serializer.errors)

    def test_update_without_password_keeps_the_old_one(self):
        user = User.objects.create_user(
            username="recep", email="recep@h.dev",
            password="MotDePasse123!", hotel=self.hotel,
        )
        serializer = UserSerializer(
            user, data={"email": "nouveau@h.dev"}, partial=True
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        user.refresh_from_db()
        self.assertTrue(user.check_password("MotDePasse123!"))

    def test_api_cannot_grant_superuser(self):
        # `is_superuser` est absent de `fields` : le client ne peut pas se
        # distribuer les droits de plateforme, ni s'auto-detacher de la
        # contrainte qui exige un hotel.
        self.assertNotIn("is_superuser", UserSerializer().fields)

    def test_weak_password_is_refused(self):
        serializer = UserSerializer(data={
            "username": "faible",
            "email": "faible@hypnos.dev",
            "password": "123",
            "hotel": self.hotel.pk,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class UserApiPermissionTests(TestCase):
    """
    Regle : lecture cloisonnee par etablissement, ecriture reservee au
    `manager` de l'hotel, blocagereserve a l'encadrement.

    Avant, le ViewSet n'avait aucune permission propre et heritait du seul
    IsAuthenticated global : n'importe quel porteur de jeton pouvait lister
    puis supprimer tous les comptes, superadministrateur compris. Le meme
    defaut existait sur hotels, reservations et clients.
    """

    @classmethod
    def setUpTestData(cls):
        cls.hotel_a = creer_hotel("A")
        cls.hotel_b = creer_hotel("B")
        cls.root = User.objects.create_superuser(
            username="root", email="root@hypnos.dev", password="MotDePasse123!"
        )
        cls.admin_a = User.objects.create_user(
            username="admin_a", email="admin_a@h.dev", password="MotDePasse123!",
            hotel=cls.hotel_a, is_staff=True, role=User.ROLE_ADMIN,
        )
        cls.recep_a = User.objects.create_user(
            username="recep_a", email="recep_a@h.dev", password="MotDePasse123!",
            hotel=cls.hotel_a,
        )
        cls.recep_a2 = User.objects.create_user(
            username="recep_a2", email="recep_a2@h.dev", password="MotDePasse123!",
            hotel=cls.hotel_a,
        )
        cls.recep_b = User.objects.create_user(
            username="recep_b", email="recep_b@h.dev", password="MotDePasse123!",
            hotel=cls.hotel_b,
        )

    def setUp(self):
        self.client = APIClient()

    def connecter(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton_acces(user)}")

    # -- authentification ------------------------------------------------
    def test_anonymous_cannot_list_accounts(self):
        self.assertEqual(self.client.get("/api/users/").status_code, 401)

    # -- cloisonnement en lecture ---------------------------------------
    def test_superuser_sees_every_account(self):
        self.connecter(self.root)
        data = self.client.get("/api/users/").json()
        # root + admin_a + recep_a + recep_a2 + recep_b
        self.assertEqual(data["count"], 5)

    def test_receptionist_sees_only_own_hotel(self):
        self.connecter(self.recep_a)
        data = self.client.get("/api/users/").json()
        # admin_a + recep_a + recep_a2, et rien du hotel B ni root.
        self.assertEqual(data["count"], 3)
        emails = {row["email"] for row in data["results"]}
        self.assertEqual(emails, {"admin_a@h.dev", "recep_a@h.dev", "recep_a2@h.dev"})

    def test_receptionist_cannot_read_an_account_of_another_hotel(self):
        self.connecter(self.recep_a)
        # 404 et non 403 : on ne confirme pas l'existence du compte.
        self.assertEqual(
            self.client.get(f"/api/users/{self.recep_b.pk}/").status_code, 404
        )

    def test_superuser_ignores_hotel_scoping(self):
        # Le cas inverse du cloisonnement : root n'appartient a aucun hotel
        # (hotel=None) et voit quand meme tous les etablissements.
        self.assertIsNone(self.root.hotel_id)
        self.connecter(self.root)
        data = self.client.get("/api/users/").json()
        self.assertIn("recep_b@h.dev", {row["email"] for row in data["results"]})

    # -- ecriture -------------------------------------------------------
    def test_receptionist_cannot_create_account(self):
        self.connecter(self.recep_a)
        response = self.client.post("/api/users/", {
            "username": "pirate", "email": "pirate@h.dev",
            "password": "MotDePasse123!", "hotel": self.hotel_a.pk,
        })
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(username="pirate").exists())

    def test_receptionist_cannot_delete_account(self):
        self.connecter(self.recep_a)
        response = self.client.delete(f"/api/users/{self.recep_a2.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.recep_a2.pk).exists())

    def test_receptionist_cannot_delete_superuser(self):
        self.connecter(self.recep_a)
        self.assertEqual(
            self.client.delete(f"/api/users/{self.root.pk}/").status_code, 403
        )

    def test_platform_admin_can_create_account(self):
        # Renomme en `manager` : le modele vise ne prevoit qu'UN role qui
        # ecrit les donnees de l'etablissement. `admin` supervise (il bloque
        # un compte) sans ecrire, `receptionniste` ne fait que lire.
        self.manager_a = User.objects.create_user(
            username="manager_a", email="manager_a@h.dev",
            password="MotDePasse123!", hotel=self.hotel_a, role=User.ROLE_MANAGER,
        )
        self.connecter(self.manager_a)
        response = self.client.post("/api/users/", {
            "username": "ebana", "email": "ebana@hypnos.dev",
            "password": "MotDePasse123!", "hotel": self.hotel_a.pk,
        })
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(User.objects.get(username="ebana").hotel, self.hotel_a)

    def test_manager_cannot_create_an_account_for_another_hotel(self):
        # Le defaut que la couche de permissions corrige : sans le filtre,
        # un manager de l'hotel A creeait un compte dans l'hotel B.
        manager_a = User.objects.create_user(
            username="manager_isole", email="manager_isole@h.dev",
            password="MotDePasse123!", hotel=self.hotel_a, role=User.ROLE_MANAGER,
        )
        self.connecter(manager_a)
        response = self.client.post("/api/users/", {
            "username": "intrus", "email": "intrus@h.dev",
            "password": "MotDePasse123!", "hotel": self.hotel_b.pk,
        })
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(User.objects.filter(username="intrus").exists())

    def test_admin_can_block_a_receptionist_without_writing_hotel_data(self):
        # Suspendre un compte est de l'administration : `admin` le peut.
        self.connecter(self.admin_a)
        bloque = self.client.post(f"/api/users/{self.recep_a.pk}/bloquer/")
        self.assertEqual(bloque.status_code, 200, bloque.data)
        self.assertFalse(User.objects.get(pk=self.recep_a.pk).is_active)

        # ... mais il n'ecrit toujours aucune donnee de l'hotel.
        ecriture = self.client.post("/api/chambres/", {
            "hotel": self.hotel_a.pk, "numero": "999", "etage": 1,
            "type_chambre": 1, "statut": "disponible",
        })
        self.assertEqual(ecriture.status_code, 403)

    def test_a_blocked_account_is_refused_even_with_a_valid_token(self):
        # `is_active = False` doit couper l'acces immediatement, pas a la
        # prochaine connexion : un token deja delivre vaut une heure.
        # C'est SimpleJWT qui refuse, des l'authentification (401), donc on
        # ne peut pas exploiter un jeton obtenu avant le blocage.
        self.connecter(self.root)
        bloque = self.client.post(f"/api/users/{self.recep_a.pk}/bloquer/")
        self.assertEqual(bloque.status_code, 200, bloque.data)

        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton_acces(self.recep_a)}")
        self.assertEqual(client.get("/api/users/").status_code, 401)


class TrailingSlashTests(TestCase):
    """
    Le routeur doit garder le "/" final.

    Sans lui, POST /api/users/ declenche APPEND_SLASH, qui renvoie un 301 ; le
    client rejoue alors la requete en GET et le corps JSON est perdu. C'est
    exactement le symptome observe en Postman.
    """

    def test_routes_keep_the_trailing_slash(self):
        hotel = creer_hotel("H1")
        root = User.objects.create_superuser(
            username="root", email="root@h.dev", password="MotDePasse123!"
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton_acces(root)}")

        self.assertEqual(client.get("/api/users/").status_code, 200)
        self.assertEqual(client.get("/api/hotels/").status_code, 200)
        # Sans slash : redirection, donc aucune creation.
        response = client.post("/api/users", {
            "username": "ebana", "email": "ebana@h.dev",
            "password": "MotDePasse123!", "hotel": hotel.pk,
        })
        self.assertEqual(response.status_code, 301)
        self.assertFalse(User.objects.filter(username="ebana").exists())


class BootstrapSequenceTests(TestCase):
    """
    La chaine de demarrage, une fois le proprietaire deja installe.

    Elle commence par `createsuperuser` parce que ce test part d'une base
    deja peuplee. Le TOUT premier compte, lui, passe par la porte de
    demarrage de l'API (`X-Bootstrap-Token`, table vide) : voir
    `BootstrapApiTests`. C'etait necessaire parce que
    `/api/token/` est un endpoint de CONNEXION -- il exige un compte deja
    existant -- et que la contrainte `user_hotel_ou_superuser` exige soit un
    hotel, soit le statut superuser que l'API ne doit jamais attribuer.
    Aucun des deux ne permet donc de demarrer par l'API seule.

    L'ordre compte ensuite : un compte ne peut pas exister sans son hotel,
    donc le proprietaire cree l'etablissement avant ses agents.
    """

    def test_full_chain_from_root_account_to_new_user(self):
        root = User.objects.create_superuser(
            username="root", email="root@h.dev", password="MotDePasse123!"
        )
        client = APIClient()

        # 1. Le compte racine se connecte : c'est le seul point d'entree.
        response = client.post("/api/token/", {
            "username": "root", "password": "MotDePasse123!",
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("access", response.json())
        self.assertIn("refresh", response.json())
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")

        # 2. Creation de l'etablissement.
        response = client.post("/api/hotels/", {
            "nom": "Hotel Ebanapla", "adresse": "1 rue de la Paix",
            "ville": "Lome", "tel": "22890123456",
            "email": "contact@hotel.test", "nombre_etages": 5,
            "nombre_chambres": 40,
        })
        self.assertEqual(response.status_code, 201, response.data)
        hotel_id = response.json()["hotel_id"]

        # 3. Creation du compte de l'etablissement, rattache a cet hotel.
        response = client.post("/api/users/", {
            "username": "Ebana", "email": "ebana@hypnos.dev",
            "password": "Ebana123456", "hotel": hotel_id,
        })
        self.assertEqual(response.status_code, 201, response.data)
        ebana = User.objects.get(username="Ebana")
        self.assertEqual(ebana.hotel_id, hotel_id)
        self.assertTrue(ebana.check_password("Ebana123456"))

        # 4. Ebana obtient son propre jeton, et n'ecrit plus.
        client.credentials()
        response = client.post("/api/token/", {
            "username": "Ebana", "password": "Ebana123456",
        })
        self.assertEqual(response.status_code, 200, response.data)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        self.assertEqual(client.get("/api/hotels/").json()["count"], 1)
        self.assertEqual(
            client.post("/api/users/", {
                "username": "x", "email": "x@h.dev",
                "password": "MotDePasse123!", "hotel": hotel_id,
            }).status_code,
            403,
        )

    def test_token_endpoint_rejects_the_email_key(self):
        # simplejwt lit USERNAME_FIELD ("username"), jamais "email" : meme si
        # allauth sait authentifier par email, la cle JSON reste `username`.
        User.objects.create_superuser(
            username="root", email="root@h.dev", password="MotDePasse123!"
        )
        response = APIClient().post("/api/token/", {
            "email": "root@h.dev", "password": "MotDePasse123!",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)


@override_settings(BOOTSTRAP_TOKEN="jeton-de-test")
class BootstrapApiTests(TestCase):
    """
    Creation du premier compte sur une base neuve.

    Sans ce passage, il faut une commande Django sur le serveur, ce qui
    suppose un acces shell -- inaccessible sur un hebergement mutualise
    comme Heroku. D'ou cette porte unique : ouverte tant que la table est
    vide, fermee immediatement apres, et protegee par un jeton.

    Le jeton est fixe par `override_settings` pour que ces tests ne
    dependent pas d'un `.env` local.
    """

    def setUp(self):
        self.client = APIClient()

    def identifiants(self, **champs):
        return {
            "username": "proprietaire", "email": "proprietaire@hypnos.dev",
            "password": "MotDePasse123!", **champs,
}

    def test_sur_base_vide_le_jeton_cree_le_proprietaire_usable(self):
        self.assertFalse(User.objects.exists())

        reponse = self.client.post(
            "/api/users/", self.identifiants(),
            HTTP_X_BOOTSTRAP_TOKEN="jeton-de-test",
        )
        self.assertEqual(reponse.status_code, 201, reponse.data)

        compte = User.objects.get()
        self.assertTrue(compte.is_superuser)
        # Aucun hotel : c'est le proprietaire de la plateforme, pas l'agent
        # d'un etablissement.
        self.assertIsNone(compte.hotel)

        # Et il se connecte : c'est le seul but de ce compte.
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {jeton_acces(compte)}")
        self.assertEqual(client.get("/api/users/").status_code, 200)

    def test_sans_le_bon_jeton_aucun_compte(self):
        # Absence de jeton, jeton devine, et surtout jeton non configure --
        # un oubli de deploiement ne doit pas ouvrir la creation d'un
        # superadmin a quiconque joint le serveur.
        for jeton in (None, "devine"):
            entetes = {} if jeton is None else {"HTTP_X_BOOTSTRAP_TOKEN": jeton}
            with self.subTest(jeton=jeton):
                reponse = self.client.post("/api/users/", self.identifiants(), **entetes)
                self.assertEqual(reponse.status_code, 403)
                self.assertFalse(User.objects.exists())

        with override_settings(BOOTSTRAP_TOKEN=""):
            reponse = self.client.post(
                "/api/users/", self.identifiants(), HTTP_X_BOOTSTRAP_TOKEN=""
            )
            self.assertEqual(reponse.status_code, 403)
            self.assertFalse(User.objects.exists())

    def test_une_fois_un_compte_existant_la_porte_est_fermee(self):
        User.objects.create_superuser(
            username="root", email="root@h.dev", password="MotDePasse123!"
        )
        reponse = self.client.post(
            "/api/users/", self.identifiants(),
            HTTP_X_BOOTSTRAP_TOKEN="jeton-de-test",
        )
        # 401 et non 403 : la route redevient une route API ordinaire, et le
        # role ne se choisit plus dans la requete.
        self.assertEqual(reponse.status_code, 401)
        self.assertEqual(User.objects.count(), 1)
