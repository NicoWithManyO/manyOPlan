from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


def normalize_and_check_unique_email(value):
    normalized = value.strip().lower()
    if User.objects.filter(username__iexact=normalized).exists():
        raise serializers.ValidationError("Un compte avec cet email existe déjà.")
    return normalized


def check_password_match(password, password_confirm):
    if password != password_confirm:
        raise serializers.ValidationError(
            {"password_confirm": "Les mots de passe ne correspondent pas."}
        )
