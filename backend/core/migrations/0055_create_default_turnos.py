from django.db import migrations


def create_default_turnos(apps, schema_editor):
    Turno = apps.get_model("core", "Turno")
    defaults = ["Turno mañana", "Turno tarde", "Turno vespertino"]
    for nombre in defaults:
        Turno.objects.get_or_create(nombre=nombre)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0054_equivalencias_workflow"),
    ]

    operations = [
        migrations.RunPython(create_default_turnos, migrations.RunPython.noop),
    ]
