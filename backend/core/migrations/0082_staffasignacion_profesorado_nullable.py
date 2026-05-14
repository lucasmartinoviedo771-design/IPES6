from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0081_staffasignacion_turno"),
    ]

    operations = [
        # Eliminamos el unique_together anterior (incluía profesorado que ahora puede ser null)
        migrations.AlterUniqueTogether(
            name="staffasignacion",
            unique_together=set(),
        ),
        # Hacemos profesorado nullable
        migrations.AlterField(
            model_name="staffasignacion",
            name="profesorado",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="staff_asignaciones",
                to="core.profesorado",
                help_text="Profesorado asignado. Para tutores: vacío = todos los profesorados del turno.",
            ),
        ),
        # No restauramos unique_together porque con NULLs SQL no los maneja de forma consistente.
        # La unicidad se controla a nivel de aplicación si es necesario.
    ]
