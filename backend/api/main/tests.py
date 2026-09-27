"""
Tests de l'application `main` (Notification).

Commande locale :  python manage.py test main
"""

from django.contrib.auth import get_user_model
from django.test import TestCase

from main.models import Notification

User = get_user_model()


class NotificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="recep", email="recep@hypnos.dev", password="p"
        )
        cls.notif = Notification.objects.create(
            user=cls.user, title="Reservation confirmee",
            detail="Chambre 101 du 01/10 au 05/10",
        )

    def test_default_is_unread(self):
        self.assertFalse(self.notif.lu)

    def test_created_at_is_set_automatically(self):
        # auto_now_add : la date est posee par la base, pas par le code.
        self.assertIsNotNone(self.notif.created_at)

    def test_ordering_is_newest_first(self):
        older = Notification.objects.create(
            user=self.user, title="Ancien", detail="d"
        )
        Notification.objects.filter(pk=older.pk).update(
            created_at=self.notif.created_at
        )
        titres = list(
            Notification.objects.filter(user=self.user).values_list("title", flat=True)
        )
        self.assertEqual(titres[0], self.notif.title)

    def test_deleting_user_deletes_notifications(self):
        # on_delete=CASCADE : une notification sans destinataire n'a pas
        # de sens.
        self.user.delete()
        self.assertEqual(Notification.objects.count(), 0)
