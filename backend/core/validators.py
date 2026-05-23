import re

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def validate_hex_color(value):
    value = (value or "").strip()
    if not HEX_COLOR_RE.match(value):
        raise serializers.ValidationError("Couleur invalide (format #RRGGBB).")
    return value.lower()


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
