from __future__ import annotations
from datetime import date, timedelta
from typing import List
from django.http import HttpRequest
from django.utils import timezone
from django.db.models import Count, Q
from ninja import Router
from ninja.errors import HttpError

from core.models import Comision, Estudiante, Docente
from core.permissions import get_user_roles
from core.auth_ninja import JWTAuth
from apps.docentes.services.docente_service import DocenteService

from .models import (
    AsistenciaEstudiante,
    AsistenciaDocente,
    ClaseProgramada,
    CursoEstudianteSnapshot,
    Justificacion,
)
from .schemas import (
    EstudianteResumenOut,
    EstudianteClasesResponse,
    EstudianteClaseListadoOut,
    ClaseEstudianteDetalleOut,
    RegistrarAsistenciaEstudiantesIn,
    JustificacionCreateIn,
    JustificacionDetailOut,
    JustificacionListItemOut,
    JustificacionOut,
    JustificacionRechazarIn,
    EstudianteAsistenciaItemOut,
    JustificacionDetalleOut,
    ClaseNavegacionOut,
)
from .services import (
    apply_justification,
    attach_classes_to_justification,
    generate_classes_for_range,
    sync_course_snapshots,
)
from apps.common.date_utils import format_date, format_datetime
from .api_helpers import (
    _resolve_scope,
    _ensure_authenticated_scope,
    _staff_profesorados,
    _build_horario,
    _docente_nombre,
    _justificacion_queryset_with_scope,
    _serialize_justificacion_summary,
    _serialize_justificacion_detail,
    _get_profesorado_id_from_comision,
)

router = Router(tags=["asistencia-estudiantes"], auth=JWTAuth())

@router.get("/clases/{clase_id}", response=ClaseEstudianteDetalleOut)
def obtener_clase_estudiantes(request: HttpRequest, clase_id: int) -> ClaseEstudianteDetalleOut:
    clase = (
        ClaseProgramada.objects.select_related(
            "comision",
            "comision__materia",
            "comision__turno",
            "docente",
        )
        .filter(id=clase_id)
        .first()
    )
    if not clase:
        raise HttpError(404, "No se encontró la clase requerida.")

    last_snapshot = CursoEstudianteSnapshot.objects.filter(comision_id=clase.comision_id).order_by("-sincronizado_en").first()
    should_sync = False
    if not last_snapshot:
        should_sync = True
    else:
        now = timezone.now()
        diff = now - last_snapshot.sincronizado_en
        if diff > timedelta(hours=24):
            should_sync = True

    if should_sync:
        sync_course_snapshots(comisiones=[clase.comision])
        from .services import _ensure_asistencias_estudiantes
        _ensure_asistencias_estudiantes(clase)

    asistencias = list(
        AsistenciaEstudiante.objects.filter(clase=clase)
        .select_related("estudiante__user")
        .order_by("estudiante__user__last_name", "estudiante__user__first_name")
    )

    stats = (
        AsistenciaEstudiante.objects.filter(clase__comision_id=clase.comision_id)
        .values("estudiante_id")
        .annotate(
            total=Count("id"),
            presentes=Count(
                "id",
                filter=Q(estado__in=[AsistenciaEstudiante.Estado.PRESENTE, AsistenciaEstudiante.Estado.TARDE])
            ),
        )
    )
    stats_map = {s["estudiante_id"]: s for s in stats}

    estudiantes = []
    for asistencia in asistencias:
        stat = stats_map.get(asistencia.estudiante_id, {"total": 0, "presentes": 0})
        total = stat["total"]
        presentes = stat["presentes"]
        porcentaje = (presentes / total * 100) if total > 0 else 0.0
        
        estudiantes.append(
            EstudianteResumenOut(
                estudiante_id=asistencia.estudiante_id,
                dni=asistencia.estudiante.dni,
                nombre=asistencia.estudiante.user.first_name if asistencia.estudiante.user_id else "",
                apellido=asistencia.estudiante.user.last_name if asistencia.estudiante.user_id else "",
                estado=asistencia.estado,
                justificada=asistencia.justificacion_id is not None,
                porcentaje_asistencia=round(porcentaje, 1),
            )
        )

    docentes = []
    docente_presente = False
    docente_categoria = None
    
    if clase.docente:
        docentes.append(_docente_nombre(clase.docente))
        asistencia_doc = AsistenciaDocente.objects.filter(
            clase=clase,
            docente=clase.docente,
            estado=AsistenciaDocente.Estado.PRESENTE
        ).first()
        
        if asistencia_doc:
            docente_presente = True
            docente_categoria = asistencia_doc.marcacion_categoria

    otras_clases_qs = (
        ClaseProgramada.objects.filter(
            comision_id=clase.comision_id,
            fecha__lte=timezone.now().date()
        )
        .order_by("-fecha")[:20]
    )
    
    otras_clases = [
        ClaseNavegacionOut(
            id=c.id,
            fecha=format_date(c.fecha),
            descripcion=f"Clase del {format_date(c.fecha)}",
            actual=(c.id == clase.id)
        )
        for c in otras_clases_qs
    ]

    return ClaseEstudianteDetalleOut(
        clase_id=clase.id,
        comision=str(clase.comision),
        fecha=format_date(clase.fecha),
        horario=f"{clase.hora_inicio.strftime('%H:%M')} - {clase.hora_fin.strftime('%H:%M')}" if clase.hora_inicio and clase.hora_fin else None,
        materia=str(clase.comision.materia) if clase.comision.materia else str(clase.comision),
        docentes=docentes,
        docente_presente=docente_presente,
        docente_categoria_asistencia=docente_categoria,
        estudiantes=estudiantes,
        otras_clases=otras_clases,
    )

