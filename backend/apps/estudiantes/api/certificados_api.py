from __future__ import annotations

from datetime import datetime

from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML

from core.models import PlanDeEstudio, Profesorado

from .helpers import _ensure_estudiante_access, _resolve_estudiante
from .router import estudiantes_router


def _calcular_anio_estudio(est, plan) -> int:
    from django.db.models import Max

    from core.models import InscripcionMateriaEstudiante, Regularidad

    max_anio_reg = Regularidad.objects.filter(
        estudiante=est, materia__plan_de_estudio=plan, materia__is_edi=False
    ).aggregate(Max("materia__anio_cursada"))["materia__anio_cursada__max"]
    max_anio_ins = InscripcionMateriaEstudiante.objects.filter(
        estudiante=est, materia__plan_de_estudio=plan, materia__is_edi=False
    ).aggregate(Max("materia__anio_cursada"))["materia__anio_cursada__max"]
    return max(max_anio_reg or 1, max_anio_ins or 1)


@estudiantes_router.get("/certificados/anio-estudio")
def obtener_anio_estudio(request, profesorado_id: int, plan_id: int, dni: str | None = None):
    """Devuelve el año de estudio calculado automáticamente para el estudiante."""
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, {"message": "Estudiante no encontrado."}
    plan = PlanDeEstudio.objects.filter(id=plan_id).first()
    if not plan:
        return 404, {"message": "Plan no encontrado."}
    return {"anio_estudio": _calcular_anio_estudio(est, plan)}


@estudiantes_router.get("/certificados/estudiante-regular")
def descargar_certificado_estudiante_regular(
    request,
    profesorado_id: int,
    plan_id: int,
    dni: str | None = None,
    anio_override: int | None = None,
):
    """Genera y descarga la constancia de estudiante regular en formato PDF."""
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, {"message": "Estudiante no encontrado."}

    profesorado = Profesorado.objects.filter(id=profesorado_id).first()
    plan = PlanDeEstudio.objects.filter(id=plan_id).first()

    if not profesorado or not plan:
        return 404, {"message": "Profesorado o Plan no encontrado."}

    # Calcular el año de estudio aproximado
    # Buscamos regularidades o inscripciones para ver el nivel
    anio_calculado = _calcular_anio_estudio(est, plan)
    anio_estudio = anio_override if (anio_override and anio_override <= anio_calculado) else anio_calculado

    import os

    from django.conf import settings

    logo_left_path = os.path.join(settings.BASE_DIR, "static/logos/escudo_ministerio_tdf.png")
    logo_right_path = os.path.join(settings.BASE_DIR, "static/logos/logo_ipes.jpg")
    if not os.path.exists(logo_left_path):
        logo_left_path = os.path.join(settings.BASE_DIR, "backend/static/logos/escudo_ministerio_tdf.png")
        logo_right_path = os.path.join(settings.BASE_DIR, "backend/static/logos/logo_ipes.jpg")

    context = {
        "estudiante": est,
        "usuario": est.user,
        "profesorado": profesorado,
        "plan": plan,
        "resolucion_plan": plan.resolucion,
        "anio_estudio": anio_estudio,
        "fecha": datetime.now(),
        "base_dir": str(settings.BASE_DIR),
        "logo_left_path": logo_left_path,
        "logo_right_path": logo_right_path,
    }

    # Renderizar el HTML
    html_string = render_to_string("core/certificado_alumno_regular_pdf.html", context)

    # Preparar la respuesta HTTP
    response = HttpResponse(content_type="application/pdf")
    filename = f"Constancia_Regular_{est.dni}.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    # Generar el PDF
    try:
        HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
    except Exception as e:
        return 500, {"message": f"Error al generar PDF: {str(e)}"}

    return response
