from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from apps.organizations.models import Organization, OrganizationMembership
from apps.organizations.serializers import (
    INVITE_CODE_RE,
    OrganizationCreateSerializer,
    OrganizationSerializer,
)

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    is_staff = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "is_staff", "is_placeholder")
        read_only_fields = ("id", "is_staff", "is_placeholder")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    # Optional org bootstrap
    action = serializers.ChoiceField(
        choices=[("create_org", "create_org"), ("join_org", "join_org")],
        write_only=True,
        required=False,
        allow_null=True,
    )
    org = OrganizationCreateSerializer(write_only=True, required=False)
    invite_code = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "action",
            "org",
            "invite_code",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Les mots de passe ne correspondent pas."}
            )
        action = attrs.get("action")
        if action == "create_org" and not attrs.get("org"):
            raise serializers.ValidationError(
                {"org": "Champ requis quand action=create_org."}
            )
        if action == "join_org":
            code = attrs.get("invite_code", "").strip()
            if not code:
                raise serializers.ValidationError(
                    {"invite_code": "Champ requis quand action=join_org."}
                )
            if not INVITE_CODE_RE.match(code):
                raise serializers.ValidationError(
                    {"invite_code": "Format invalide."}
                )
            normalized = code.lower()
            if not Organization.objects.filter(invite_code=normalized).exists():
                raise serializers.ValidationError(
                    {"invite_code": "Code d'invitation invalide."}
                )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        action = validated_data.pop("action", None)
        org_data = validated_data.pop("org", None)
        invite_code = validated_data.pop("invite_code", None)

        with transaction.atomic():
            user = User.objects.create_user(**validated_data)
            self._created_org = None
            if action == "create_org" and org_data:
                # Re-validate via OrganizationCreateSerializer for slug auto-gen + invite_code unicity
                org_ser = OrganizationCreateSerializer(data=org_data)
                org_ser.is_valid(raise_exception=True)
                org = org_ser.save(created_by=user)
                OrganizationMembership.objects.create(
                    user=user,
                    organization=org,
                    role=OrganizationMembership.Role.ADMIN,
                )
                self._created_org = org
            elif action == "join_org" and invite_code:
                org = Organization.objects.get(invite_code=invite_code.lower())
                OrganizationMembership.objects.create(
                    user=user,
                    organization=org,
                    role=OrganizationMembership.Role.MEMBER,
                )
                self._created_org = org
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    event_memberships = serializers.SerializerMethodField()
    org_memberships = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name",
            "is_staff", "is_active", "date_joined", "last_login",
            "event_memberships", "org_memberships",
        )
        read_only_fields = ("id", "date_joined", "last_login", "is_staff")

    def get_event_memberships(self, obj):
        from apps.events.models import EventMembership
        return [
            {
                "event_id": m.event_id,
                "event_name": m.event.name,
                "role": m.role,
            }
            for m in EventMembership.objects.filter(user=obj).select_related("event")
        ]

    def get_org_memberships(self, obj):
        return [
            {
                "organization_id": m.organization_id,
                "organization_name": m.organization.name,
                "role": m.role,
            }
            for m in OrganizationMembership.objects.filter(user=obj).select_related("organization")
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Les mots de passe ne correspondent pas."}
            )
        return attrs
