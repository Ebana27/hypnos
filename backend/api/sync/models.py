from django.conf import settings
from django.db import models


class SyncCursor(models.Model):
    """
    Position de synchronisation d'un poste de travail.

    Le schema Hypnos distingue deux bases :
        DATABASE 1 = base en ligne, cote API. C'est la source de verite.
        DATABASE 2 = base locale, cote logiciel desktop.
    La synchronisation se fait entierement via l'API.

    Chaque poste de travail (l'agent de reception) possede sa propre ligne
    ici. Il ne recupere a chaque appel que ce qui a change depuis sa
    derniere consultation, au lieu de telecharger toute la file a chaque
    fois. Sans cette table, l'agent devrait recharger les reservations en
    attente a chaque ouverture du logiciel.

    `appareil` est un identifiant pose par le client Electron au premier
    demarrage, stocke en local. Il n'est pas lie a un compte User : deux
    agents peuvent utiliser le meme poste pour deux hotels differents.
    """

    hotel = models.ForeignKey(
        "hotels.Hotel",
        on_delete=models.CASCADE,
        related_name="curseurs_sync",
    )
    appareil = models.CharField(
        max_length=64,
        help_text="Identifiant du poste, fourni par l'app Electron.",
    )
    # Curseur : uniquement les reservations modifiees apres cet instant sont
    # renvoyees. Evite de renvoyer toute la file a chaque appel.
    derniere_consultation = models.DateTimeField(null=True, blank=True)
    # Compteur d'appels, utile pour le diagnostic dans les logs du logiciel.
    nombre_appels = models.PositiveIntegerField(default=0)
    mis_a_jour = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sync_cursor"
        # Un poste = une seule ligne par hotel. SANS cette contrainte,
        # deux requetes simultanees creeraient deux curseurs et le poste
        # decouvrirait deux fois la meme reservation.
        constraints = [
            models.UniqueConstraint(
                fields=["hotel", "appareil"], name="unique_curseur_par_poste"
            ),
        ]
        verbose_name = "Curseur de synchronisation"
        verbose_name_plural = "Curseurs de synchronisation"

    def __str__(self):
        return f"{self.appareil} @ {self.hotel.name}"

    def marquer_consulte(self, horodatage=None):
        """
        Avance le curseur. A appeler APRES avoir repondu au client, jamais
        avant : si la reponse est perdue en cours de route, les elements
    non recus doivent etre renvoyes au prochain appel.
        """
        from django.utils import timezone

        self.derniere_consultation = horodatage or timezone.now()
        self.nombre_appels += 1
        self.save(update_fields=["derniere_consultation", "nombre_appels", "mis_a_jour"])


class JournalSync(models.Model):
    """
    Trace des echecs et decisions prises par la couche de synchronisation.

    Utile quand l'agent dit "le logiciel ne me propose aucune chambre" :
    on regarde ce qui a ete rejete et pourquoi. Volontairement conserve
    30 jours, c'est une table de diagnostic, pas un historique metier.
    """

    hotel = models.ForeignKey(
        "hotels.Hotel",
        on_delete=models.CASCADE,
        related_name="journaux_sync",
    )
    reservation = models.ForeignKey(
        "reservations.Reservation",
        on_delete=models.CASCADE,
        related_name="journaux_sync",
    )
    appareil = models.CharField(max_length=64, blank=True)
    action = models.CharField(
        max_length=40,
        help_text="Confirmer, Refuser, Propositions, Erreur...",
    )
    succes = models.BooleanField(default=True)
    detail = models.TextField(blank=True)
    horodatage = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sync_journal"
        ordering = ["-horodatage"]
        indexes = [
            models.Index(fields=["hotel", "-horodatage"], name="sync_journal_hotel_idx"),
        ]

    def __str__(self):
        return f"{self.action} res#{self.reservation_id} ({self.horodatage:%d/%m %H:%M})"
