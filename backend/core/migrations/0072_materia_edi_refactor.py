from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0071_materia_add_edi_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='materia',
            name='fecha_inicio',
            field=models.DateField(blank=True, help_text='Fecha en que este EDI comenzó a estar vigente.', null=True, verbose_name='Fecha de inicio'),
        ),
        migrations.AlterUniqueTogether(
            name='materia',
            unique_together={('plan_de_estudio', 'anio_cursada', 'nombre', 'regimen', 'fecha_inicio')},
        ),
    ]
