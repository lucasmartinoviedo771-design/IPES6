from __future__ import annotations
from datetime import datetime
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML
from core.auth_ninja import JWTAuth
from core.models import Estudiante, PlanDeEstudio, Profesorado
from .helpers import _resolve_estudiante, _ensure_estudiante_access
from .router import estudiantes_router

@estudiantes_router.get("/certificados/estudiante-regular")
def descargar_certificado_estudiante_regular(
    request, 
    profesorado_id: int, 
    plan_id: int, 
    dni: str | None = None
):
    """Genera y descarga la constancia de estudiante regular en formato PDF."""
    from django.db.models import Max
    from core.models import Regularidad, InscripcionMateriaEstudiante

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
    max_anio_reg = Regularidad.objects.filter(estudiante=est, materia__plan_de_estudio=plan).aggregate(Max('materia__anio_cursada'))['materia__anio_cursada__max']
    max_anio_ins = InscripcionMateriaEstudiante.objects.filter(estudiante=est, comision__materia__plan_de_estudio=plan).aggregate(Max('comision__materia__anio_cursada'))['comision__materia__anio_cursada__max']
    
    anio_estudio = max(max_anio_reg or 1, max_anio_ins or 1)

    from django.conf import settings
    context = {
        "estudiante": est,
        "usuario": est.user,
        "profesorado": profesorado,
        "plan": plan,
        "resolucion_plan": plan.resolucion,
        "anio_estudio": anio_estudio,
        "fecha": datetime.now(),
        "base_dir": str(settings.BASE_DIR),
    }

    # Renderizar el HTML
    html_string = render_to_string("core/certificado_estudiante_regular_pdf.html", context)
    
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
