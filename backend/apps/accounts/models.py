from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    is_placeholder = models.BooleanField(
        default=False,
        verbose_name="Compte provisoire",
        help_text="Créé par un admin pour affecter un bénévole non inscrit.",
    )

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"

    def __str__(self):
        return f"{self.get_full_name() or self.username}"
