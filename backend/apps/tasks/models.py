from django.core.exceptions import ValidationError
from django.db import models

from apps.events.models import Event
from core.mixins import TimestampMixin


class Task(TimestampMixin):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    name = models.CharField(max_length=255, verbose_name="Nom")
    description = models.TextField(blank=True, verbose_name="Description")
    min_volunteers = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Min bénévoles",
    )
    max_volunteers = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Max bénévoles",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordre")

    class Meta:
        verbose_name = "Tâche"
        verbose_name_plural = "Tâches"
        ordering = ["order", "name"]

    def __str__(self):
        return f"{self.name} ({self.event.name})"


class Slot(TimestampMixin):
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="slots",
    )
    start_date = models.DateTimeField(verbose_name="Début")
    end_date = models.DateTimeField(verbose_name="Fin")
    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Capacité",
        help_text="Null = illimité",
    )
    order = models.PositiveIntegerField(default=0, verbose_name="Ordre")

    class Meta:
        verbose_name = "Créneau"
        verbose_name_plural = "Créneaux"
        ordering = ["start_date", "order"]

    def __str__(self):
        return f"{self.task.name}: {self.start_date:%d/%m %H:%M} - {self.end_date:%H:%M}"

    def clean(self):
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError({"end_date": "La date de fin doit être après la date de début."})

    @property
    def confirmed_count(self):
        return self.assignments.filter(status="confirmed").count()

    @property
    def is_full(self):
        if self.capacity is None:
            return False
        return self.confirmed_count >= self.capacity
