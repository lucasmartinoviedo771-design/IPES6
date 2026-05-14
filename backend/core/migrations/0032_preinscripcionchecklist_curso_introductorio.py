from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0031_estudiante_datos_extra"),
    ]

    operations = [
        migrations.AddField(
            model_name="preinscripcionchecklist",
            name="curso_introductorio_aprobado",
            field=models.BooleanField(default=False),
        ),
    ]
