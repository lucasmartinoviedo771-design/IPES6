from ninja import Router
from django.db.models import Count, Case, When, Avg, FloatField
from core.models import Preinscripcion, Regularidad
from apps.asistencia.models import AsistenciaAlumno

router = Router(tags=["Metrics"])

@router.get("/inscripciones/resumen-por-profesorado/")
def get_summary_by_profesorado(request):
    """
    Calcula el total de preinscripciones y confirmaciones por profesorado.
    """
    summary = (
        Preinscripcion.objects
        .values("carrera__nombre")
        .annotate(
            total=Count("id"),
            confirmadas=Count(Case(When(estado="Aceptada", then=1))),
        )
        .order_by("-total")
    )
    
    results = []
    for item in summary:
        # Evitar división por cero si no hay preinscripciones para una carrera
        if item["carrera__nombre"] is None:
            continue
            
        tasa_conversion = (item['confirmadas'] / item['total'] * 100) if item['total'] > 0 else 0
        results.append({
            "profesorado": item["carrera__nombre"],
            "total_preinscripciones": item["total"],
            "total_confirmadas": item["confirmadas"],
            "tasa_conversion": round(tasa_conversion, 2),
        })
    return results

@router.get("/academicos/resumen-por-profesorado/")
def get_academic_summary_by_profesorado(request):
    """
    Calcula la tasa de aprobación y la nota promedio por profesorado.
    """
    academic_summary = (
        Regularidad.objects
        .values('materia__plan_de_estudio__profesorado__nombre')
        .annotate(
            total_records=Count('id'),
            total_aprobados=Count(
                Case(
                    When(situacion__in=['PRO', 'REG', 'APR'], then=1),
                )
            ),
        )
        .order_by('-total_records')
    )

    results = []
    for item in academic_summary:
        profesorado_nombre = item['materia__plan_de_estudio__profesorado__nombre']
        if not profesorado_nombre:
            continue

        tasa_aprobacion = (item['total_aprobados'] / item['total_records'] * 100) if item['total_records'] > 0 else 0
        results.append({
            "profesorado": profesorado_nombre,
            "tasa_aprobacion": round(tasa_aprobacion, 2),
            "nota_promedio": None,  # Temporalmente desactivado
        })
    return results

@router.get("/asistencia/resumen-por-profesorado/")
def get_attendance_summary_by_profesorado(request):
    """
    Calcula la tasa de asistencia por profesorado.
    """
    attendance_summary = (
        AsistenciaAlumno.objects
        .values('clase__comision__materia__plan_de_estudio__profesorado__nombre')
        .annotate(
            total_asistencias=Count('id'),
            total_presentes=Count(Case(When(estado='presente', then=1)))
        )
        .order_by('-total_asistencias')
    )

    results = []
    for item in attendance_summary:
        profesorado_nombre = item['clase__comision__materia__plan_de_estudio__profesorado__nombre']
        if not profesorado_nombre:
            continue
        
        tasa_asistencia = (item['total_presentes'] / item['total_asistencias'] * 100) if item['total_asistencias'] > 0 else 0
        results.append({
            "profesorado": profesorado_nombre,
            "tasa_asistencia": round(tasa_asistencia, 2),
        })
    return results
