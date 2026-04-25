from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.organizations.models import Organization, OrganizationMembership

from .models import Event, EventMembership

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
        return str(obj.user)


class JoinEventSerializer(serializers.Serializer):
    """Serializer for a volunteer joining an event (no fields needed)."""

    pass
