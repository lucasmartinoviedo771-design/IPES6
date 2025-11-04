from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0030_materia_tipo_formacion"),
    ]

    operations = [
        migrations.AddField(
            model_name="estudiante",
            name="datos_extra",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
