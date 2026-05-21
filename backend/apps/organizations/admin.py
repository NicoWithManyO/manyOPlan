from django.contrib import admin

from .models import Organization, OrganizationInvitation, OrganizationMembership


class OrganizationMembershipInline(admin.TabularInline):
    model = OrganizationMembership
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "invite_code", "created_by", "created_at")
    search_fields = ("name", "slug", "invite_code")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [OrganizationMembershipInline]


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "organization__name")


@admin.register(OrganizationInvitation)
class OrganizationInvitationAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "label",
        "use_count",
        "max_uses",
        "expires_at",
        "is_active",
        "is_promoted",
        "created_at",
    )
    search_fields = ("label", "token", "organization__name")
    list_filter = ("organization", "is_active", "is_promoted")
    readonly_fields = ("token", "use_count", "created_at")
