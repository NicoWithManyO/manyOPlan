from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0006_eventinvitation_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventinvitation",
            name="decoration_type",
            field=models.CharField(
                choices=[
                    ("logo", "Logo de l'association"),
                    ("text", "Texte personnalisé"),
                ],
                default="logo",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="eventinvitation",
            name="decoration_text",
            field=models.CharField(blank=True, max_length=10),
        ),
        migrations.AddField(
            model_name="eventinvitation",
            name="decoration_bg_color",
            field=models.CharField(default="#ffffff", max_length=7),
        ),
        migrations.AddField(
            model_name="eventinvitation",
            name="decoration_text_color",
            field=models.CharField(default="#000000", max_length=7),
        ),
    ]
