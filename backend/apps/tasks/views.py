from datetime import timedelta

from django.db import transaction
from django.utils.timezone import localtime
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsEventAdmin, IsEventMember

from .models import Slot, Task
from .serializers import (
    BulkSlotCreateSerializer,
    SlotCreateSerializer,
    SlotSerializer,
    TaskCreateSerializer,
    TaskReorderSerializer,
    TaskSerializer,
)


class TaskViewSet(viewsets.ModelViewSet):
    # Le planning d'un event affiche toutes les colonnes : pas de pagination
    pagination_class = None

    def get_queryset(self):
        return (
            Task.objects.filter(event_id=self.kwargs["event_pk"])
            .prefetch_related("slots")
            .order_by("order", "name")
        )

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return TaskCreateSerializer
        return TaskSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), IsEventMember()]
        return [permissions.IsAuthenticated(), IsEventAdmin()]

    def perform_create(self, serializer):
        serializer.save(event_id=self.kwargs["event_pk"])

    @action(detail=False, methods=["post"], serializer_class=TaskReorderSerializer)
    def reorder(self, request, event_pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task_ids = serializer.validated_data["task_ids"]

        tasks = Task.objects.filter(event_id=event_pk, id__in=task_ids)
        task_map = {t.id: t for t in tasks}

        updates = []
        for order, task_id in enumerate(task_ids):
            if task_id in task_map:
                task = task_map[task_id]
                task.order = order
                updates.append(task)

        Task.objects.bulk_update(updates, ["order"])
        return Response({"detail": "Ordre mis à jour."})


class SlotViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        return Slot.objects.filter(
            task_id=self.kwargs["task_pk"],
            task__event_id=self.kwargs["event_pk"],
        ).order_by("start_date", "order")

    def get_serializer_class(self):
        if self.action == "bulk_create":
            return BulkSlotCreateSerializer
        if self.action in ("create", "update", "partial_update"):
            return SlotCreateSerializer
        return SlotSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), IsEventMember()]
        return [permissions.IsAuthenticated(), IsEventAdmin()]

    def perform_create(self, serializer):
        serializer.save(task_id=self.kwargs["task_pk"])

    def partial_update(self, request, *args, **kwargs):
        return self._update_slot(request, partial=True)

    def update(self, request, *args, **kwargs):
        return self._update_slot(request, partial=False)

    def _update_slot(self, request, partial):
        slot = self.get_object()
        old_start = slot.start_date
        old_end = slot.end_date

        serializer = self.get_serializer(slot, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        new_start = serializer.validated_data.get("start_date", old_start)
        new_end = serializer.validated_data.get("end_date", old_end)
        delta = new_start - old_start

        # Pre-validate: every assignment, once shifted by `delta`, must still
        # fit inside the new slot range. Otherwise reject with a clear error.
        from apps.assignments.models import Assignment
        for assn in Assignment.objects.filter(slot=slot).select_related("user"):
            shifted_start = assn.start_date + delta
            shifted_end = assn.end_date + delta
            if shifted_start < new_start or shifted_end > new_end:
                return Response(
                    {"detail": (
                        f"L'inscription de {assn.user.display_name} "
                        f"({localtime(assn.start_date):%H:%M}-{localtime(assn.end_date):%H:%M}) "
                        f"ne tiendrait plus dans le nouveau créneau."
                    )},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            serializer.save()
            if delta != timedelta(0):
                # Shift every assignment by the same delta to preserve relative timing.
                for assn in Assignment.objects.filter(slot=slot):
                    assn.start_date += delta
                    assn.end_date += delta
                    assn.save(update_fields=["start_date", "end_date"])

        slot.refresh_from_db()
        return Response(SlotSerializer(slot).data)

    @action(
        detail=False,
        methods=["post"],
        serializer_class=BulkSlotCreateSerializer,
        url_path="bulk",
    )
    def bulk_create(self, request, event_pk=None, task_pk=None):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        slots = [
            Slot(task_id=task_pk, **slot_data) for slot_data in serializer.validated_data["slots"]
        ]
        created = Slot.objects.bulk_create(slots)
        return Response(
            SlotSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )
