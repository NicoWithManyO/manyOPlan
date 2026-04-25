from django.contrib import admin

from .models import Slot, Task


class SlotInline(admin.TabularInline):
    model = Slot
    extra = 0


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("name", "event", "order", "min_volunteers", "max_volunteers")
    list_filter = ("event",)
    inlines = [SlotInline]


@admin.register(Slot)
class SlotAdmin(admin.ModelAdmin):
    list_display = ("task", "start_date", "end_date", "capacity", "order")
    list_filter = ("task__event",)
