from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('asistencia', '0007_alter_asistenciadocente_marcacion_categoria'),
        ('core', '0061_alter_inscripcionmateriaalumno_unique_together_and_more'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='AsistenciaAlumno',
            new_name='AsistenciaEstudiante',
        ),
        migrations.RenameModel(
            old_name='CursoAlumnoSnapshot',
            new_name='CursoEstudianteSnapshot',
        ),
        migrations.AlterField(
            model_name='cursoestudiantesnapshot',
            name='comision',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='asistencia_estudiantes', to='core.comision'),
        ),
        migrations.RenameIndex(
            model_name='asistenciaestudiante',
            new_name='asistencia__clase_i_9f0a3b_idx',
            old_name='asistencia__clase_i_62f809_idx',
        ),
        migrations.RenameIndex(
            model_name='asistenciaestudiante',
            new_name='asistencia__estudia_8cf228_idx',
            old_name='asistencia__estudia_5c1f5f_idx',
        ),
    ]
