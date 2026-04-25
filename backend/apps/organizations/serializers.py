import re

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework import serializers

from .models import Organization, OrganizationMembership

User = get_user_model()

INVITE_CODE_RE = re.compile(r"^[A-Za-z0-9_-]{4,32}$")


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

    class Meta:
        model = Organization
        fields = (
            "id",
            "name",
            "slug",
            "invite_code",
            "created_by",
            "created_at",
            "my_role",
            "member_count",
        )
        read_only_fields = ("id", "created_by", "created_at", "my_role", "member_count")

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
        return str(obj.user)


class JoinOrganizationSerializer(serializers.Serializer):
    invite_code = serializers.CharField(max_length=32)

    def validate_invite_code(self, value):
        normalized = value.lower()
        try:
            self.organization = Organization.objects.get(invite_code=normalized)
        except Organization.DoesNotExist:
            raise serializers.ValidationError("Code d'invitation invalide.")
        return normalized
