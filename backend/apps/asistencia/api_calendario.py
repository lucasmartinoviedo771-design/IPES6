from datetime import date
from django.http import HttpRequest
from ninja import Router
from ninja.errors import HttpError

from core.models import Turno, CalendarioAsistenciaEvento
from core.auth_ninja import JWTAuth

from .schemas import (
    AsistenciaCalendarioEventoIn,
    AsistenciaCalendarioEventoOut,
)
from .api_helpers import (
    _resolve_scope,
    _ensure_authenticated_scope,
    _calendario_queryset_with_scope,
    _evento_to_schema,
    _ensure_calendar_manage_scope,
    _resolver_event_scope,
)

router = Router(tags=["asistencia-calendario"], auth=JWTAuth())

@router.get("/", response=list[AsistenciaCalendarioEventoOut], auth=JWTAuth())
def listar_eventos_calendario(
    request: HttpRequest,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: str | None = None,
    solo_activos: bool = True,
) -> list[AsistenciaCalendarioEventoOut]:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    queryset = CalendarioAsistenciaEvento.objects.all().select_related(
        "turno",
        "profesorado",
        "plan",
        "comision",
        "docente",
    )
    if solo_activos:
        queryset = queryset.filter(activo=True)
    if desde:
        queryset = queryset.filter(fecha_hasta__gte=desde)
    if hasta:
        queryset = queryset.filter(fecha_desde__lte=hasta)
    if tipo:
        queryset = queryset.filter(tipo=tipo)

    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    queryset = queryset.order_by("-fecha_desde", "-fecha_hasta")
    return [_evento_to_schema(evento) for evento in queryset]


@router.post("/", response=AsistenciaCalendarioEventoOut, auth=JWTAuth())
def crear_evento_calendario(request: HttpRequest, payload: AsistenciaCalendarioEventoIn) -> AsistenciaCalendarioEventoOut:
    roles, staff_profesorados, _docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para crear eventos de asistencia.")

    if payload.fecha_desde > payload.fecha_hasta:
        raise HttpError(400, "La fecha desde no puede ser posterior a la fecha hasta.")

    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
        if not turno:
            raise HttpError(404, "El turno indicado no existe.")

    scope = _resolver_event_scope(payload)
    _ensure_calendar_manage_scope(roles, staff_profesorados, scope)

    evento = CalendarioAsistenciaEvento.objects.create(
        nombre=payload.nombre,
        tipo=payload.tipo,
        subtipo=payload.subtipo or CalendarioAsistenciaEvento.Subtipo.GENERAL,
        fecha_desde=payload.fecha_desde,
        fecha_hasta=payload.fecha_hasta,
        turno=turno,
        profesorado=scope["profesorado"],
        plan=scope["plan"],
        comision=scope["comision"],
        docente=scope["docente"],
        aplica_docentes=payload.aplica_docentes,
        aplica_estudiantes=payload.aplica_estudiantes,
        motivo=payload.motivo or "",
        activo=payload.activo,
        creado_por=request.user,
        actualizado_por=request.user,
    )
    return _evento_to_schema(evento)


@router.put("/{evento_id}", response=AsistenciaCalendarioEventoOut, auth=JWTAuth())
def actualizar_evento_calendario(
    request: HttpRequest,
    evento_id: int,
    payload: AsistenciaCalendarioEventoIn,
) -> AsistenciaCalendarioEventoOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para modificar eventos de asistencia.")

    queryset = CalendarioAsistenciaEvento.objects.filter(id=evento_id)
    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    evento = queryset.first()
    if not evento:
        raise HttpError(404, "El evento solicitado no existe.")

    if payload.fecha_desde > payload.fecha_hasta:
        raise HttpError(400, "La fecha desde no puede ser posterior a la fecha hasta.")

    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
        if not turno:
            raise HttpError(404, "El turno indicado no existe.")

    scope = _resolver_event_scope(payload)
    _ensure_calendar_manage_scope(roles, staff_profesorados, scope)

    evento.nombre = payload.nombre
    evento.tipo = payload.tipo
    evento.subtipo = payload.subtipo or CalendarioAsistenciaEvento.Subtipo.GENERAL
    evento.fecha_desde = payload.fecha_desde
    evento.fecha_hasta = payload.fecha_hasta
    evento.turno = turno
    evento.profesorado = scope["profesorado"]
    evento.plan = scope["plan"]
    evento.comision = scope["comision"]
    evento.docente = scope["docente"]
    evento.aplica_docentes = payload.aplica_docentes
    evento.aplica_estudiantes = payload.aplica_estudiantes
    evento.motivo = payload.motivo or ""
    evento.activo = payload.activo
    evento.actualizado_por = request.user
    evento.save()

    return _evento_to_schema(evento)


@router.delete("/{evento_id}", response=None, auth=JWTAuth())
def eliminar_evento_calendario(request: HttpRequest, evento_id: int):
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para eliminar eventos de asistencia.")

    queryset = CalendarioAsistenciaEvento.objects.filter(id=evento_id)
    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    evento = queryset.first()
    if not evento:
        raise HttpError(404, "El evento solicitado no existe.")

    scope = {
        "profesorado": evento.profesorado,
        "plan": evento.plan,
        "comision": evento.comision,
    }
    _ensure_calendar_manage_scope(roles, staff_profesorados, scope)

    evento.delete()
    return 200, None
