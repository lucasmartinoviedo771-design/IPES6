from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from ninja import Router
from ninja.errors import HttpError

from apps.common.api_schemas import AuditLogItem, AuditLogList
from core.auth_ninja import JWTAuth
from core.models import AuditLog
from core.permissions import ensure_roles

router = Router(tags=["auditoria"], auth=JWTAuth())


def _parse_datetime(value: str | None):
    if not value:
        return None
    dt = parse_datetime(value)
    if not dt:
        return None
    if timezone.is_naive(dt):
        if settings.USE_TZ:
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
    else:
        if not settings.USE_TZ:
            dt = timezone.make_naive(dt, timezone.get_current_timezone())
    return dt


def _serialize_log(log: AuditLog, *, include_payload: bool) -> AuditLogItem:
    return AuditLogItem(
        id=log.id,
        timestamp=log.timestamp.isoformat(sep=" ", timespec="milliseconds"),
        usuario_id=log.usuario_id,
        nombre_usuario=log.nombre_usuario,
        roles=log.roles or [],
        accion=log.accion,
        tipo_accion=log.tipo_accion,
        detalle_accion=log.detalle_accion or "",
        entidad_afectada=log.entidad_afectada or "",
        id_entidad=log.id_entidad or "",
        resultado=log.resultado,
        ip_origen=log.ip_origen or "",
        session_id=log.session_id or "",
        request_id=log.request_id or "",
        payload=log.payload if include_payload else None,
    )


@router.get("/logs", response=AuditLogList)
def listar_logs(
    request,
    usuario_id: int | None = None,
    accion: str | None = None,
    tipo_accion: str | None = None,
    detalle_accion: str | None = None,
    entidad: str | None = None,
    entidad_id: str | None = None,
    request_id: str | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    limit: int = 50,
    offset: int = 0,
    incluir_payload: bool = False,
):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    qs = AuditLog.objects.all().order_by("-timestamp")
    if usuario_id:
        qs = qs.filter(usuario_id=usuario_id)
    if accion:
        qs = qs.filter(accion=accion)
    if tipo_accion:
        qs = qs.filter(tipo_accion=tipo_accion)
    if detalle_accion:
        qs = qs.filter(detalle_accion=detalle_accion)
    if entidad:
        qs = qs.filter(entidad_afectada=entidad)
    if entidad_id:
        qs = qs.filter(id_entidad=str(entidad_id))
    if request_id:
        qs = qs.filter(request_id=request_id)
    desde_dt = _parse_datetime(desde)
    hasta_dt = _parse_datetime(hasta)
    if desde_dt:
        qs = qs.filter(timestamp__gte=desde_dt)
    if hasta_dt:
        qs = qs.filter(timestamp__lte=hasta_dt)
    total = qs.count()
    items = [_serialize_log(log, include_payload=incluir_payload) for log in qs[offset : offset + limit]]
    return AuditLogList(total=total, items=items)


@router.get("/logs/{log_id}", response=AuditLogItem)
def obtener_log(request, log_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    log = AuditLog.objects.filter(id=log_id).first()
    if not log:
        raise HttpError(404, "Log no encontrado.")
    return _serialize_log(log, include_payload=True)
