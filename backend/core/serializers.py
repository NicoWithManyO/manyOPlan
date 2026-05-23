from rest_framework import serializers

from .validators import validate_hex_color


class InvitationDecorationMixin:
    """Adds decoration_type/text/colors validation to invitation serializers.

    Assumes the model inherits from `core.mixins.BaseInvitation`.
    """

    DECORATION_FIELDS = (
        "decoration_type",
        "decoration_text",
        "decoration_bg_color",
        "decoration_text_color",
    )

    def validate_decoration_bg_color(self, value):
        return validate_hex_color(value)

    def validate_decoration_text_color(self, value):
        return validate_hex_color(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        deco_type = self._resolved_field(attrs, "decoration_type", "logo")
        if deco_type == "text":
            text = self._resolved_field(attrs, "decoration_text", "")
            if not (text or "").strip():
                raise serializers.ValidationError(
                    {"decoration_text": "Texte requis pour ce type de décoration."}
                )
        return attrs

    def _resolved_field(self, attrs, field, default):
        if field in attrs:
            return attrs[field]
        if self.instance is not None:
            return getattr(self.instance, field, default)
        return default
