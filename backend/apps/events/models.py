import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.mixins import TimestampMixin


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


class EventInvitation(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    token = models.CharField(max_length=60, unique=True, db_index=True)
    label = models.CharField(max_length=100, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    use_count = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Invitation événement"
        verbose_name_plural = "Invitations événement"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.event} - {self.label or self.token[:8]}"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def is_valid(self) -> tuple[bool, str | None]:
        if self.expires_at and self.expires_at < timezone.now():
            return False, "expired"
        if self.max_uses and self.use_count >= self.max_uses:
            return False, "exhausted"
        return True, None
