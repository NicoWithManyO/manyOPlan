from django.contrib import admin

from .models import Assignment


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ("user", "slot", "status", "assigned_at")
    list_filter = ("status", "slot__task__event")
    raw_id_fields = ("user", "slot")
