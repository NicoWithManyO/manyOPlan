from django.contrib import admin

from .models import Event, EventMembership


class EventMembershipInline(admin.TabularInline):
    model = EventMembership
    extra = 0


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "event_type", "start_date", "end_date")
    list_filter = ("event_type", "organization")
    search_fields = ("name", "description")
    inlines = [EventMembershipInline]


@admin.register(EventMembership)
class EventMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "event", "role", "created_at")
    list_filter = ("role",)
