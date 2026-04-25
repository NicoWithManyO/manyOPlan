from rest_framework import permissions, viewsets

from core.permissions import IsEventAdmin, IsEventMember

from .models import News
from .serializers import NewsCreateSerializer, NewsSerializer


class EventNewsViewSet(viewsets.ModelViewSet):
    """News scoped to an event."""

    def get_queryset(self):
        return News.objects.filter(event_id=self.kwargs["event_pk"]).select_related("author")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return NewsCreateSerializer
        return NewsSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [permissions.IsAuthenticated(), IsEventMember()]
        return [permissions.IsAuthenticated(), IsEventAdmin()]

    def perform_create(self, serializer):
        serializer.save(
            author=self.request.user,
            event_id=self.kwargs["event_pk"],
        )
