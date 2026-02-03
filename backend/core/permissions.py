from __future__ import annotations

from collections.abc import Iterable

from django.contrib.auth.models import User

from apps.common.constants import AppErrorCode
from apps.common.errors import AppError

from .models import StaffAsignacion

_LIMITED_ROLES = {"coordinador", "bedel"}
_UNRESTRICTED_ROLES = {
    "admin",
    "secretaria",
    "jefa_aaee",
    "consulta",
    "tutor",
    "jefes",
}


def _ensure_authenticated(user: User | None) -> User:
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")
    return user


def _group_names(user: User) -> set[str]:
    raw_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    expanded = set(raw_names)
    for name in raw_names:
        if name.startswith("bedel"):
            expanded.add("bedel")
        if name.startswith("secretaria"):
            expanded.add("secretaria")
        if name.startswith("coordinador"):
            expanded.add("coordinador")
    return expanded


def ensure_roles(user: User | None, allowed_roles: Iterable[str]) -> None:
    user = _ensure_authenticated(user)
    if user.is_superuser or user.is_staff:
        return
    allowed = {role.lower() for role in allowed_roles}
    groups = _group_names(user)
    if not groups.intersection(allowed):
        raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos suficientes para realizar esta acción.")


def allowed_profesorados(user: User | None, role_filter: Iterable[str] | None = None) -> set[int] | None:
    user = _ensure_authenticated(user)
    if user.is_superuser:
        return None
    groups = _group_names(user)
    print(f"DEBUG: User={user}, Groups={groups}, IsSuper={user.is_superuser}, IsStaff={user.is_staff}")
    if groups.intersection(_UNRESTRICTED_ROLES):
        print("DEBUG: Unrestricted role match")
        return None
    relevant_roles = _LIMITED_ROLES
    if role_filter:
        relevant_roles = {role.lower() for role in role_filter}
    
    if not groups.intersection(relevant_roles):
        print(f"DEBUG: No limited role intersection. Relevant={relevant_roles}")
        return None
    qs = StaffAsignacion.objects.filter(user=user)
    if role_filter:
        qs = qs.filter(rol__in=[role.lower() for role in role_filter])
    ids = set(qs.values_list("profesorado_id", flat=True))
    print(f"DEBUG: Filtering IDs: {ids}")
    return ids


def ensure_profesorado_access(
    user: User | None,
    profesorado_id: int,
    role_filter: Iterable[str] | None = None,
) -> None:
    allowed = allowed_profesorados(user, role_filter=role_filter)
    if allowed is None:
        return
    if profesorado_id in allowed:
        return
    raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos sobre este profesorado.")
