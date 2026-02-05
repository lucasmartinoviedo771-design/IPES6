from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0060_userprofile_temp_password'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='ActaExamenAlumno',
            new_name='ActaExamenEstudiante',
        ),
        migrations.AlterField(
            model_name='actaexamenestudiante',
            name='acta',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='estudiantes', to='core.actaexamen'),
        ),
        migrations.RenameModel(
            old_name='InscripcionMateriaAlumno',
            new_name='InscripcionMateriaEstudiante',
        ),
        migrations.AlterField(
            model_name='inscripcionmateriaestudiante',
            name='materia',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='inscripciones_estudiantes', to='core.materia'),
        ),
        migrations.AlterField(
            model_name='regularidad',
            name='inscripcion',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='regularidades_historial', to='core.inscripcionmateriaestudiante'),
        ),
    ]
