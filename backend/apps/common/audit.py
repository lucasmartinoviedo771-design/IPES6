from __future__ import annotations

import logging
from datetime import datetime, date
from decimal import Decimal
from typing import Any, Mapping

from django.contrib.auth.models import AnonymousUser, User
from django.db import transaction
from django.forms.models import model_to_dict

from core.models import AuditLog

logger = logging.getLogger(__name__)


def snapshot(instance: Any, *, fields: list[str] | None = None, exclude: list[str] | None = None) -> dict | None:
    data = _to_dict(instance, fields=fields, exclude=exclude)
    return _json_safe(data) if data is not None else None


def log_action(
    *,
    user: User | AnonymousUser | None,
    accion: str,
    tipo_accion: str,
    detalle_accion: str,
    entidad: str | None = None,
    entidad_id: Any | None = None,
    before: Mapping | Any | None = None,
    after: Mapping | Any | None = None,
    metadata: Mapping | None = None,
    resultado: str = AuditLog.Resultado.OK,
    roles: list[str] | None = None,
    ip_origen: str | None = None,
    session_id: str | None = None,
    request_id: str | None = None,
) -> None:
    if isinstance(user, AnonymousUser):
        user = None
    payload = _build_payload(before, after, metadata)
    usuario_id = user.id if user and getattr(user, "id", None) else None
    nombre_usuario = ""
    if user:
        nombre_usuario = user.get_full_name() or getattr(user, "username", "") or user.email or ""
    roles = roles if roles is not None else _resolve_roles(user)
    entidad_id_str = str(entidad_id) if entidad_id is not None else ""

    def _write():
        try:
            AuditLog.objects.create(
                usuario=user,
                nombre_usuario=nombre_usuario,
                roles=roles or [],
                accion=accion,
                tipo_accion=tipo_accion,
                detalle_accion=detalle_accion,
                entidad_afectada=entidad or "",
                id_entidad=entidad_id_str,
                resultado=resultado,
                ip_origen=ip_origen or "",
                session_id=session_id or "",
                request_id=request_id or "",
                payload=payload,
            )
        except Exception:  # pragma: no cover - nunca debe volar la app por el log
            logger.exception("No se pudo registrar el log de auditoría")

    transaction.on_commit(_write)


def log_action_from_request(request, **kwargs):
    user = getattr(request, "user", None)
    session_id = getattr(request, "audit_session_id", None)
    request_id = getattr(request, "request_id", None)
    ip = getattr(request, "audit_ip", None)
    return log_action(
        user=user,
        session_id=session_id,
        request_id=request_id,
        ip_origen=ip,
        **kwargs,
    )


def _build_payload(before, after, metadata):
    before_dict = snapshot(before) if before is not None else None
    after_dict = snapshot(after) if after is not None else None
    payload = {
        "before": before_dict,
        "after": after_dict,
        "changes": _compute_changes(before_dict, after_dict),
        "metadata": _json_safe(metadata) if metadata else {},
    }
    return payload


def _compute_changes(before, after):
    if not before and not after:
        return []
    before = before or {}
    after = after or {}
    keys = set(before.keys()) | set(after.keys())
    changes = []
    for key in sorted(keys):
        if before.get(key) != after.get(key):
            changes.append({"field": key, "old": before.get(key), "new": after.get(key)})
    return changes


def _resolve_roles(user: User | None) -> list[str]:
    if not user or not getattr(user, "is_authenticated", False):
        return []
    groups = list(user.groups.values_list("name", flat=True))
    if user.is_staff and "staff" not in groups:
        groups.append("staff")
    if user.is_superuser and "superuser" not in groups:
        groups.append("superuser")
    return groups


def _to_dict(value: Any, *, fields=None, exclude=None):
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if hasattr(value, "_meta"):
        return model_to_dict(value, fields=fields, exclude=exclude)
    return value


def _json_safe(value: Any):
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Mapping):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return str(value)
