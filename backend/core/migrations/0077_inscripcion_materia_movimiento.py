from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0076_baja_voluntaria'),
    ]

    operations = [
        migrations.CreateModel(
            name='InscripcionMateriaMovimiento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('INS', 'Inscripción'), ('CAN', 'Cancelación'), ('BAJ', 'Baja Voluntaria'), ('OTR', 'Otro cambio')], max_length=3)),
                ('fecha_hora', models.DateTimeField(auto_now_add=True)),
                ('motivo_detalle', models.TextField(blank=True, null=True)),
                ('operador', models.CharField(blank=True, help_text='Usuario o DNI que ejecutó la acción.', max_length=255, null=True)),
                ('inscripcion', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='movimientos', to='core.inscripcionmateriaestudiante')),
            ],
            options={
                'verbose_name': 'Movimiento de Inscripción',
                'verbose_name_plural': 'Movimientos de Inscripción',
                'ordering': ['-fecha_hora'],
            },
        ),
    ]
