from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0110_estudiantecarrera_core_estudi_estado__451335_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="estudiante",
            name="perfil_actualizado",
            field=models.BooleanField(
                default=False,
                help_text="True cuando el estudiante completó/actualizó su perfil. "
                "Migrado desde datos_extra (ver plan JSON→columna).",
            ),
        ),
    ]
