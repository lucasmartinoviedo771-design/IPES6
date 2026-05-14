from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0100_add_prorroga_titulo_secundario"),
    ]

    operations = [
        migrations.AddField(
            model_name="equivalenciadisposiciondetalle",
            name="en_resguardo",
            field=models.BooleanField(
                default=False,
                help_text="La equivalencia no computa como correlativa válida hasta que se aprueben las correlativas previas.",
            ),
        ),
    ]
