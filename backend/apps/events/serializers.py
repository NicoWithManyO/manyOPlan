import re

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.organizations.models import Organization, OrganizationMembership

from .models import Event, EventInvitation, EventMembership

INVITATION_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{4,60}$")

User = get_user_model()


class EventSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    member_count = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "name",
            "event_type",
            "description",
            "start_date",
            "end_date",
            "organization",
            "organization_name",
            "member_count",
            "my_role",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization", "created_at", "updated_at")

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_my_role(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        # Org admin = effective event admin
        is_org_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization_id=obj.organization_id,
            role=OrganizationMembership.Role.ADMIN,
        ).exists()
        if is_org_admin:
            return EventMembership.Role.ADMIN
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else None


class EventCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = (
            "id",
            "name",
            "event_type",
            "description",
            "start_date",
            "end_date",
            "organization",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        if attrs.get("start_date") and attrs.get("end_date"):
            if attrs["start_date"] >= attrs["end_date"]:
                raise serializers.ValidationError(
                    {"end_date": "La date de fin doit être après la date de début."}
                )
        return attrs

    def validate_organization(self, value):
        request = self.context.get("request")
        if not request:
            return value
        if request.user.is_staff:
            return value
        is_admin = OrganizationMembership.objects.filter(
            user=request.user,
            organization=value,
            role=OrganizationMembership.Role.ADMIN,
        ).exists()
        if not is_admin:
            raise serializers.ValidationError(
                "Vous devez être admin de cette association pour y créer un événement."
            )
        return value


class EventMembershipSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = EventMembership
        fields = ("id", "user", "username", "full_name", "role", "created_at")
        read_only_fields = ("id", "created_at")

    def get_full_name(self, obj):
        return obj.user.display_name


class JoinEventSerializer(serializers.Serializer):
    """Serializer for a volunteer joining an event (no fields needed)."""

    pass


class EventInvitationSerializer(serializers.ModelSerializer):
    token = serializers.CharField(required=False, allow_blank=True, max_length=60)
    is_valid = serializers.SerializerMethodField()
    invalid_reason = serializers.SerializerMethodField()

    class Meta:
        model = EventInvitation
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
        )
        read_only_fields = ("id", "created_at", "use_count")

    def validate_token(self, value):
        value = (value or "").strip()
        if not value:
            return ""  # empty -> model.save() will auto-generate
        if not INVITATION_TOKEN_RE.match(value):
            raise serializers.ValidationError(
                "4 à 60 caractères : lettres, chiffres, tirets, underscores."
            )
        if EventInvitation.objects.filter(token=value).exists():
            raise serializers.ValidationError("Ce lien existe déjà, choisis-en un autre.")
        return value

    def get_is_valid(self, obj):
        ok, _ = obj.is_valid()
        return ok

    def get_invalid_reason(self, obj):
        _, reason = obj.is_valid()
        return reason


class EventInvitationPreviewSerializer(serializers.Serializer):
    event_name = serializers.CharField(source="event.name", read_only=True)
    organization_name = serializers.CharField(source="event.organization.name", read_only=True)
    event_start_date = serializers.DateTimeField(source="event.start_date", read_only=True)
    event_end_date = serializers.DateTimeField(source="event.end_date", read_only=True)
    is_valid = serializers.SerializerMethodField()
    invalid_reason = serializers.SerializerMethodField()

    def get_is_valid(self, obj):
        ok, _ = obj.is_valid()
        return ok

    def get_invalid_reason(self, obj):
        _, reason = obj.is_valid()
        return reason


class InvitationAcceptSerializer(serializers.Serializer):
    """Validates signup fields when accepting an invitation as anonymous user.

    Mirrors the validation rules of accounts.RegisterSerializer.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    nickname = serializers.CharField(max_length=60, required=False, allow_blank=True)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("Un compte avec cet email existe déjà.")
        return normalized

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Les mots de passe ne correspondent pas."}
            )
        return attrs