@router.get("/clases", response=EstudianteClasesResponse)
def listar_clases_estudiantes(
    request: HttpRequest,
    comision_id: int | None = None,
    materia_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> EstudianteClasesResponse:
    if not comision_id and not materia_id:
        raise HttpError(400, "Debes indicar una comisión o una materia para filtrar.")

    desde = desde or date.today()
    hasta = hasta or desde
    if desde > hasta:
        raise HttpError(400, "La fecha 'desde' no puede ser posterior a 'hasta'.")

    comisiones_qs = Comision.objects.all()
    if comision_id:
        comisiones_qs = comisiones_qs.filter(id=comision_id)
    if materia_id:
        comisiones_qs = comisiones_qs.filter(materia_id=materia_id)

    roles = get_user_roles(getattr(request, "user", None))
    if not roles:
        raise HttpError(401, "Autenticación requerida.")

    if not roles & {"admin", "secretaria"}:
        profesorados_limit = _staff_profesorados(getattr(request, "user", None), roles)
        if profesorados_limit:
            comisiones_qs = comisiones_qs.filter(materia__profesorado_id__in=profesorados_limit)
        elif roles & {"bedel", "coordinador", "tutor"}:
            raise HttpError(403, "No tenés profesorados asignados para consultar asistencia.")

    comision_ids = list(comisiones_qs.values_list("id", flat=True))
    if not comision_ids:
        return EstudianteClasesResponse(clases=[])

    comisiones_a_sincronizar = []
    now = timezone.now()
    for cid in comision_ids:
        last_snap = CursoEstudianteSnapshot.objects.filter(comision_id=cid).order_by("-sincronizado_en").first()
        if not last_snap or (now - last_snap.sincronizado_en) > timedelta(hours=24):
            comisiones_a_sincronizar.append(cid)
    
    if comisiones_a_sincronizar:
        objs = Comision.objects.filter(id__in=comisiones_a_sincronizar)
        sync_course_snapshots(comisiones=objs)

    generate_classes_for_range(desde, hasta, comision_ids=comision_ids)

    clases_qs = (
        ClaseProgramada.objects.filter(comision_id__in=comision_ids, fecha__range=(desde, hasta))
        .select_related("comision", "comision__materia", "comision__turno")
        .annotate(
            total_estudiantes=Count("asistencias_estudiantes"),
            presentes=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaEstudiante.Estado.PRESENTE),
            ),
            ausentes=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaEstudiante.Estado.AUSENTE),
            ),
            ausentes_justificados=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaEstudiante.Estado.AUSENTE_JUSTIFICADA),
            ),
        )
        .order_by("fecha", "comision__materia__nombre", "comision__codigo", "hora_inicio")
    )

    clases_out = [
        EstudianteClaseListadoOut(
            clase_id=clase.id,
            fecha=format_date(clase.fecha),
            materia=clase.comision.materia.nombre,
            comision=clase.comision.codigo,
            turno=clase.comision.turno.nombre if clase.comision.turno_id else None,
            horario=_build_horario(clase.hora_inicio, clase.hora_fin),
            estado_clase=clase.estado,
            total_estudiantes=clase.total_estudiantes or 0,
            presentes=clase.presentes or 0,
            ausentes=clase.ausentes or 0,
            ausentes_justificados=clase.ausentes_justificados or 0,
        )
        for clase in clases_qs
    ]

    return EstudianteClasesResponse(clases=clases_out)

