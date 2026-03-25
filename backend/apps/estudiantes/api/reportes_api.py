from typing import List
from datetime import date
from ninja import Schema
from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    InscripcionMateriaEstudiante,
    Correlatividad,
    Regularidad,
    Materia,
    MesaExamen,
    Estudiante
)
from .router import estudiantes_router
from .helpers import (
    _ensure_admin, 
    _correlatividades_qs, 
    _resolve_estudiante,
    _acta_condicion,
    _calcular_vigencia_regularidad
)
from core.models import ActaExamenEstudiante

class CorrelativaCaidaItem(Schema):
    estudiante_id: int
    dni: str
    apellido_nombre: str
    materia_actual: str
    materia_correlativa: str
    motivo: str

class AuditoriaInconsistenciaItem(Schema):
    estudiante: str
    dni: str
    materia: str
    evento: str
    fecha: str
    prerrequisito: str
    tipo_corr: str
    motivo: str

def _check_correlativas_caidas(anio: int, estudiante: Estudiante | None = None, materia_id: int | None = None) -> List[dict]:
    qs = InscripcionMateriaEstudiante.objects.select_related(
        "estudiante__user", "materia__plan_de_estudio"
    ).filter(
        anio=anio,
        estado__in=[InscripcionMateriaEstudiante.Estado.CONFIRMADA, InscripcionMateriaEstudiante.Estado.PENDIENTE]
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
                
        # Check approval in Actas or InscripcionMesa (Pandemia)
        aprobadas_ids = set(ActaExamenEstudiante.objects.filter(
            dni=est.dni, calificacion_definitiva__in=['6','7','8','9','10','APR','EQUI']
        ).values_list('acta__materia_id', flat=True))
        
        # Add Pandemia (InscripcionMesa)
        from core.models import InscripcionMesa, EquivalenciaDisposicionDetalle
        aprobadas_ids.update(InscripcionMesa.objects.filter(
            estudiante=est, condicion=InscripcionMesa.Condicion.APROBADO
        ).values_list('mesa__materia_id', flat=True))
        
        # Add Equivalencias
        aprobadas_ids.update(EquivalenciaDisposicionDetalle.objects.filter(
            disposicion__estudiante=est
        ).values_list('materia_id', flat=True))

        for req_id in required_materia_ids:
            if req_id in aprobadas_ids:
                continue
                
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

@estudiantes_router.get(
    "/reportes/correlativas-caidas/",
    response={200: List[CorrelativaCaidaItem], 403: ApiResponse},
    auth=JWTAuth(),
)
def reporte_correlativas_caidas(request, anio: int | None = None):
    _ensure_admin(request)
    if not anio:
        anio = date.today().year
    return _check_correlativas_caidas(anio)

@estudiantes_router.get(
    "/me/alertas/",
    response={200: List[CorrelativaCaidaItem]},
    auth=JWTAuth(),
)
def mis_alertas_academicas(request):
    est = _resolve_estudiante(request)
    if not est:
        return []
    anio = date.today().year
    return _check_correlativas_caidas(anio, estudiante=est)

def _generar_auditoria_academica(
    profesorado_id: int | None = None,
    search: str | None = None,
    materia_id: int | None = None,
    solo_activos: bool = False
) -> List[dict]:
    """
    Genera un reporte de inconsistencias académicas (correlatividades no cumplidas).
    Analiza aprobaciones y regularidades históricas.
    """
    estudiantes = Estudiante.objects.select_related('persona', 'user')
    
    if profesorado_id:
        estudiantes = estudiantes.filter(carreras__id=profesorado_id)
    
    if search:
        from django.db.models import Q
        estudiantes = estudiantes.filter(
            Q(persona__dni__icontains=search) |
            Q(persona__apellido__icontains=search) |
            Q(persona__nombre__icontains=search)
        )
    
    if solo_activos:
        estudiantes = estudiantes.filter(carreras_detalle__estado_academico='ACT')
    
    estudiantes = estudiantes.distinct().all()
    
    inconsistencies = []

    # Pre-fetch para optimizar
    # (En un futuro se podría optimizar aún más con queries dirigidas, 
    # pero dado el volumen actual de ~3k alumnos es manejable)

    for est in estudiantes:
        # 1. Recopilar estado académico del alumno
        aprobadas = {} # materia_id -> fecha_aprobacion
        
        # Aprobaciones desde Actas
        actas = ActaExamenEstudiante.objects.filter(dni=est.dni).select_related('acta')
        for a in actas:
            cond, _ = _acta_condicion(a.calificacion_definitiva)
            if cond in ('APR', 'EQUI'):
                mid = a.acta.materia_id
                fecha = a.acta.fecha
                if mid not in aprobadas or (fecha and (mid not in aprobadas or fecha < aprobadas[mid])):
                    aprobadas[mid] = fecha
        
        # Aprobaciones desde Inscripciones a Mesa (incluye registros de Pandemia)
        from core.models import InscripcionMesa
        inscs_mesa = InscripcionMesa.objects.filter(estudiante=est, condicion=InscripcionMesa.Condicion.APROBADO).select_related('mesa')
        for i in inscs_mesa:
            mid = i.mesa.materia_id
            fecha = i.mesa.fecha
            if mid not in aprobadas or (fecha and (mid not in aprobadas or fecha < aprobadas[mid])):
                aprobadas[mid] = fecha

        # Equivalencias (Disposiciones)
        from core.models import EquivalenciaDisposicionDetalle
        equis = EquivalenciaDisposicionDetalle.objects.filter(disposicion__estudiante=est).select_related('disposicion')
        for eq in equis:
            mid = eq.materia_id
            fecha = eq.disposicion.fecha_disposicion
            if mid not in aprobadas or (fecha and (mid not in aprobadas or fecha < aprobadas[mid])):
                aprobadas[mid] = fecha
        
        # Regularidades (incluyendo aprobaciones/promociones en cursada)
        regs_raw = Regularidad.objects.filter(estudiante=est).select_related('materia')
        regularizadas = {} # materia_id -> [fecha_cierre, limite_vigencia, intentos]
        
        for r in regs_raw:
            if r.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                mid = r.materia_id
                fecha = r.fecha_cierre
                if mid not in aprobadas or fecha < aprobadas[mid]:
                    aprobadas[mid] = fecha
            elif r.situacion == Regularidad.Situacion.REGULAR:
                limit, intentos = _calcular_vigencia_regularidad(est, r)
                mid = r.materia_id
                if mid not in regularizadas or r.fecha_cierre > regularizadas[mid][0]:
                    regularizadas[mid] = [r.fecha_cierre, limit, intentos]

        # 2. Auditar Aprobaciones (Finales / Equivalencias)
        for mid, fecha_aprob in aprobadas.items():
            materia = Materia.objects.select_related('plan_de_estudio__profesorado').filter(id=mid).first()
            if not materia: continue
            
            # Filtro por profesorado específico
            if profesorado_id and materia.plan_de_estudio.profesorado_id != profesorado_id:
                continue
                
            # Obtener correlativas APR para este alumno (considerando su cohorte)
            correlativas = _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, est)
            
            for corr in correlativas:
                req_id = corr.materia_correlativa_id
                # Inconsistencia si no está aprobada actualmente
                if req_id not in aprobadas:
                    inconsistencies.append({
                        'estudiante': f"{est.apellido}, {est.nombre}",
                        'dni': est.dni,
                        'carrera': materia.plan_de_estudio.profesorado.nombre,
                        'materia': materia.nombre,
                        'evento': 'Aprobación Final',
                        'fecha': str(fecha_aprob),
                        'prerrequisito': corr.materia_correlativa.nombre,
                        'tipo_corr': 'Aprobada para Rendir',
                        'motivo': 'Prerrequisito no aprobado o aprobado posteriormente'
                    })

        # 3. Auditar Regularidades
        for r in regs_raw:
            if r.situacion != Regularidad.Situacion.REGULAR:
                continue
                
            materia = r.materia
            # Filtro por profesorado específico
            if profesorado_id and materia.plan_de_estudio.profesorado_id != profesorado_id:
                continue
            
            # Filtro por materia_id específico
            if materia_id and materia.id != materia_id:
                continue

            correlativas = _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, est)
            for corr in correlativas:
                req_id = corr.materia_correlativa_id
                has_req = False
                if req_id in aprobadas or req_id in regularizadas:
                    has_req = True
                
                if not has_req:
                    inconsistencies.append({
                        'estudiante': f"{est.apellido}, {est.nombre}",
                        'dni': est.dni,
                        'carrera': materia.plan_de_estudio.profesorado.nombre,
                        'materia': materia.nombre,
                        'evento': 'Regularización',
                        'fecha': str(r.fecha_cierre),
                        'prerrequisito': corr.materia_correlativa.nombre,
                        'tipo_corr': 'Regular para Cursar',
                        'motivo': 'Prerrequisito no regularizado ni aprobado al cierre'
                    })

    return inconsistencies

