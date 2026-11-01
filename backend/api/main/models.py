from django.conf import settings
from django.db import models


class Notification(models.Model):
    """
    Notification affichee dans l'application.

    Seul modele restant dans `main`. L'application `main` sert de point de
    rallye pour ce qui n'appartient a aucun domaine precis (notifications,
    et plus tard les actions transverses), et ses imports d'urls serviront
    a regrouper les routes des autres applications si necessaire.

    Foreign key
    -----------
    * user -> settings.AUTH_USER_MODEL, CASCADE : en supprimant un compte,
             on supprime ses notifications, qui n'ont aucun sens sinon.

    Le Meta.indexes porte sur (user, lu) car la requete la plus frequente
    est le compteur de non-lus de l'utilisateur connecte.
    """

    id_notif = models.AutoField(primary_key=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        db_column="id_user",
    )
    title = models.CharField(max_length=150)
    detail = models.TextField()
    action = models.CharField(max_length=150, blank=True)
    lu = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notification"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "lu"], name="notif_user_lu_idx"),
        ]

    def __str__(self):
        return self.title
