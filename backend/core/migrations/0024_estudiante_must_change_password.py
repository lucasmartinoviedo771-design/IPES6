from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0023_ventanahabilitacion_periodo"),
    ]

    operations = [
        migrations.AddField(
            model_name="estudiante",
            name="must_change_password",
            field=models.BooleanField(
                default=False,
                help_text="Si está activo, el estudiante debe cambiar la contraseña al iniciar sesión.",
            ),
        ),
    ]

