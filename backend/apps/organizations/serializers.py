import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.text import slugify
from rest_framework import serializers

from core.validators import check_password_match, normalize_and_check_unique_email

from .models import Organization, OrganizationInvitation, OrganizationMembership

User = get_user_model()

INVITE_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")
INVITATION_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{2,60}$")


def validate_invite_code(value):
    if not INVITE_CODE_RE.match(value):
        raise serializers.ValidationError(
            "Le code doit contenir 4 à 32 caractères (lettres, chiffres, tirets, underscores)."
        )
    normalized = value.lower()
    if Organization.objects.filter(invite_code=normalized).exists():
        raise serializers.ValidationError("Ce code d'invitation est déjà utilisé.")
    return normalized


class OrganizationSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "invite_code",
            "logo",
            "created_by",
            "created_at",
            "my_role",
            "member_count",
        )
        read_only_fields = (
            "id",
            "logo",
            "created_by",
            "created_at",
            "my_role",
            "member_count",
        )

    def get_logo(self, obj):
        return obj.logo.url if obj.logo else None

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None

    def get_member_count(self, obj):
        return obj.memberships.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Hide invite_code from non-admin members
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            membership = instance.memberships.filter(user=request.user).first()
            if not membership or membership.role != OrganizationMembership.Role.ADMIN:
                if not request.user.is_staff:
                    data["invite_code"] = None
        return data


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("name", "slug", "invite_code")
        extra_kwargs = {"slug": {"required": False}}

    def validate_invite_code(self, value):
        return validate_invite_code(value)

    def validate_slug(self, value):
        if Organization.objects.filter(slug=value).exists():
            raise serializers.ValidationError("Ce slug est déjà utilisé.")
        return value

    def validate(self, attrs):
        if not attrs.get("slug"):
            base = slugify(attrs.get("name", ""))
            if not base:
                raise serializers.ValidationError({"name": "Nom invalide."})
            slug = base
            i = 1
            while Organization.objects.filter(slug=slug).exists():
                i += 1
                slug = f"{base}-{i}"
            attrs["slug"] = slug
        return attrs


class OrganizationUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("name", "slug", "invite_code")

    def validate_invite_code(self, value):
        normalized = value.lower()
        if not INVITE_CODE_RE.match(value):
            raise serializers.ValidationError(
                "Le code doit contenir 4 à 32 caractères (lettres, chiffres, tirets, underscores)."
            )
        if Organization.objects.filter(invite_code=normalized).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Ce code d'invitation est déjà utilisé.")
        return normalized

    def validate_slug(self, value):
        if Organization.objects.filter(slug=value).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Ce slug est déjà utilisé.")
        return value


class OrganizationMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ("id", "user", "username", "full_name", "email", "role", "created_at")
        read_only_fields = ("id", "user", "username", "full_name", "email", "created_at")

    def get_full_name(self, obj):
        return obj.user.display_name


class JoinOrganizationSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=32)

    def validate_invite_code(self, value):
        normalized = value.lower()
        try:
            self.organization = Organization.objects.get(invite_code=normalized)
        except Organization.DoesNotExist:
            raise serializers.ValidationError("Code d'invitation invalide.")
        return normalized


class OrganizationInvitationSerializer(serializers.ModelSerializer):
    token = serializers.CharField(required=False, allow_blank=True, max_length=60)
    is_valid = serializers.BooleanField(read_only=True)
    invalid_reason = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = OrganizationInvitation
        fields = (
            "id",
            "token",
            "label",
            "created_at",
            "expires_at",
            "max_uses",
            "use_count",
            "is_valid",
            "invalid_reason",
            "is_promoted",
            "is_active",
        )
        read_only_fields = ("id", "created_at", "use_count")

    def validate_token(self, value):
        value = (value or "").strip()
        if not value:
            return ""
        if not INVITATION_TOKEN_RE.match(value):
            raise serializers.ValidationError(
                "2 à 60 caractères : lettres, chiffres, tirets, underscores."
            )
        if OrganizationInvitation.objects.filter(token=value).exists():
            raise serializers.ValidationError("Ce lien existe déjà, choisis-en un autre.")
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        ok, reason = instance.is_valid()
        data["is_valid"] = ok
        data["invalid_reason"] = reason
        return data


class OrganizationInvitationPreviewSerializer(serializers.Serializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    organization_logo = serializers.SerializerMethodField()
    is_valid = serializers.BooleanField(read_only=True)
    invalid_reason = serializers.CharField(read_only=True, allow_null=True)

    def get_organization_logo(self, instance):
        org = instance.organization
        return org.logo.url if org.logo else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        ok, reason = instance.is_valid()
        data["is_valid"] = ok
        data["invalid_reason"] = reason
        return data


class OrgInvitationAcceptSerializer(serializers.Serializer):
    """Validates signup fields when accepting an org invitation as anonymous user.

    Mirrors the validation rules of accounts.RegisterSerializer.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    nickname = serializers.CharField(max_length=60, required=False, allow_blank=True)

    def validate_email(self, value):
        return normalize_and_check_unique_email(value)

    def validate(self, attrs):
        check_password_match(attrs["password"], attrs["password_confirm"])
        return attrs
