from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Assignment

User = get_user_model()


class AssignmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    full_name = serializers.SerializerMethodField()
    is_placeholder = serializers.BooleanField(source="user.is_placeholder", read_only=True)
    slot_start = serializers.DateTimeField(source="slot.start_date", read_only=True)
    slot_end = serializers.DateTimeField(source="slot.end_date", read_only=True)
    task_name = serializers.CharField(source="slot.task.name", read_only=True)

    class Meta:
        model = Assignment
        fields = (
            "id",
            "user",
            "username",
            "full_name",
            "is_placeholder",
            "slot",
            "slot_start",
            "slot_end",
            "start_date",
            "end_date",
            "task_name",
            "status",
            "assigned_at",
        )
        read_only_fields = ("id", "assigned_at")

    def get_full_name(self, obj):
        return str(obj.user)


class AssignmentCreateSerializer(serializers.Serializer):
    slot = serializers.IntegerField()
    start_date = serializers.DateTimeField()
    end_date = serializers.DateTimeField()
    user = serializers.IntegerField(required=False)
    force = serializers.BooleanField(default=False)

    def validate(self, attrs):
        if attrs["start_date"] >= attrs["end_date"]:
            raise serializers.ValidationError(
                {"end_date": "La fin doit être après le début."}
            )
        return attrs


class AssignmentStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Assignment.Status.choices)
