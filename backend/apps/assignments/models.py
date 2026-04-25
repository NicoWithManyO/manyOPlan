from django.conf import settings
from django.db import models

from apps.tasks.models import Slot


class Assignment(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmé"
        BACKUP = "backup", "Secours"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    slot = models.ForeignKey(
        Slot,
        on_delete=models.CASCADE,
        related_name="assignments",
    )
    start_date = models.DateTimeField(
        verbose_name="Début choisi",
        help_text="Plage choisie par le bénévole (dans les limites du créneau)",
    )
    end_date = models.DateTimeField(
        verbose_name="Fin choisie",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.CONFIRMED,
        verbose_name="Statut",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Affectation"
        verbose_name_plural = "Affectations"
        unique_together = ("user", "slot")
        ordering = ["start_date"]

    def __str__(self):
        return f"{self.user} → {self.slot} ({self.get_status_display()})"
