from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0113_add_sup1_fields_to_estudiante"),
    ]

    operations = [
        migrations.AddField(
            model_name="persona",
            name="foto",
            field=models.ImageField(
                blank=True,
                help_text="Foto de perfil",
                null=True,
                upload_to="personas/fotos/",
            ),
        ),
    ]
