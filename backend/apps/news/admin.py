from django.contrib import admin

from .models import News


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "author", "created_at")
    list_filter = ("event",)
    search_fields = ("title", "content")
