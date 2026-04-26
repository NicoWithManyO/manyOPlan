from django.db.models import Q
from django.utils.timezone import localtime

from .models import Assignment


class AssignmentError(Exception):
    pass


class OverlapError(AssignmentError):
    pass


class AlreadyAssignedError(AssignmentError):
    pass


def check_overlap(user, start_date, end_date, exclude_slot=None):
    """Check if user has any confirmed assignment overlapping with this time range."""
    qs = Assignment.objects.filter(
        user=user,
        status=Assignment.Status.CONFIRMED,
    ).filter(
        Q(start_date__lt=end_date) & Q(end_date__gt=start_date)
    ).select_related("slot", "slot__task")

    if exclude_slot:
        qs = qs.exclude(slot=exclude_slot)

    return qs.first()


def validate_within_slot(slot, start_date, end_date):
    """Validate that the chosen times fall within the slot boundaries."""
    if start_date < slot.start_date:
        raise AssignmentError(
            f"Le début doit être après {localtime(slot.start_date):%H:%M}."
        )
    if end_date > slot.end_date:
        raise AssignmentError(
            f"La fin doit être avant {localtime(slot.end_date):%H:%M}."
        )
    if start_date >= end_date:
        raise AssignmentError("La fin doit être après le début.")


def _ensure_event_membership(user, event):
    """Auto-enroll the user in the event when they get an assignment.
    Skipped for placeholder accounts (they are slot fillers, not real members).
    """
    if getattr(user, "is_placeholder", False):
        return
    from apps.events.models import EventMembership

    EventMembership.objects.get_or_create(
        user=user,
        event=event,
        defaults={"role": EventMembership.Role.VOLUNTEER},
    )


def create_assignment(user, slot, start_date, end_date, force=False):
    """
    Create an assignment for a user on a slot with chosen time range.

    - Validates times are within slot boundaries
    - Checks for time overlap (intra and cross-slot)
    - Auto-sets status to backup if slot is full
    - force=True (admin) skips capacity-based status and cross-slot overlap,
      but still rejects intra-user overlapping plages
    - Auto-enrolls the user as a volunteer of the event on their first assignment
    """
    # Validate within slot
    validate_within_slot(slot, start_date, end_date)

    if force:
        # Even with admin force, never write data where the same user has two
        # plages overlapping in time — that's incoherent, not a rule to override.
        self_overlap = (
            Assignment.objects.filter(
                user=user,
                start_date__lt=end_date,
                end_date__gt=start_date,
            )
            .select_related("slot__task")
            .first()
        )
        if self_overlap:
            s = localtime(self_overlap.start_date)
            e = localtime(self_overlap.end_date)
            raise OverlapError(
                f"Chevauchement avec « {self_overlap.slot.task.name} » "
                f"({s:%H:%M}-{e:%H:%M})."
            )
        assignment = Assignment.objects.create(
            user=user,
            slot=slot,
            start_date=start_date,
            end_date=end_date,
            status=Assignment.Status.CONFIRMED,
        )
        _ensure_event_membership(user, slot.task.event)
        return assignment

    # Check overlap with any other confirmed assignment of this user
    # (including additional plages on the same slot).
    overlap = check_overlap(user, start_date, end_date)
    if overlap:
        start = localtime(overlap.start_date)
        end = localtime(overlap.end_date)
        raise OverlapError(
            f"Chevauchement avec "
            f"« {overlap.slot.task.name} » "
            f"({start:%H:%M}-{end:%H:%M})."
        )

    # Determine status based on capacity
    status = Assignment.Status.BACKUP if slot.is_full else Assignment.Status.CONFIRMED

    assignment = Assignment.objects.create(
        user=user,
        slot=slot,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )
    _ensure_event_membership(user, slot.task.event)
    return assignment


def update_assignment_status(assignment, new_status, force=False):
    """
    Update assignment status.
    If promoting to confirmed, check overlap (unless force).
    """
    if new_status == Assignment.Status.CONFIRMED and not force:
        overlap = check_overlap(
            assignment.user, assignment.start_date, assignment.end_date,
            exclude_slot=assignment.slot,
        )
        if overlap:
            raise OverlapError(f"Chevauchement avec « {overlap.slot.task.name} ».")

    assignment.status = new_status
    assignment.save(update_fields=["status"])
    return assignment
