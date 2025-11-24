from typing import List
from datetime import date
from ninja import Schema
from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    InscripcionMateriaAlumno,
    Correlatividad,
    Regularidad,
    Materia,
    MesaExamen,
    Estudiante
)
from .router import alumnos_router
from .helpers import _ensure_admin, _correlatividades_qs, _resolve_estudiante

class CorrelativaCaidaItem(Schema):
    estudiante_id: int
    dni: str
    apellido_nombre: str
    materia_actual: str
    materia_correlativa: str
    motivo: str

def _check_correlativas_caidas(anio: int, estudiante: Estudiante | None = None, materia_id: int | None = None) -> List[dict]:
    qs = InscripcionMateriaAlumno.objects.select_related(
        "estudiante__user", "materia__plan_de_estudio"
    ).filter(
        anio=anio,
        estado__in=[InscripcionMateriaAlumno.Estado.CONFIRMADA, InscripcionMateriaAlumno.Estado.PENDIENTE]
    )
    
    if estudiante:
        qs = qs.filter(estudiante=estudiante)
        
    if materia_id:
        qs = qs.filter(materia_id=materia_id)

    reporte = []
    materia_names = {}

    for insc in qs:
        est = insc.estudiante
        materia = insc.materia
        
        correlativas_qs = _correlatividades_qs(
            materia,
            Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR,
            est
        )
        
        required_materia_ids = list(correlativas_qs.values_list("materia_correlativa_id", flat=True))
        
        if not required_materia_ids:
            continue
            
        regs = Regularidad.objects.filter(
            estudiante=est,
            materia_id__in=required_materia_ids
        ).order_by("materia_id", "-fecha_cierre")
        
        latest_regs = {}
        for r in regs:
            if r.materia_id not in latest_regs:
                latest_regs[r.materia_id] = r
                
        for req_id in required_materia_ids:
            reg = latest_regs.get(req_id)
            is_ok = False
            motivo = ""
            
            if reg:
                if reg.situacion in [Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO]:
                    is_ok = True
                elif reg.situacion == Regularidad.Situacion.REGULAR:
                    try:
                        limit_base = reg.fecha_cierre.replace(year=reg.fecha_cierre.year + 2)
                    except ValueError:
                        limit_base = reg.fecha_cierre.replace(month=2, day=28, year=reg.fecha_cierre.year + 2)
                    
                    siguiente_llamado = (
                        MesaExamen.objects.filter(
                            materia_id=req_id,
                            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
                            fecha__gte=limit_base,
                        )
                        .order_by("fecha")
                        .values_list("fecha", flat=True)
                        .first()
                    )
                    limit = siguiente_llamado or limit_base
                    
                    if date.today() <= limit:
                        is_ok = True
                    else:
                        motivo = "Regularidad vencida"
                else:
                    motivo = f"Situación no regular: {reg.get_situacion_display()}"
            else:
                motivo = "Sin regularidad registrada"
            
            if not is_ok:
                if req_id not in materia_names:
                    m_obj = Materia.objects.filter(id=req_id).first()
                    materia_names[req_id] = m_obj.nombre if m_obj else f"Materia {req_id}"
                
                materia_corr_nombre = materia_names[req_id]
                user_full_name = f"{est.user.last_name}, {est.user.first_name}"
                
                reporte.append({
                    "estudiante_id": est.id,
                    "dni": est.dni,
                    "apellido_nombre": user_full_name,
                    "materia_actual": materia.nombre,
                    "materia_correlativa": materia_corr_nombre,
                    "motivo": motivo
                })
    return reporte

@alumnos_router.get(
    "/reportes/correlativas-caidas",
    response={200: List[CorrelativaCaidaItem], 403: ApiResponse},
    auth=JWTAuth(),
)
def reporte_correlativas_caidas(request, anio: int | None = None):
    _ensure_admin(request)
    if not anio:
        anio = date.today().year
    return _check_correlativas_caidas(anio)

@alumnos_router.get(
    "/me/alertas",
    response={200: List[CorrelativaCaidaItem]},
    auth=JWTAuth(),
)
def mis_alertas_academicas(request):
    est = _resolve_estudiante(request)
    if not est:
        return []
    anio = date.today().year
    return _check_correlativas_caidas(anio, estudiante=est)
