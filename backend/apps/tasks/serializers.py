from rest_framework import serializers

from .models import Slot, Task


class SlotSerializer(serializers.ModelSerializer):
    confirmed_count = serializers.IntegerField(read_only=True)
    is_full = serializers.BooleanField(read_only=True)

    class Meta:
        model = Slot
        fields = (
            "id",
            "task",
            "start_date",
            "end_date",
            "capacity",
            "order",
            "confirmed_count",
            "is_full",
            "created_at",
        )
        read_only_fields = ("id", "task", "created_at")

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and start >= end:
            raise serializers.ValidationError(
                {"end_date": "La date de fin doit être après la date de début."}
            )
        return attrs


class SlotCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slot
        fields = ("start_date", "end_date", "capacity", "order")

    def validate(self, attrs):
        if attrs.get("start_date") and attrs.get("end_date"):
            if attrs["start_date"] >= attrs["end_date"]:
                raise serializers.ValidationError(
                    {"end_date": "La date de fin doit être après la date de début."}
                )
        return attrs


class BulkSlotCreateSerializer(serializers.Serializer):
    slots = SlotCreateSerializer(many=True)

    def validate_slots(self, value):
        if not value:
            raise serializers.ValidationError("Au moins un créneau requis.")
        if len(value) > 50:
            raise serializers.ValidationError("Maximum 50 créneaux à la fois.")
        return value


class TaskSerializer(serializers.ModelSerializer):
    slots = SlotSerializer(many=True, read_only=True)
    slot_count = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "event",
            "name",
            "description",
            "min_volunteers",
            "max_volunteers",
            "order",
            "slots",
            "slot_count",
            "created_at",
        )
        read_only_fields = ("id", "event", "created_at")

    def get_slot_count(self, obj):
        return obj.slots.count()


class TaskCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ("id", "name", "description", "min_volunteers", "max_volunteers", "order")
        read_only_fields = ("id",)


class TaskReorderSerializer(serializers.Serializer):
    task_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
