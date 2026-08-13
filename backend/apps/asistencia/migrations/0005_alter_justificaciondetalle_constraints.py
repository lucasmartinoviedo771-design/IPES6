from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("asistencia", "0004_calendarioasistenciaevento_comision_and_more"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="justificaciondetalle",
            name="unique_justificacion_clase_estudiante",
        ),
        migrations.RemoveConstraint(
            model_name="justificaciondetalle",
            name="unique_justificacion_clase_docente",
        ),
        migrations.AddConstraint(
            model_name="justificaciondetalle",
            constraint=models.UniqueConstraint(
                fields=("justificacion", "clase", "estudiante"),
                name="unique_justificacion_clase_estudiante",
            ),
        ),
        migrations.AddConstraint(
            model_name="justificaciondetalle",
            constraint=models.UniqueConstraint(
                fields=("justificacion", "clase", "docente"),
                name="unique_justificacion_clase_docente",
            ),
        ),
    ]