@router.post("/clases/{clase_id}/registrar", response=None)
def registrar_asistencia_estudiantes(request: HttpRequest, clase_id: int, payload: RegistrarAsistenciaEstudiantesIn):
    clase = ClaseProgramada.objects.filter(id=clase_id).first()
    if not clase:
        raise HttpError(404, "No se encontró la clase indicada.")

    presentes = set(payload.presentes)
    tardes = set(payload.tardes)
    
    roles = get_user_roles(getattr(request, "user", None))
    es_staff = bool(roles & {"admin", "secretaria", "bedel"})
    
    if not es_staff:
        docente_profile = DocenteService.get_docente_from_user(request.user)
        if docente_profile and clase.docente_id == docente_profile.id:
            docente_presente = AsistenciaDocente.objects.filter(
                clase=clase,
                docente=docente_profile,
                estado=AsistenciaDocente.Estado.PRESENTE
            ).exists()
            if not docente_presente:
                raise HttpError(400, "Debés registrar tu propia asistencia (Presente) antes de cargar la de los estudiantes.")

    registros = AsistenciaEstudiante.objects.filter(clase=clase).select_related("estudiante")

    for registro in registros:
        estado_nuevo = AsistenciaEstudiante.Estado.AUSENTE
        if registro.estudiante_id in presentes:
            estado_nuevo = AsistenciaEstudiante.Estado.PRESENTE
        elif registro.estudiante_id in tardes:
            estado_nuevo = AsistenciaEstudiante.Estado.TARDE
            
        if registro.justificacion_id:
            estado_nuevo = AsistenciaEstudiante.Estado.AUSENTE_JUSTIFICADA
            
        if registro.estado != estado_nuevo:
            registro.estado = estado_nuevo
            registro.registrado_via = AsistenciaEstudiante.RegistradoVia.STAFF
            registro.registrado_por = request.user if request.user and request.user.is_authenticated else None
            registro.save(update_fields=["estado", "registrado_via", "registrado_por", "registrado_en"])

