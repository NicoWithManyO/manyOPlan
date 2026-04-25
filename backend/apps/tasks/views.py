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
