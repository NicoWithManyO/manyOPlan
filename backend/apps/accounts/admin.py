from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_placeholder")
    list_filter = BaseUserAdmin.list_filter + ("is_placeholder",)
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Compte provisoire", {"fields": ("is_placeholder",)}),
    )
