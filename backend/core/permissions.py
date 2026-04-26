from rest_framework.permissions import BasePermission


def _resolve_event(obj):
    """Find the Event tied to obj, traversing Task/Slot/Assignment if needed."""
    from apps.events.models import Event

    if isinstance(obj, Event):
        return obj
    # Direct .event (Task, EventMembership, News, …)
    event = getattr(obj, "event", None)
    if event:
        return event
    # Slot has .task.event
    task = getattr(obj, "task", None)
    if task is not None:
        return getattr(task, "event", None)
    # Assignment has .slot.task.event
    slot = getattr(obj, "slot", None)
    if slot is not None:
        task = getattr(slot, "task", None)
        if task is not None:
            return getattr(task, "event", None)
    return None


class IsOrgMember(BasePermission):
    """User has any membership on the org in context."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        org_pk = view.kwargs.get("organization_pk") or view.kwargs.get("pk")
        if not org_pk:
            return False
        from apps.organizations.models import OrganizationMembership

        return OrganizationMembership.objects.filter(
            user=request.user, organization_id=org_pk
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        from apps.organizations.models import Organization, OrganizationMembership

        org = obj if isinstance(obj, Organization) else getattr(obj, "organization", None)
        if not org:
            return False
        return OrganizationMembership.objects.filter(
            user=request.user, organization=org
        ).exists()


class IsOrgAdmin(BasePermission):
    """User is admin of the org in context."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        org_pk = view.kwargs.get("organization_pk") or view.kwargs.get("pk")
        if not org_pk:
            return False
        from apps.organizations.models import OrganizationMembership

        return OrganizationMembership.objects.filter(
            user=request.user,
            organization_id=org_pk,
            role=OrganizationMembership.Role.ADMIN,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        from apps.organizations.models import Organization, OrganizationMembership

        org = obj if isinstance(obj, Organization) else getattr(obj, "organization", None)
        if not org:
            return False
        return OrganizationMembership.objects.filter(
            user=request.user,
            organization=org,
            role=OrganizationMembership.Role.ADMIN,
        ).exists()


class IsEventAdmin(BasePermission):
    """User is admin of the event (via EventMembership or via parent Org admin)."""

    def _is_org_admin_of_event(self, user, event):
        from apps.organizations.models import OrganizationMembership

        return OrganizationMembership.objects.filter(
            user=user,
            organization_id=event.organization_id,
            role=OrganizationMembership.Role.ADMIN,
        ).exists()

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        event_pk = view.kwargs.get("event_pk") or view.kwargs.get("pk")
        if not event_pk:
            return False
        from apps.events.models import Event, EventMembership

        try:
            event = Event.objects.only("id", "organization_id").get(pk=event_pk)
        except Event.DoesNotExist:
            return False
        if self._is_org_admin_of_event(request.user, event):
            return True
        return EventMembership.objects.filter(
            user=request.user,
            event_id=event_pk,
            role=EventMembership.Role.ADMIN,
        ).exists()

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        from apps.events.models import Event, EventMembership

        event = _resolve_event(obj)
        if not event:
            return False
        if self._is_org_admin_of_event(request.user, event):
            return True
        return EventMembership.objects.filter(
            user=request.user,
            event=event,
            role=EventMembership.Role.ADMIN,
        ).exists()


class IsEventMember(BasePermission):
    """User is a member of the event (via EventMembership or via parent Org membership)."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_staff:
            return True
        event_pk = view.kwargs.get("event_pk") or view.kwargs.get("pk")
        if not event_pk:
            return False
        from apps.events.models import Event, EventMembership
        from apps.organizations.models import OrganizationMembership

        try:
            event = Event.objects.only("id", "organization_id").get(pk=event_pk)
        except Event.DoesNotExist:
            return False
        if OrganizationMembership.objects.filter(
            user=request.user, organization_id=event.organization_id
        ).exists():
            return True
        return EventMembership.objects.filter(
            user=request.user, event_id=event_pk
        ).exists()
