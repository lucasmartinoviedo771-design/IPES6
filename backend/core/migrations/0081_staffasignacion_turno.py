from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0080_inscripcionmateriaestudiante_cambio_comision_estado_and_more"),
    ]

    operations = [
        # Primero eliminamos el unique_together viejo
        migrations.AlterUniqueTogether(
            name="staffasignacion",
            unique_together=set(),
        ),
        # Agregamos el campo turno
        migrations.AddField(
            model_name="staffasignacion",
            name="turno",
            field=models.CharField(
                blank=True,
                choices=[
                    ("manana", "Mañana"),
                    ("tarde", "Tarde"),
                    ("vespertino", "Vespertino"),
                ],
                help_text="Turno que cubre el tutor/bedel. Vacío = todos los turnos.",
                max_length=12,
                null=True,
            ),
        ),
        # Nuevo unique_together incluyendo turno
        migrations.AlterUniqueTogether(
            name="staffasignacion",
            unique_together={("user", "profesorado", "rol", "turno")},
        ),
    ]
