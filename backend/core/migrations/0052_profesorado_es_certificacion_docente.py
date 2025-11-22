from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0051_preinscripcionchecklist_incumbencia"),
    ]

    operations = [
        migrations.AddField(
            model_name="profesorado",
            name="es_certificacion_docente",
            field=models.BooleanField(default=False),
        ),
    ]
