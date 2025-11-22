from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0050_equivalencia_disposiciones"),
    ]

    operations = [
        migrations.AddField(
            model_name="preinscripcionchecklist",
            name="incumbencia",
            field=models.BooleanField(default=False),
        ),
    ]
