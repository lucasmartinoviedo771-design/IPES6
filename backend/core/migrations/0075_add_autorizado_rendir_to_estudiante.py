from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0073_alter_comision_options_alter_materia_options_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='estudiante',
            name='autorizado_rendir',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'Autorización excepcional para rendir exámenes finales con legajo incompleto. '
                    'Solo puede ser activado por Secretaría o Bedelía.'
                ),
            ),
        ),
        migrations.AddField(
            model_name='estudiante',
            name='autorizado_rendir_observacion',
            field=models.TextField(
                blank=True,
                null=True,
                help_text='Motivo o aclaración de la autorización excepcional.',
            ),
        ),
    ]
