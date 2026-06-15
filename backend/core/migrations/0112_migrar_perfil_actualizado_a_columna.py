from django.db import migrations


def copiar_flag_a_columna(apps, schema_editor):
    """Copia datos_extra['perfil_actualizado'] a la columna perfil_actualizado.

    No borra el flag del JSON: lo deja como respaldo. Idempotente.
    """
    Estudiante = apps.get_model("core", "Estudiante")
    for est in Estudiante.objects.all().iterator():
        extra = est.datos_extra or {}
        if extra.get("perfil_actualizado"):
            est.perfil_actualizado = True
            est.save(update_fields=["perfil_actualizado"])


def revertir(apps, schema_editor):
    """Reversa: reescribe el flag en el JSON a partir de la columna.

    El JSON nunca se vació, así que esto solo garantiza consistencia si se
    hace rollback de la migración de esquema.
    """
    Estudiante = apps.get_model("core", "Estudiante")
    for est in Estudiante.objects.filter(perfil_actualizado=True).iterator():
        extra = est.datos_extra or {}
        extra["perfil_actualizado"] = True
        est.datos_extra = extra
        est.save(update_fields=["datos_extra"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0111_estudiante_perfil_actualizado"),
    ]

    operations = [
        migrations.RunPython(copiar_flag_a_columna, revertir),
    ]
