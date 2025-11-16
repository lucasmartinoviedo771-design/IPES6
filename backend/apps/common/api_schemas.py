from typing import Any

from ninja import Schema


class ApiResponse(Schema):
    ok: bool
    message: str | None = None
    data: Any | None = None


class AuditLogItem(Schema):
    id: int
    timestamp: str
    usuario_id: int | None = None
    nombre_usuario: str | None = None
    roles: list[str] = []
    accion: str
    tipo_accion: str
    detalle_accion: str | None = None
    entidad_afectada: str | None = None
    id_entidad: str | None = None
    resultado: str
    ip_origen: str | None = None
    session_id: str | None = None
    request_id: str | None = None
    payload: dict | None = None


class AuditLogList(Schema):
    total: int
    items: list[AuditLogItem]
