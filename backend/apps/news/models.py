from django.conf import settings
from django.db import models

from apps.events.models import Event
from core.mixins import TimestampMixin


class News(TimestampMixin):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="news",
        null=True,
        blank=True,
        verbose_name="Événement",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="authored_news",
    )
    title = models.CharField(max_length=255, verbose_name="Titre")
    content = models.TextField(verbose_name="Contenu")

    class Meta:
        verbose_name = "Actualité"
        verbose_name_plural = "Actualités"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
