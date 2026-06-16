from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0112_migrar_perfil_actualizado_a_columna'),
    ]

    operations = [
        migrations.AddField(
            model_name='estudiante',
            name='sup1_titulo',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='sup1_establecimiento',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='sup1_fecha_egreso',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='sup1_localidad',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='sup1_provincia',
            field=models.CharField(blank=True, max_length=150, null=True),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='sup1_pais',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]
