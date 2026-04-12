from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0075_add_autorizado_rendir_to_estudiante'),
    ]

    operations = [
        # Nuevo estado BAJA en InscripcionMateriaEstudiante
        migrations.AlterField(
            model_name='inscripcionmateriaestudiante',
            name='estado',
            field=models.CharField(
                choices=[
                    ('CONF', 'Confirmada'),
                    ('PEND', 'Pendiente'),
                    ('RECH', 'Rechazada'),
                    ('ANUL', 'Anulada'),
                    ('BAJA', 'Baja Voluntaria'),
                ],
                default='CONF',
                max_length=4,
            ),
        ),
        # Campos de baja en InscripcionMateriaEstudiante
        migrations.AddField(
            model_name='inscripcionmateriaestudiante',
            name='baja_fecha',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Fecha en que se registró la baja voluntaria.',
            ),
        ),
        migrations.AddField(
            model_name='inscripcionmateriaestudiante',
            name='baja_motivo',
            field=models.TextField(
                blank=True,
                null=True,
                help_text='Motivo declarado por el estudiante al darse de baja.',
            ),
        ),
        # Nueva situación BAJA en Regularidad
        migrations.AlterField(
            model_name='regularidad',
            name='situacion',
            field=models.CharField(
                choices=[
                    ('PRO', 'Promocionado'),
                    ('REG', 'Regular'),
                    ('APR', 'Aprobado (sin final)'),
                    ('DPA', 'Desaprobado por Parciales'),
                    ('DTP', 'Desaprobado por Trabajos Prácticos'),
                    ('LBI', 'Libre por Inasistencias'),
                    ('LAT', 'Libre Antes de Tiempo'),
                    ('BAJ', 'Baja Voluntaria'),
                ],
                max_length=3,
            ),
        ),
    ]
