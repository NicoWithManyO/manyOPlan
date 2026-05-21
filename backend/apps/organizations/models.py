import secrets

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.mixins import TimestampMixin


class Organization(TimestampMixin):
    name = models.CharField(max_length=120, verbose_name="Nom")
    slug = models.SlugField(max_length=140, unique=True, verbose_name="Slug")
    invite_code = models.CharField(
        max_length=32,
        unique=True,
        verbose_name="Code d'invitation",
        help_text="Code choisi par l'admin pour inviter des bénévoles. Insensible à la casse.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_organizations",
    )
    logo = models.ImageField(
        upload_to="org_logos/",
        blank=True,
        null=True,
        max_length=255,
        verbose_name="Logo",
    )

    class Meta:
        verbose_name = "Association"
        verbose_name_plural = "Associations"
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.invite_code:
            self.invite_code = self.invite_code.lower()
        super().save(*args, **kwargs)


class OrganizationMembership(TimestampMixin):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        MEMBER = "member", "Membre"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="org_memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.MEMBER,
    )

    class Meta:
        verbose_name = "Adhésion association"
        verbose_name_plural = "Adhésions associations"
        unique_together = ("user", "organization")

    def __str__(self):
        return f"{self.user} - {self.organization} ({self.get_role_display()})"


class OrganizationInvitation(models.Model):
    organization = models.ForeignKey(
        Organization,
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
    is_promoted = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Invitation association"
        verbose_name_plural = "Invitations association"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.organization} - {self.label or self.token[:8]}"

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