@router.get("/mis-asistencias", response=List[EstudianteAsistenciaItemOut])
def listar_mis_asistencias(request: HttpRequest, dni: str | None = None):
    if not request.user.is_authenticated:
        raise HttpError(401, "Autenticación requerida.")

    roles = get_user_roles(request.user)
    is_staff = bool(roles & {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefatura"})

    if dni:
        if not is_staff:
            raise HttpError(403, "No tenés permisos para ver la asistencia de otros estudiantes.")
        estudiante = Estudiante.objects.filter(Q(persona__dni=dni) | Q(legajo=dni)).first()
        if not estudiante:
            raise HttpError(404, f"No se encontró un estudiante con DNI/Legajo {dni}.")
    else:
        estudiante = Estudiante.objects.filter(user=request.user).first()
        if not estudiante:
            raise HttpError(404, "No se encontró un perfil de estudiante asociado a tu usuario.")

    asistencias = (
        AsistenciaEstudiante.objects.filter(estudiante=estudiante)
        .select_related("clase", "clase__comision", "clase__comision__materia")
        .order_by("-clase__fecha", "-clase__hora_inicio")
    )

    data = []
    for asist in asistencias:
        data.append(
            EstudianteAsistenciaItemOut(
                id=asist.id,
                fecha=format_date(asist.clase.fecha),
                materia=asist.clase.comision.materia.nombre,
                comision=asist.clase.comision.codigo,
                estado=asist.estado,
                justificada=asist.justificacion_id is not None,
                observacion=None
            )
        )
    return data

@router.post("/justificaciones", response=JustificacionOut, auth=JWTAuth())
def crear_justificacion(request: HttpRequest, payload: JustificacionCreateIn) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    if payload.tipo not in (Justificacion.Tipo.ESTUDIANTE, Justificacion.Tipo.DOCENTE):
        raise HttpError(400, "Tipo de justificación inválido.")

    if payload.vigencia_desde > payload.vigencia_hasta:
        raise HttpError(400, "El rango de vigencia es inválido.")

    comision = (
        Comision.objects.select_related("materia__plan_de_estudio__profesorado", "docente")
        .filter(id=payload.comision_id)
        .first()
    )
    if not comision:
        raise HttpError(404, "Comisión inexistente.")

    profesorado_id = _get_profesorado_id_from_comision(comision)
    if roles & {"admin", "secretaria"}:
        pass
    elif "bedel" in roles:
        if not staff_profesorados or profesorado_id not in staff_profesorados:
            raise HttpError(403, "No tenés permisos sobre el profesorado indicado.")
    elif docente_profile and comision.docente_id == docente_profile.id:
        pass
    else:
        raise HttpError(403, "No tenés permisos para crear esta justificación.")

    estudiante = None
    docente = None
    if payload.tipo == Justificacion.Tipo.ESTUDIANTE:
        if not payload.estudiante_id:
            raise HttpError(400, "Debe indicar un estudiante.")
        estudiante = Estudiante.objects.select_related("user").filter(id=payload.estudiante_id).first()
        if not estudiante:
            raise HttpError(404, "Estudiante inexistente.")
    else:
        docente_id = payload.docente_id or (docente_profile.id if docente_profile else None)
        if not docente_id:
            raise HttpError(400, "Debe indicar un docente.")
        docente = Docente.objects.filter(id=docente_id).first()
        if not docente:
            raise HttpError(404, "Docente inexistente.")
        if (
            docente_profile
            and docente.id != docente_profile.id
            and not roles & {"admin", "secretaria", "bedel"}
        ):
            raise HttpError(403, "No podés crear justificativos para otro docente.")

    justificacion = Justificacion.objects.create(
        tipo=payload.tipo,
        motivo=payload.motivo,
        estado=Justificacion.Estado.PENDIENTE,
        vigencia_desde=payload.vigencia_desde,
        vigencia_hasta=payload.vigencia_hasta,
        origen=payload.origen,
        observaciones=payload.observaciones or "",
        archivo_url=payload.archivo_url or "",
        creado_por=request.user if request.user and request.user.is_authenticated else None,
    )

    attach_classes_to_justification(
        justificacion,
        comision=comision,
        estudiante=estudiante,
        docente=docente,
    )

    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)

@router.get("/justificaciones", response=list[JustificacionListItemOut], auth=JWTAuth())
def listar_justificaciones(
    request: HttpRequest,
    tipo: str | None = None,
    estado: str | None = None,
    origen: str | None = None,
    profesorado_id: int | None = None,
    comision_id: int | None = None,
    docente_id: int | None = None,
    estudiante_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[JustificacionListItemOut]:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    queryset = Justificacion.objects.all()
    if tipo:
        queryset = queryset.filter(tipo=tipo)
    if estado:
        queryset = queryset.filter(estado=estado)
    if origen:
        queryset = queryset.filter(origen=origen)
    if desde:
        queryset = queryset.filter(vigencia_hasta__gte=desde)
    if hasta:
        queryset = queryset.filter(vigencia_desde__lte=hasta)
    if docente_id:
        queryset = queryset.filter(detalles__docente_id=docente_id)
    if estudiante_id:
        queryset = queryset.filter(detalles__estudiante_id=estudiante_id)
    if comision_id:
        queryset = queryset.filter(detalles__clase__comision_id=comision_id)
    if profesorado_id:
        queryset = queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id=profesorado_id
        )

    queryset = _justificacion_queryset_with_scope(
        queryset, roles, staff_profesorados, docente_profile
    )
    queryset = (
        queryset.select_related("creado_por", "aprobado_por")
        .prefetch_related(
            "detalles__clase__comision__materia__plan_de_estudio__profesorado",
            "detalles__estudiante__user",
            "detalles__docente",
        )
        .order_by("-creado_en")
        .distinct()
    )
    return [_serialize_justificacion_summary(j) for j in queryset]

@router.get(
    "/justificaciones/{justificacion_id}",
    response=JustificacionDetailOut,
    auth=JWTAuth(),
)
def obtener_justificacion(request: HttpRequest, justificacion_id: int) -> JustificacionDetailOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset, roles, staff_profesorados, docente_profile
    )
    justificacion = (
        queryset.select_related("creado_por", "aprobado_por")
        .prefetch_related(
            "detalles__clase__comision__materia__plan_de_estudio__profesorado",
            "detalles__estudiante__user",
            "detalles__docente",
        )
        .first()
    )
    if not justificacion:
        raise HttpError(404, "La justificación no existe.")
    return _serialize_justificacion_detail(justificacion)

@router.post(
    "/justificaciones/{justificacion_id}/aprobar",
    response=JustificacionOut,
    auth=JWTAuth(),
)
def aprobar_justificacion(request: HttpRequest, justificacion_id: int) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset,
        roles,
        staff_profesorados,
        docente_profile,
        for_manage=True,
    )
    justificacion = queryset.first()
    if not justificacion:
        raise HttpError(404, "La justificación no existe.")
    if justificacion.estado != Justificacion.Estado.PENDIENTE:
        raise HttpError(400, "La justificación ya fue procesada.")

    actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    justificacion.marcar_aprobada(actor)
    apply_justification(justificacion)
    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)

@router.post(
    "/justificaciones/{justificacion_id}/rechazar",
    response=JustificacionOut,
    auth=JWTAuth(),
)
def rechazar_justificacion(
    request: HttpRequest,
    justificacion_id: int,
    payload: JustificacionRechazarIn,
) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset,
        roles,
        staff_profesorados,
        docente_profile,
        for_manage=True,
    )
    justificacion = queryset.first()
    if not justificacion:
        raise HttpError(404, "La justificación no existe.")
    if justificacion.estado != Justificacion.Estado.PENDIENTE:
        raise HttpError(400, "La justificación ya fue procesada.")

    actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    justificacion.marcar_rechazada(actor, observaciones=payload.observaciones)
    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)
