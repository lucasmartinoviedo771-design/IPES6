from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0029_alter_staffasignacion_rol"),
    ]

    operations = [
        migrations.AddField(
            model_name="materia",
            name="tipo_formacion",
            field=models.CharField(
                choices=[
                    ("FGN", "Formación general"),
                    ("FES", "Formación específica"),
                    ("PDC", "Práctica docente"),
                ],
                default="FGN",
                help_text="Clasificación pedagógica de la materia.",
                max_length=3,
            ),
        ),
    ]
