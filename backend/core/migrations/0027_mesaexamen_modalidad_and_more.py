from django.db import migrations, models


def migrate_modalidad(apps, schema_editor):
    MesaExamen = apps.get_model("core", "MesaExamen")
    for mesa in MesaExamen.objects.all():
        tipo = mesa.tipo
        if tipo == "LIB":
            mesa.modalidad = "LIB"
            mesa.tipo = "FIN"
        elif tipo == "PAR":
            mesa.tipo = "EXT"
        else:
            mesa.modalidad = mesa.modalidad or "REG"
        mesa.save(update_fields=["modalidad", "tipo"])


def reverse_migrate_modalidad(apps, schema_editor):
    MesaExamen = apps.get_model("core", "MesaExamen")
    for mesa in MesaExamen.objects.all():
        if mesa.modalidad == "LIB":
            mesa.tipo = "LIB"
        elif mesa.tipo == "EXT":
            mesa.tipo = "PAR"
        mesa.save(update_fields=["tipo"])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_alter_staffasignacion_options'),
    ]

    operations = [
        migrations.AddField(
            model_name='mesaexamen',
            name='modalidad',
            field=models.CharField(choices=[('REG', 'Regular'), ('LIB', 'Libre')], default='REG', max_length=3),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='condicion',
            field=models.CharField(blank=True, choices=[('APR', 'Aprobado'), ('DES', 'Desaprobado'), ('AUS', 'Ausente'), ('AUJ', 'Ausente justificado')], max_length=3, null=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='cuenta_para_intentos',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='fecha_resultado',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='folio',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='libro',
            field=models.CharField(blank=True, max_length=32, null=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='nota',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True),
        ),
        migrations.AddField(
            model_name='inscripcionmesa',
            name='observaciones',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.RunPython(migrate_modalidad, reverse_migrate_modalidad),
        migrations.AlterField(
            model_name='mesaexamen',
            name='tipo',
            field=models.CharField(choices=[('FIN', 'Final'), ('EXT', 'Extraordinaria')], max_length=3),
        ),
    ]
