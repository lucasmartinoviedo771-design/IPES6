from __future__ import annotations

from typing import Iterable, Optional, Set

from django.contrib.auth.models import User
from ninja.errors import HttpError

from .models import StaffAsignacion

_LIMITED_ROLES = {"coordinador"}
_UNRESTRICTED_ROLES = {"admin", "secretaria", "jefa_aaee", "consulta", "tutor", "jefes", "bedel"}


def _ensure_authenticated(user: Optional[User]) -> User:
    if not user or not user.is_authenticated:
        raise HttpError(401, "No autenticado")
    return user


def _group_names(user: User) -> Set[str]:
    return {name.lower().strip() for name in user.groups.values_list("name", flat=True)}


def ensure_roles(user: Optional[User], allowed_roles: Iterable[str]) -> None:
    user = _ensure_authenticated(user)
    if user.is_superuser or user.is_staff:
        return
    allowed = {role.lower() for role in allowed_roles}
    groups = _group_names(user)
    if not groups.intersection(allowed):
        raise HttpError(403, "No tiene permisos suficientes para realizar esta acción.")


def allowed_profesorados(user: Optional[User], role_filter: Optional[Iterable[str]] = None) -> Optional[Set[int]]:
    user = _ensure_authenticated(user)
    if user.is_superuser or user.is_staff:
        return None
    groups = _group_names(user)
    if groups.intersection(_UNRESTRICTED_ROLES):
        return None
    relevant_roles = _LIMITED_ROLES
    if role_filter:
        relevant_roles = {role.lower() for role in role_filter}
    if not groups.intersection(relevant_roles):
        return None
    qs = StaffAsignacion.objects.filter(user=user)
    if role_filter:
        qs = qs.filter(rol__in=[role.lower() for role in role_filter])
    ids = set(qs.values_list("profesorado_id", flat=True))
    return ids


def ensure_profesorado_access(user: Optional[User], profesorado_id: int, role_filter: Optional[Iterable[str]] = None) -> None:
    allowed = allowed_profesorados(user, role_filter=role_filter)
    if allowed is None:
        return
    if profesorado_id in allowed:
        return
    raise HttpError(403, "No tiene permisos sobre este profesorado.")
