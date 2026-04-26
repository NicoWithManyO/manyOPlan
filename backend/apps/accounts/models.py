from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    is_placeholder = models.BooleanField(
        default=False,
        verbose_name="Compte provisoire",
        help_text="Créé par un admin pour affecter un bénévole non inscrit.",
    )
    nickname = models.CharField(
        max_length=60,
        blank=True,
        default="",
        verbose_name="Surnom",
        help_text="Nom affiché dans les plannings. Si vide : « Prénom L. ».",
    )

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return f"{self.get_full_name() or self.username}"

    @property
    def display_name(self):
        nick = (self.nickname or "").strip()
        if nick:
            return nick
        first = (self.first_name or "").strip()
        last = (self.last_name or "").strip()
        if first and last:
            return f"{first} {last[0].upper()}."
        return first or self.username
