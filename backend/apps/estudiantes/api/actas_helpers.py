"""Funciones helper para el módulo de actas."""

from decimal import Decimal

from django.utils.text import slugify

from core.models import (
    ActaExamen,
    ActaExamenEstudiante,
    Docente,
    Estudiante,
    PlanDeEstudio,
    Profesorado,
)
from core.permissions import allowed_profesorados

from apps.estudiantes.api.actas_schemas import (
    ActaDocenteLocal,
    ActaMetadataDocente,
    ActaMetadataMateria,
    ActaMetadataOut,
    ActaMetadataPlan,
    ActaMetadataProfesorado,
)


def _nota_label(value: str) -> str:
    if not value:
        return "-"
    if value == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
        return "Aus. Jus."
    if value == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
        return "Aus. Injus."
    return f"{value}"

def _compute_acta_codigo(profesorado: Profesorado, anio: int, numero: int) -> str:
    prefix = (
        getattr(profesorado, "acronimo", None) or slugify(profesorado.nombre or "") or f"P{profesorado.id}"
    ).upper()
    return f"ACTA-{prefix}-{anio}-{numero:03d}"

def _next_acta_numero(profesorado_id: int, anio: int) -> int:
    from django.db.models import Max
    ultimo = (
        ActaExamen.objects.filter(profesorado_id=profesorado_id, anio_academico=anio)
        .aggregate(Max("numero"))
        .get("numero__max")
        or 0
    )
    return ultimo + 1

def _clasificar_resultado(nota: str) -> str:
    if nota in (
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ):
        return "ausente"
    try:
        valor = Decimal(nota.replace(",", "."))
    except Exception:
        return "desaprobado"
    return "aprobado" if valor >= 6 else "desaprobado"

def _acta_metadata(user=None) -> ActaMetadataOut:
    profesorados_data: list[ActaMetadataProfesorado] = []
    profesorados_qs = Profesorado.objects.order_by("nombre").prefetch_related("planes")

    if user:
        allowed = allowed_profesorados(user)
        if allowed is not None:
            profesorados_qs = profesorados_qs.filter(id__in=allowed)

    for profesorado in profesorados_qs:
        planes_payload: list[ActaMetadataPlan] = []
        planes = (
            PlanDeEstudio.objects.filter(profesorado=profesorado)
            .order_by("resolucion", "id")
            .prefetch_related("materias")
        )
        for plan in planes:
            materias_payload: list[ActaMetadataMateria] = []
            for materia in plan.materias.all().order_by("anio_cursada", "nombre"):
                materias_payload.append(
                    ActaMetadataMateria(
                        id=materia.id,
                        nombre=materia.nombre,
                        anio_cursada=materia.anio_cursada,
                        plan_id=plan.id,
                        plan_resolucion=plan.resolucion,
                    )
                )
            planes_payload.append(
                ActaMetadataPlan(
                    id=plan.id,
                    resolucion=plan.resolucion,
                    materias=materias_payload,
                )
            )
        profesorados_data.append(
            ActaMetadataProfesorado(id=profesorado.id, nombre=profesorado.nombre, planes=planes_payload)
        )

    docentes_payload = [
        ActaMetadataDocente(
            id=doc.id,
            nombre=f"{doc.apellido}, {doc.nombre}".strip(", "),
            dni=doc.dni or None,
        )
        for doc in Docente.objects.select_related("persona").order_by("persona__apellido", "persona__nombre", "id")
    ]

    NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
    ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    nota_options = [{"value": value, "label": _nota_label(value)} for value in ACTA_NOTA_CHOICES]

    estudiantes_payload = [
        {
            "dni": est.dni,
            "apellido_nombre": f"{est.apellido}, {est.nombre}".strip(", "),
        }
        for est in Estudiante.objects.all().select_related("persona", "user").order_by("persona__apellido", "persona__nombre")
    ]

    return ActaMetadataOut(
        profesorados=profesorados_data,
        docentes=docentes_payload,
        estudiantes=estudiantes_payload,
        nota_opciones=nota_options,
    )
