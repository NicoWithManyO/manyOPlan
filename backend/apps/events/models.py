from django.conf import settings
from django.db import models

from core.mixins import BaseInvitation, TimestampMixin


class Event(TimestampMixin):
    class EventType(models.TextChoices):
        FESTIVAL = "festival", "Festival"
        CONFERENCE = "conference", "Conférence"
        SPORT = "sport", "Événement sportif"
        CHARITY = "charity", "Caritatif"
        OTHER = "other", "Autre"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="events",
        verbose_name="Association",
    )
    name = models.CharField(max_length=255, verbose_name="Nom")
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.OTHER,
        verbose_name="Type",
    )
    description = models.TextField(blank=True, verbose_name="Description")
    start_date = models.DateTimeField(verbose_name="Date de début")
    end_date = models.DateTimeField(verbose_name="Date de fin")
    poster = models.ImageField(
        upload_to="event_posters/",
        blank=True,
        null=True,
        max_length=255,
        verbose_name="Affiche",
    )

    class Meta:
        verbose_name = "Événement"
        verbose_name_plural = "Événements"
        ordering = ["-start_date"]

    def __str__(self):
        return self.name


class EventMembership(TimestampMixin):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        VOLUNTEER = "volunteer", "Bénévole"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_memberships",
    )
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.VOLUNTEER,
        verbose_name="Rôle",
    )

    class Meta:
        verbose_name = "Adhésion"
        verbose_name_plural = "Adhésions"
        unique_together = ("user", "event")

    def __str__(self):
        return f"{self.user} - {self.event} ({self.get_role_display()})"


class EventInvitation(BaseInvitation):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    class Meta(BaseInvitation.Meta):
        verbose_name = "Invitation événement"
        verbose_name_plural = "Invitations événement"

    def __str__(self):
        return f"{self.event} - {self.label or self.token[:8]}"
