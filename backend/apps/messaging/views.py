from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Message
from .serializers import MessageCreateSerializer, MessageSerializer

User = get_user_model()


class ConversationListView(APIView):
    """List conversations (grouped by other user)."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        # Get all users the current user has exchanged messages with
        sent_to = Message.objects.filter(sender=user).values_list("receiver", flat=True)
        received_from = Message.objects.filter(receiver=user).values_list("sender", flat=True)
        partner_ids = set(sent_to) | set(received_from)

        conversations = []
        for partner_id in partner_ids:
            partner = User.objects.get(id=partner_id)
            last_msg = (
                Message.objects.filter(
                    Q(sender=user, receiver=partner) | Q(sender=partner, receiver=user)
                )
                .order_by("-created_at")
                .first()
            )
            unread = Message.objects.filter(sender=partner, receiver=user, is_read=False).count()
            if last_msg:
                conversations.append(
                    {
                        "user_id": partner.id,
                        "username": partner.username,
                        "full_name": str(partner),
                        "last_message": last_msg.content[:100],
                        "last_date": last_msg.created_at,
                        "unread_count": unread,
                    }
                )

        conversations.sort(key=lambda c: c["last_date"], reverse=True)
        return Response(conversations)


class ThreadView(APIView):
    """Get message thread with a specific user."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, user_id):
        user = request.user
        messages = (
            Message.objects.filter(
                Q(sender=user, receiver_id=user_id) | Q(sender_id=user_id, receiver=user)
            )
            .select_related("sender", "receiver")
            .order_by("created_at")
        )

        # Mark received messages as read
        messages.filter(receiver=user, is_read=False).update(is_read=True)

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)


class SendMessageView(APIView):
    """Send a message."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data["receiver"] == request.user.id:
            return Response(
                {"detail": "Vous ne pouvez pas vous envoyer un message."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        msg = Message.objects.create(
            sender=request.user,
            receiver_id=serializer.validated_data["receiver"],
            content=serializer.validated_data["content"],
        )
        return Response(
            MessageSerializer(msg).data,
            status=status.HTTP_201_CREATED,
        )


class UnreadCountView(APIView):
    """Get total unread message count."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        count = Message.objects.filter(receiver=request.user, is_read=False).count()
        return Response({"unread_count": count})
