import logging
import re
from django.db.models import Count
from apps.common.date_utils import format_datetime
from core.models import PlanillaRegularidad
from core.permissions import allowed_profesorados

logger = logging.getLogger(__name__)


def get_historial_regularidades(user, anio=None, profesorado_id=None, ordering="-created_at") -> tuple[list, str | None]:
    """
    Returns (data_list, error_message). error_message is None on success.
    """
    allowed_ordering = ["id", "-id", "created_at", "-created_at", "fecha", "-fecha", "materia__nombre", "-materia__nombre"]
    if ordering not in allowed_ordering:
        ordering = "-created_at"

    qs = (
        PlanillaRegularidad.objects.select_related("profesorado", "materia")
        .order_by(ordering)
    )

    allowed = allowed_profesorados(user, role_filter={"bedel"})
    if allowed is not None:
        qs = qs.filter(profesorado_id__in=allowed)

    if anio:
        qs = qs.filter(anio_academico=anio)

    if profesorado_id:
        if allowed is not None and profesorado_id not in allowed:
            return [], "No tiene permisos sobre este profesorado."
        qs = qs.filter(profesorado_id=profesorado_id)

    # Evitamos el límite fijo de 1000 para que el historial sea infinito
    total = qs.count()
    qs = qs[:total]

    regimen_map = {"ANU": "ANUAL", "PCU": "1C", "SCU": "2C"}
    data = []
    for planilla in list(qs):
        dictado_val = planilla.dictado
        if not dictado_val and planilla.plantilla:
            dictado_val = planilla.plantilla.dictado
        if not dictado_val:
            reg = planilla.materia.regimen
            dictado_val = regimen_map.get(reg, "ANUAL")

        data.append({
            "id": planilla.id,
            "codigo": planilla.codigo,
            "profesorado_id": planilla.profesorado_id,
            "profesorado_nombre": planilla.profesorado.nombre,
            "materia_nombre": planilla.materia.nombre,
            "anio_cursada": str(planilla.materia.anio_cursada) if planilla.materia.anio_cursada else "-",
            "dictado": dictado_val,
            "fecha": planilla.fecha,
            "cantidad_estudiantes": planilla.filas.count(),
            "estado": planilla.estado,
            "folio": planilla.folio,
            "anio_academico": planilla.anio_academico,
            "created_at": format_datetime(planilla.created_at),
        })
    return data, None


def get_historico_mesas_pandemia(user, ordering="-fecha") -> list:
    """Returns list of mesa dicts."""
    from core.models import MesaExamen

    allowed = allowed_profesorados(user, role_filter={"bedel", "secretaria"})

    qs = (
        MesaExamen.objects.filter(inscripciones__folio__icontains="PANDEMIA")
        | MesaExamen.objects.filter(inscripciones__libro__icontains="PANDEMIA")
    )

    if allowed is not None:
        if not allowed:
            return []
        qs = qs.filter(materia__plan_de_estudio__profesorado_id__in=allowed)

    allowed_ordering = [
        "id", "-id", "fecha", "-fecha",
        "materia__nombre", "-materia__nombre",
        "cantidad_estudiantes", "-cantidad_estudiantes",
    ]
    if ordering not in allowed_ordering:
        ordering = "-fecha"

    qs = (
        qs.select_related("materia__plan_de_estudio__profesorado", "docente_presidente__persona")
        .distinct()
        .annotate(cantidad_estudiantes=Count("inscripciones"))
        .order_by(ordering)[:200]
    )

    data = []
    for mesa in qs:
        docente = "—"
        if mesa.docente_presidente and mesa.docente_presidente.persona:
            docente = f"{mesa.docente_presidente.persona.apellido}, {mesa.docente_presidente.persona.nombre}"
        else:
            primera_insc = mesa.inscripciones.filter(observaciones__icontains="Docente:").first()
            if primera_insc:
                match = re.search(r"Docente:\s*([^|;]+)", primera_insc.observaciones)
                if match:
                    docente = match.group(1).strip()

        inscripciones_data = []
        for insc in mesa.inscripciones.select_related("estudiante__persona").all():
            inscripciones_data.append({
                "dni": insc.estudiante.dni,
                "nombre": (
                    f"{insc.estudiante.persona.apellido}, {insc.estudiante.persona.nombre}"
                    if insc.estudiante.persona
                    else insc.estudiante.dni
                ),
                "nota": str(insc.nota) if insc.nota is not None else insc.condicion,
                "condicion": insc.condicion,
            })

        data.append({
            "id": mesa.id,
            "materia_nombre": mesa.materia.nombre,
            "profesorado_nombre": mesa.materia.plan_de_estudio.profesorado.nombre,
            "fecha": mesa.fecha,
            "tipo": mesa.tipo,
            "cantidad_estudiantes": mesa.cantidad_estudiantes,
            "docente_presidente": docente,
            "estudiantes_detalle": inscripciones_data,
        })

    return data
