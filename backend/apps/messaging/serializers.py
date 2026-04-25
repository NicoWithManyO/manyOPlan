from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Message

User = get_user_model()


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "sender",
            "sender_name",
            "receiver",
            "receiver_name",
            "content",
            "created_at",
            "is_read",
        )
        read_only_fields = ("id", "sender", "created_at", "is_read")

    def get_sender_name(self, obj):
        return str(obj.sender)

    def get_receiver_name(self, obj):
        return str(obj.receiver)


class MessageCreateSerializer(serializers.Serializer):
    receiver = serializers.IntegerField()
    content = serializers.CharField()

    def validate_receiver(self, value):
        if not User.objects.filter(id=value).exists():
            raise serializers.ValidationError("Utilisateur introuvable.")
        return value


class ConversationSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    username = serializers.CharField()
    full_name = serializers.CharField()
    last_message = serializers.CharField()
    last_date = serializers.DateTimeField()
    unread_count = serializers.IntegerField()
