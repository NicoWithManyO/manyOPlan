from django.conf import settings
from django.db import models

from core.mixins import BaseInvitation, TimestampMixin


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


class OrganizationInvitation(BaseInvitation):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invitations",
    )

    class Meta(BaseInvitation.Meta):
        verbose_name = "Invitation association"
        verbose_name_plural = "Invitations association"

    def __str__(self):
        return f"{self.organization} - {self.label or self.token[:8]}"
