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


def create_assignment(user, slot, start_date, end_date, force=False):
    """
    Create an assignment for a user on a slot with chosen time range.

    - Validates times are within slot boundaries
    - Checks for duplicate assignment
    - Checks for time overlap with other confirmed assignments
    - Auto-sets status to backup if slot is full
    - force=True (admin) skips overlap check and forces confirmed status
    """
    # Validate within slot
    validate_within_slot(slot, start_date, end_date)

    # Check duplicate
    existing = Assignment.objects.filter(user=user, slot=slot).first()
    if existing:
        raise AlreadyAssignedError("Vous êtes déjà inscrit sur ce créneau.")

    if force:
        return Assignment.objects.create(
            user=user,
            slot=slot,
            start_date=start_date,
            end_date=end_date,
            status=Assignment.Status.CONFIRMED,
        )

    # Check overlap with other assignments
    overlap = check_overlap(user, start_date, end_date, exclude_slot=slot)
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

    return Assignment.objects.create(
        user=user,
        slot=slot,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )


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
