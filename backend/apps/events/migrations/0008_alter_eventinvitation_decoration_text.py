from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0007_eventinvitation_decoration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="eventinvitation",
            name="decoration_text",
            field=models.CharField(blank=True, max_length=15),
        ),
    ]
