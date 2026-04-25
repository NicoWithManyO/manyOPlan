from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.tasks.models import Slot
from core.permissions import IsEventAdmin, IsEventMember

from .models import Assignment
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentSerializer,
    AssignmentStatusSerializer,
)
from .services import (
    AssignmentError,
    create_assignment,
    update_assignment_status,
)

User = get_user_model()


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return (
            Assignment.objects.filter(slot__task__event_id=self.kwargs["event_pk"])
            .select_related("user", "slot", "slot__task")
            .order_by("slot__start_date", "assigned_at")
        )

    def get_permissions(self):
        if self.action in ("list", "retrieve", "my_assignments"):
            return [permissions.IsAuthenticated(), IsEventMember()]
        if self.action == "create":
            return [permissions.IsAuthenticated(), IsEventMember()]
        # update status, delete: admin or self
        return [permissions.IsAuthenticated()]

    def create(self, request, event_pk=None):
        serializer = AssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        slot_id = serializer.validated_data["slot"]
        user_id = serializer.validated_data.get("user")
        force = serializer.validated_data.get("force", False)

        try:
            slot = Slot.objects.select_related("task").get(id=slot_id, task__event_id=event_pk)
        except Slot.DoesNotExist:
            return Response(
                {"detail": "Créneau introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Determine target user
        if user_id and user_id != request.user.id:
            # Admin assigning someone else
            if not IsEventAdmin().has_permission(request, self):
                return Response(
                    {"detail": "Seul un admin peut affecter un autre utilisateur."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {"detail": "Utilisateur introuvable."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            target_user = request.user
            force = False  # Non-admin cannot force

        # Admin check for force
        if force and not IsEventAdmin().has_permission(request, self):
            force = False

        start_date = serializer.validated_data["start_date"]
        end_date = serializer.validated_data["end_date"]

        try:
            assignment = create_assignment(
                target_user, slot, start_date, end_date, force=force,
            )
        except AssignmentError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            AssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["patch"], serializer_class=AssignmentStatusSerializer)
    def change_status(self, request, event_pk=None, pk=None):
        assignment = self.get_object()

        # Only admin can change status
        if not IsEventAdmin().has_permission(request, self):
            return Response(
                {"detail": "Seul un admin peut modifier le statut."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AssignmentStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            assignment = update_assignment_status(
                assignment,
                serializer.validated_data["status"],
                force=True,
            )
        except AssignmentError as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(AssignmentSerializer(assignment).data)

    @action(detail=True, methods=["patch"], url_path="update-times")
    def update_times(self, request, event_pk=None, pk=None):
        """Update the chosen time range of an assignment."""
        assignment = self.get_object()
        # Self or admin
        is_admin = IsEventAdmin().has_permission(request, self)
        if assignment.user != request.user and not is_admin:
            return Response(
                {"detail": "Non autorisé."},
                status=status.HTTP_403_FORBIDDEN,
            )

        start_date = request.data.get("start_date")
        end_date = request.data.get("end_date")
        if not start_date or not end_date:
            return Response(
                {"detail": "start_date et end_date requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.utils.dateparse import parse_datetime
        from .services import check_overlap, validate_within_slot
        from django.utils.timezone import localtime

        parsed_start = parse_datetime(start_date)
        parsed_end = parse_datetime(end_date)
        if not parsed_start or not parsed_end:
            return Response(
                {"detail": "Format de date invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_within_slot(assignment.slot, parsed_start, parsed_end)
        except AssignmentError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Check overlap with new times (exclude current assignment's slot)
        if assignment.status == "confirmed" and not is_admin:
            overlap = check_overlap(
                assignment.user, parsed_start, parsed_end,
                exclude_slot=assignment.slot,
            )
            if overlap:
                return Response(
                    {"detail": f"Chevauchement avec « {overlap.slot.task.name} »."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        assignment.start_date = parsed_start
        assignment.end_date = parsed_end
        assignment.save(update_fields=["start_date", "end_date"])
        return Response(AssignmentSerializer(assignment).data)

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        # Self or admin can delete
        is_admin = IsEventAdmin().has_permission(request, self)
        if assignment.user != request.user and not is_admin:
            return Response(
                {"detail": "Vous ne pouvez supprimer que vos propres inscriptions."},
                status=status.HTTP_403_FORBIDDEN,
            )
        target_user = assignment.user
        assignment.delete()
        # Clean up placeholder user if they have no more assignments
        if target_user.is_placeholder and not Assignment.objects.filter(user=target_user).exists():
            target_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="move")
    def move(self, request, event_pk=None, pk=None):
        """Move an assignment to a different slot (admin only)."""
        if not IsEventAdmin().has_permission(request, self):
            return Response(
                {"detail": "Seul un admin peut déplacer une affectation."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment = self.get_object()
        new_slot_id = request.data.get("slot")
        if not new_slot_id:
            return Response(
                {"detail": "Le champ slot est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            new_slot = Slot.objects.select_related("task").get(
                id=new_slot_id, task__event_id=event_pk
            )
        except Slot.DoesNotExist:
            return Response(
                {"detail": "Créneau cible introuvable."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if already assigned to target slot
        if Assignment.objects.filter(user=assignment.user, slot=new_slot).exists():
            return Response(
                {"detail": "Déjà inscrit sur ce créneau."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment.slot = new_slot
        assignment.save(update_fields=["slot"])
        return Response(AssignmentSerializer(assignment).data)

    @action(detail=False, methods=["get"], url_path="mine")
    def my_assignments(self, request, event_pk=None):
        qs = self.get_queryset().filter(user=request.user)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
