from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0087_estudiante_materias_autorizadas"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="estudiantecarrera",
            name="estado_legajo",
        ),
    ]
