from django.db import migrations


DOC_FIELDS = [
    "estado_legajo",
    "curso_introductorio_aprobado",
    "libreta_entregada",
    "dni_legalizado",
    "fotos_4x4",
    "certificado_salud",
    "folios_oficio",
    "titulo_secundario_legalizado",
    "certificado_titulo_en_tramite",
    "analitico_legalizado",
    "articulo_7",
    "adeuda_materias",
    "adeuda_materias_detalle",
    "escuela_secundaria",
    "certificado_alumno_regular_sec",
    "es_certificacion_docente",
    "titulo_terciario_univ",
    "incumbencia",
]


def copy_legajo_to_estudiantecarrera(apps, schema_editor):
    EstudianteCarrera = apps.get_model("core", "EstudianteCarrera")
    for ec in EstudianteCarrera.objects.select_related("estudiante").all():
        est = ec.estudiante
        changed = False
        for field in DOC_FIELDS:
            val = getattr(est, field, None)
            if val is not None:
                setattr(ec, field, val)
                changed = True
        if changed:
            ec.save(update_fields=DOC_FIELDS)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0107_add_legajo_fields_to_estudiantecarrera"),
    ]

    operations = [
        migrations.RunPython(copy_legajo_to_estudiantecarrera, reverse_code=migrations.RunPython.noop),
    ]