@estudiantes_router.get(
    "/reportes/auditoria-inconsistencias/",
    response={200: List[AuditoriaInconsistenciaItem], 403: ApiResponse},
    auth=JWTAuth(),
)
def reporte_auditoria_inconsistencias(
    request, 
    profesorado_id: int | None = None,
    search: str | None = None,
    materia_id: int | None = None,
    solo_activos: bool = False
):
    """
    Reporte completo de inconsistencias de correlatividades en la base de datos.
    Detecta aprobaciones sin final o regularidades sin cursadas previas requeridas.
    """
    _ensure_admin(request)
    return _generar_auditoria_academica(
        profesorado_id=profesorado_id,
        search=search,
        materia_id=materia_id,
        solo_activos=solo_activos
    )

@estudiantes_router.get(
    "/reportes/auditoria-inconsistencias/download",
    auth=JWTAuth(),
)
def download_auditoria_inconsistencias(
    request, 
    profesorado_id: int | None = None,
    search: str | None = None,
    materia_id: int | None = None,
    solo_activos: bool = False
):
    """
    Descarga el reporte de inconsistencias en formato CSV.
    """
    _ensure_admin(request)
    import csv
    from django.http import HttpResponse
    
    data = _generar_auditoria_academica(
        profesorado_id=profesorado_id,
        search=search,
        materia_id=materia_id,
        solo_activos=solo_activos
    )
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="auditoria_inconsistencias.csv"'
    
    writer = csv.DictWriter(response, fieldnames=[
        'estudiante', 'dni', 'materia', 'evento', 'fecha', 'prerrequisito', 'tipo_corr', 'motivo'
    ])
    writer.writeheader()
    for row in data:
        writer.writerow(row)
        
    return response
