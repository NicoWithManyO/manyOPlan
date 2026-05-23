import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone


class TimestampMixin(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class BaseInvitation(models.Model):
    DECORATION_LOGO = "logo"
    DECORATION_TEXT = "text"
    DECORATION_CHOICES = [
        (DECORATION_LOGO, "Logo de l'association"),
        (DECORATION_TEXT, "Texte personnalisé"),
    ]

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
    is_promoted = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    decoration_type = models.CharField(
        max_length=8, choices=DECORATION_CHOICES, default=DECORATION_LOGO
    )
    decoration_text = models.CharField(max_length=15, blank=True)
    decoration_bg_color = models.CharField(max_length=7, default="#ffffff")
    decoration_text_color = models.CharField(max_length=7, default="#000000")

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        super().save(*args, **kwargs)

    def is_valid(self) -> tuple[bool, str | None]:
        if not self.is_active:
            return False, "inactive"
        if self.expires_at and self.expires_at < timezone.now():
            return False, "expired"
        if self.max_uses and self.use_count >= self.max_uses:
            return False, "exhausted"
        return True, None
