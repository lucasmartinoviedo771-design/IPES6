from django.db import migrations

def migrate_estado_legajo(apps, schema_editor):
    EstudianteCarrera = apps.get_model('core', 'EstudianteCarrera')
    # Recorremos cada inscripción y le asignamos el estado actual del estudiante
    for ec in EstudianteCarrera.objects.all():
        if ec.estudiante.estado_legajo:
            ec.estado_legajo = ec.estudiante.estado_legajo
            ec.save()

class Migration(migrations.Migration):

    dependencies = [
        ('core', '0085_add_estado_legajo_to_estudiantecarrera'),
    ]

    operations = [
        migrations.RunPython(migrate_estado_legajo, reverse_code=migrations.RunPython.noop),
    ]
