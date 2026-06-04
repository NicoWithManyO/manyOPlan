from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tasks.models import Slot
from core.permissions import IsEventAdmin, IsEventMember

from .models import Assignment
from .serializers import (
    AssignmentCreateSerializer,
    AssignmentSerializer,
    AssignmentStatusSerializer,
    MyAssignmentSerializer,
)
from .services import (
    AssignmentError,
    create_assignment,
    update_assignment_status,
)

User = get_user_model()


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    # Le planning d'un event affiche toutes les inscriptions : pas de pagination
    pagination_class = None
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
        from django.utils.timezone import localtime

        from .services import validate_within_slot

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

        # Always reject if the new range would overlap another plage of the same user
        # (intra-slot or cross-slot). Admin included — overlap is incoherent data.
        self_overlap = (
            Assignment.objects.filter(
                user=assignment.user,
                start_date__lt=parsed_end,
                end_date__gt=parsed_start,
            )
            .exclude(id=assignment.id)
            .select_related("slot__task")
            .first()
        )
        if self_overlap:
            s = localtime(self_overlap.start_date)
            e = localtime(self_overlap.end_date)
            return Response(
                {"detail": f"Chevauchement avec « {self_overlap.slot.task.name} » "
                           f"({s:%H:%M}-{e:%H:%M})."},
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

        # Reject if the moving plage overlaps another plage of this user on the target slot.
        conflict = (
            Assignment.objects.filter(
                user=assignment.user,
                slot=new_slot,
                status=Assignment.Status.CONFIRMED,
                start_date__lt=assignment.end_date,
                end_date__gt=assignment.start_date,
            )
            .exclude(id=assignment.id)
            .first()
        )
        if conflict:
            return Response(
                {"detail": "Chevauchement avec une autre inscription sur ce créneau."},
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


class MyAssignmentsView(APIView):
    """All upcoming/in-progress assignments for the current user, across all orgs."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        qs = (
            Assignment.objects.filter(
                user=request.user, end_date__gte=timezone.now()
            )
            .select_related("slot__task__event__organization")
            .order_by("start_date")
        )
        return Response(MyAssignmentSerializer(qs, many=True).data)
