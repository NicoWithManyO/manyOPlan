from rest_framework import serializers

from .models import News


class NewsSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = (
            "id",
            "event",
            "author",
            "author_name",
            "title",
            "content",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "author", "created_at", "updated_at")

    def get_author_name(self, obj):
        return str(obj.author)


class NewsCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = News
        fields = ("title", "content")
