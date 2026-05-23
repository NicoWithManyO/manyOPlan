from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("organizations", "0004_organizationinvitation_decoration"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organizationinvitation",
            name="decoration_text",
            field=models.CharField(blank=True, max_length=15),
        ),
    ]
