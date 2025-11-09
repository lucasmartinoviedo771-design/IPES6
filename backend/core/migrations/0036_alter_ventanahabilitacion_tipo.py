from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        (
            "core",
            "0035_rename_core_planil_profeso_e43bd0_idx_core_planil_profeso_3a564c_idx_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="ventanahabilitacion",
            name="periodo",
            field=models.CharField(
                blank=True,
                help_text="Solo para inscripciones a materias y calendario cuatrimestral: '1C_ANUALES', '2C', '1C' o '2C'.",
                max_length=16,
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="ventanahabilitacion",
            name="tipo",
            field=models.CharField(
                choices=[
                    ("INSCRIPCION", "Inscripcion (general)"),
                    ("MESAS_FINALES", "Mesas de examen - Finales"),
                    ("MESAS_EXTRA", "Mesas de examen - Extraordinarias"),
                    ("MESAS_LIBRES", "Mesas de examen - Libres"),
                    ("MATERIAS", "Inscripciones a Materias"),
                    ("CARRERAS", "Inscripciones a Carreras"),
                    ("COMISION", "Cambios de Comision"),
                    ("ANALITICOS", "Pedidos de Analiticos"),
                    ("PREINSCRIPCION", "Preinscripcion"),
                    ("CALENDARIO_CUATRIMESTRE", "Calendario academico - Cuatrimestres"),
                ],
                max_length=32,
            ),
        ),
    ]
