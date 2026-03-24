from __future__ import annotations

from collections.abc import Iterable

from django.contrib.auth.models import User

from apps.common.constants import AppErrorCode
from apps.common.errors import AppError

from .models import StaffAsignacion

_LIMITED_ROLES = {"coordinador", "bedel", "estudiante"}
_UNRESTRICTED_ROLES = {
    "admin",
    "secretaria",
    "jefa_aaee",
    "consulta",
    "tutor",
    "jefes",
}


STRUCTURE_VIEW_ROLES = {
    "admin", "secretaria", "bedel", "coordinador", "tutor",
    "jefes", "jefa_aaee", "consulta", "estudiante",
}
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}
ACADEMIC_MANAGE_ROLES = {"admin", "secretaria", "bedel"}
ACADEMIC_VIEW_ROLES = STRUCTURE_VIEW_ROLES | {"tutor"}
VENTANA_VIEW_ROLES = STRUCTURE_VIEW_ROLES | {"tutor", "estudiante"}
PREINS_GESTION_ROLES = {"admin", "secretaria", "bedel"}
GLOBAL_OVERVIEW_ROLES = {
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes",
    "tutor", "coordinador", "consulta",
}
ALL_ROLES: set[str] = {
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes",
    "tutor", "coordinador", "consulta", "estudiante",
}
ROLE_ASSIGN_MATRIX: dict[str, list[str]] = {
    "admin": list(ALL_ROLES),
    "secretaria": [role for role in ALL_ROLES if role != "admin"],
    "jefa_aaee": ["bedel", "tutor", "coordinador"],
}

def _ensure_authenticated(user: User | None) -> User:
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")
    return user


def get_user_roles(user: User) -> set[str]:
    raw_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    roles = set(raw_names)
    for name in raw_names:
        if name.startswith("bedel"):
            roles.add("bedel")
        if name.startswith("secretaria"):
            roles.add("secretaria")
        if name.startswith("coordinador"):
            roles.add("coordinador")
        if name == "estudiantes" or "estudiante" in name:
            roles.add("estudiante")
        if name == "docentes" or "docente" in name:
            roles.add("docente")

    if user.is_superuser or user.is_staff:
        roles.add("admin")
    return roles


def ensure_roles(user: User | None, allowed_roles: Iterable[str]) -> None:
    user = _ensure_authenticated(user)
    if user.is_superuser or user.is_staff:
        return
    allowed = {role.lower() for role in allowed_roles}
    groups = get_user_roles(user)
    if not groups.intersection(allowed):
        raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos suficientes para realizar esta acción.")


def allowed_profesorados(user: User | None, role_filter: Iterable[str] | None = None) -> set[int] | None:
    user = _ensure_authenticated(user)
    if user.is_superuser:
        return None
    groups = get_user_roles(user)
    if groups.intersection(_UNRESTRICTED_ROLES):
        return None
    relevant_roles = _LIMITED_ROLES
    if role_filter:
        relevant_roles = {role.lower() for role in role_filter}
    
    if not groups.intersection(relevant_roles):
        return None
    
    ids = set()
    
    # Si es estudiante, agregar sus carreras
    if "estudiante" in groups:
        est = getattr(user, "estudiante", None)
        if est:
            ids.update(est.carreras.values_list("id", flat=True))
            
    # Agregar asignaciones de staff
    staff_qs = StaffAsignacion.objects.filter(user=user)
    if role_filter:
        staff_qs = staff_qs.filter(rol__in=[role.lower() for role in role_filter])
    
    ids.update(staff_qs.values_list("profesorado_id", flat=True))
    
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
