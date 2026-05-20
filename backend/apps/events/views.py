from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.serializers import UserSerializer
from apps.organizations.models import OrganizationMembership
from core.permissions import IsEventAdmin, IsEventMember

from .models import Event, EventInvitation, EventMembership
from .serializers import (
    EventCreateSerializer,
    EventInvitationPreviewSerializer,
    EventInvitationSerializer,
    EventMembershipSerializer,
    EventSerializer,
    InvitationAcceptSerializer,
    JoinEventSerializer,
)

User = get_user_model()


class EventViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            qs = Event.objects.all()
        else:
            qs = Event.objects.filter(
                organization__memberships__user=user
            ).distinct()
        # Optional ?organization=:id filter
        org_id = self.request.query_params.get("organization")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        return qs.select_related("organization")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EventCreateSerializer
        return EventSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated()]
        if self.action == "create":
            return [permissions.IsAuthenticated()]
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsEventAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        event = serializer.save()
        # Auto-add creator as event admin (consistent with previous behavior)
        EventMembership.objects.create(
            user=self.request.user,
            event=event,
            role=EventMembership.Role.ADMIN,
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["request"] = self.request
        return context

    @action(
        detail=True,
        methods=["get"],
        permission_classes=[permissions.IsAuthenticated, IsEventAdmin],
    )
    def dashboard(self, request, pk=None):
        event = self.get_object()

        from apps.assignments.models import Assignment
        from apps.tasks.models import Slot, Task

        tasks = Task.objects.filter(event=event)
        slots = Slot.objects.filter(task__event=event)
        assignments = Assignment.objects.filter(slot__task__event=event)
        members = event.memberships.all()

        task_stats = []
        for task in tasks.prefetch_related("slots__assignments"):
            task_slots = task.slots.all()
            total_capacity = 0
            total_confirmed = 0
            incomplete_slots = 0
            for slot in task_slots:
                confirmed = slot.assignments.filter(status="confirmed").count()
                total_confirmed += confirmed
                if slot.capacity is not None:
                    total_capacity += slot.capacity
                    if confirmed < slot.capacity:
                        incomplete_slots += 1
            task_stats.append(
                {
                    "id": task.id,
                    "name": task.name,
                    "slot_count": task_slots.count(),
                    "total_capacity": total_capacity if total_capacity > 0 else None,
                    "total_confirmed": total_confirmed,
                    "incomplete_slots": incomplete_slots,
                }
            )

        assigned_user_ids = set(assignments.values_list("user_id", flat=True))
        member_user_ids = set(members.filter(role="volunteer").values_list("user_id", flat=True))
        free_volunteer_ids = member_user_ids - assigned_user_ids

        from django.contrib.auth import get_user_model

        User = get_user_model()
        free_volunteers = [
            {"id": u.id, "username": u.username, "full_name": str(u)}
            for u in User.objects.filter(id__in=free_volunteer_ids)
        ]

        return Response(
            {
                "total_tasks": tasks.count(),
                "total_slots": slots.count(),
                "total_members": members.count(),
                "total_volunteers": members.filter(role="volunteer").count(),
                "total_assignments": assignments.count(),
                "total_confirmed": assignments.filter(status="confirmed").count(),
                "total_backup": assignments.filter(status="backup").count(),
                "free_volunteers": free_volunteers,
                "free_volunteer_count": len(free_volunteers),
                "task_stats": task_stats,
            }
        )

    @action(detail=True, methods=["post"], serializer_class=JoinEventSerializer)
    def join(self, request, pk=None):
        event = self.get_object()
        # Must be member of the org first
        is_org_member = OrganizationMembership.objects.filter(
            user=request.user, organization_id=event.organization_id
        ).exists()
        if not is_org_member and not request.user.is_staff:
            return Response(
                {"detail": "Vous devez d'abord rejoindre l'association."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if EventMembership.objects.filter(user=request.user, event=event).exists():
            return Response(
                {"detail": "Vous êtes déjà membre de cet événement."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        EventMembership.objects.create(
            user=request.user,
            event=event,
            role=EventMembership.Role.VOLUNTEER,
        )
        return Response(
            {"detail": "Vous avez rejoint l'événement."},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def leave(self, request, pk=None):
        event = self.get_object()
        membership = EventMembership.objects.filter(user=request.user, event=event).first()
        if not membership:
            return Response(
                {"detail": "Vous n'êtes pas membre de cet événement."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if membership.role == EventMembership.Role.ADMIN:
            admin_count = event.memberships.filter(role=EventMembership.Role.ADMIN).count()
            if admin_count <= 1:
                return Response(
                    {"detail": "Impossible de quitter : vous êtes le seul admin."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventMembershipViewSet(viewsets.ModelViewSet):
    serializer_class = EventMembershipSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return EventMembership.objects.filter(event_id=self.kwargs["event_pk"]).select_related(
            "user"
        )

    def get_permissions(self):
        if self.action == "list":
            return [permissions.IsAuthenticated(), IsEventMember()]
        return [permissions.IsAuthenticated(), IsEventAdmin()]

    def perform_create(self, serializer):
        serializer.save(event_id=self.kwargs["event_pk"])


class EventInvitationListCreateView(generics.ListCreateAPIView):
    """Admin: list and create invitations for an event."""

    serializer_class = EventInvitationSerializer
    permission_classes = (permissions.IsAuthenticated, IsEventAdmin)
    pagination_class = None

    def get_queryset(self):
        return EventInvitation.objects.filter(event_id=self.kwargs["event_pk"])

    def perform_create(self, serializer):
        event = get_object_or_404(Event, pk=self.kwargs["event_pk"])
        serializer.save(event=event, created_by=self.request.user)


class EventInvitationDetailView(generics.DestroyAPIView):
    """Admin: delete an invitation."""

    serializer_class = EventInvitationSerializer
    permission_classes = (permissions.IsAuthenticated, IsEventAdmin)

    def get_queryset(self):
        return EventInvitation.objects.filter(event_id=self.kwargs["event_pk"])


class InvitationPreviewView(APIView):
    """Public: get a lightweight preview of an invitation by token."""

    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        invitation = get_object_or_404(
            EventInvitation.objects.select_related("event", "event__organization"),
            token=token,
        )
        return Response(EventInvitationPreviewSerializer(invitation).data)


class InvitationAcceptView(APIView):
    """Public: accept an invitation. If unauthenticated, creates a user.

    Adds the user to the org (as MEMBER) and to the event (as VOLUNTEER).
    """

    permission_classes = (permissions.AllowAny,)

    def post(self, request, token):
        invitation = get_object_or_404(
            EventInvitation.objects.select_related("event", "event__organization"),
            token=token,
        )
        ok, reason = invitation.is_valid()
        if not ok:
            return Response(
                {"detail": "Cette invitation n'est plus valide.", "invalid_reason": reason},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_signup = not request.user.is_authenticated
        signup_data = None
        if is_signup:
            serializer = InvitationAcceptSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            signup_data = serializer.validated_data

        with transaction.atomic():
            # Re-fetch under transaction & validate again (cheap)
            invitation = (
                EventInvitation.objects.select_for_update()
                .select_related("event", "event__organization")
                .get(pk=invitation.pk)
            )
            ok, reason = invitation.is_valid()
            if not ok:
                return Response(
                    {"detail": "Cette invitation n'est plus valide.", "invalid_reason": reason},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if is_signup:
                user = User.objects.create_user(
                    username=signup_data["email"],
                    email=signup_data["email"],
                    password=signup_data["password"],
                    first_name=signup_data["first_name"],
                    last_name=signup_data["last_name"],
                    nickname=signup_data.get("nickname", ""),
                )
            else:
                user = request.user

            OrganizationMembership.objects.get_or_create(
                user=user,
                organization=invitation.event.organization,
                defaults={"role": OrganizationMembership.Role.MEMBER},
            )
            EventMembership.objects.get_or_create(
                user=user,
                event=invitation.event,
                defaults={"role": EventMembership.Role.VOLUNTEER},
            )

            invitation.use_count = invitation.use_count + 1
            invitation.save(update_fields=["use_count"])

        payload = {
            "user": UserSerializer(user).data,
            "event_id": invitation.event_id,
            "organization_id": invitation.event.organization_id,
        }
        if is_signup:
            refresh = RefreshToken.for_user(user)
            payload["tokens"] = {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        return Response(payload, status=status.HTTP_200_OK)
