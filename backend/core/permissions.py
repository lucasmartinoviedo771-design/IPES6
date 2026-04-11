"""
Lógica centralizada de autorización y permisos (RBAC).
Define las matrices de acceso, la normalización de roles y las funciones para 
validar el acceso a recursos específicos como Profesorados.
"""

from __future__ import annotations
from collections.abc import Iterable
from django.contrib.auth.models import User
from apps.common.constants import AppErrorCode
from apps.common.errors import AppError
from .models import StaffAsignacion

# Roles que tienen impacto limitado a sus asignaciones específicas
_LIMITED_ROLES = {"coordinador", "bedel", "estudiante"}

# Roles con acceso global o sin restricciones de asignación por profesorado
_UNRESTRICTED_ROLES = {
    "admin",
    "secretaria",
    "jefa_aaee",
    "consulta",
    "tutor",
    "jefes",
}

# --- MATRICES DE DEFINICIÓN DE ACCESO ---

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

# Define qué roles pueden asignar a otros roles (Admin Console)
ROLE_ASSIGN_MATRIX: dict[str, list[str]] = {
    "admin": list(ALL_ROLES),
    "secretaria": [role for role in ALL_ROLES if role != "admin"],
    "jefa_aaee": ["bedel", "tutor", "coordinador"],
}


def _ensure_authenticated(user: User | None) -> User:
    """
    Validación interna de estado de sesión.
    Lanza error 401 si el usuario es anónimo.
    """
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")
    return user


def get_user_roles(user: User) -> set[str]:
    """
    Extrae y normaliza los roles del usuario basado en sus Grupos de Django.
    Conserva la lógica de mapeo definida en auth_ninja.py para consistencia.
    """
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

    if user.is_superuser:
        roles.add("admin")
    return roles


def ensure_roles(user: User | None, allowed_roles: Iterable[str]) -> None:
    """
    Función imperativa para validar roles en vistas clásicas o servicios.
    Si el usuario no tiene al menos uno de los roles permitidos, lanza un AppError(403).
    """
    user = _ensure_authenticated(user)
    if user.is_superuser:
        return
    
    allowed = {role.lower() for role in allowed_roles}
    groups = get_user_roles(user)
    if not groups.intersection(allowed):
        raise AppError(
            403, 
            AppErrorCode.PERMISSION_DENIED, 
            "No tiene permisos suficientes para realizar esta acción."
        )


def allowed_profesorados(user: User | None, role_filter: Iterable[str] | None = None) -> set[int] | None:
    """
    Determina la lista de IDs de Profesorado a los que el usuario tiene acceso.
    
    Returns:
        set[int]: Lista de IDs autorizados.
        None: Si el usuario tiene acceso global (ej: admin/secretaría).
    """
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
    
    # Caso Estudiante: Acceso solo a sus propias carreras
    if "estudiante" in groups:
        est = getattr(user, "estudiante", None)
        if est:
            ids.update(est.carreras.values_list("id", flat=True))
            
    # Caso Staff (Bedeles/Coordinadores): Acceso por asignación explícita
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
    """
    Valida si el usuario tiene permiso para operar sobre un profesorado específico.
    Utilizada en routers de preinscripciones y carga de notas.
    """
    allowed = allowed_profesorados(user, role_filter=role_filter)
    if allowed is None:
        return # Acceso global concedido
        
    if profesorado_id in allowed:
        return
        
    raise AppError(
        403, 
        AppErrorCode.PERMISSION_DENIED, 
        "No tiene permisos sobre este profesorado."
    )
