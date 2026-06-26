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
    "rectorado",
    "attp",
}

ALL_ROLES: set[str] = {
    # Roles de gestión
    "admin",
    "secretaria",
    "bedel",
    "coordinador",
    # Roles funcionales específicos
    "titulos",
    "equivalencias",
    "curso_intro",
    # Roles de supervisión/dirección
    "jefa_aaee",
    "jefes",
    "tutor",
    "consulta",
    "rectorado",
    "attp",
    # Roles de usuario final
    "estudiante",
    "docente",
}


# Define qué roles pueden asignar a otros roles (Admin Console)
ROLE_ASSIGN_MATRIX: dict[str, list[str]] = {
    "admin": list(ALL_ROLES),
    "secretaria": [role for role in ALL_ROLES if role != "admin"],
    "jefa_aaee": ["bedel", "tutor", "coordinador"],
}


# ══════════════════════════════════════════════════════════════
# TABLA DE CAPACIDADES — fuente única de verdad para permisos
# Cada capability mapea a los roles que la tienen.
# Para cambiar quién puede hacer qué, se modifica SOLO esta tabla.
# ══════════════════════════════════════════════════════════════

CAPABILITIES: dict[str, set[str]] = {
    # --- Gestión de estudiantes ---
    "ver_estudiantes": {
        "admin",
        "secretaria",
        "bedel",
        "coordinador",
        "tutor",
        "jefes",
        "jefa_aaee",
        "consulta",
        "rectorado",
        "attp",
    },
    "editar_estudiantes": {"admin", "secretaria", "bedel"},
    "ver_documentacion": {"admin", "secretaria", "bedel", "coordinador", "jefes"},
    "editar_documentacion": {"admin", "secretaria", "bedel"},
    # --- Académico ---
    "carga_regularidades": {"admin", "secretaria", "bedel", "docente"},
    "carga_finales": {"admin", "secretaria", "bedel", "docente"},
    "acta_manual": {"admin", "secretaria", "bedel", "docente"},
    "ver_actas": {"admin", "secretaria", "bedel", "titulos", "rectorado", "attp"},
    # --- Estructura curricular ---
    "ver_estructura": {
        "admin",
        "secretaria",
        "bedel",
        "coordinador",
        "tutor",
        "jefes",
        "jefa_aaee",
        "consulta",
        "estudiante",
        "rectorado",
        "attp",
    },
    "editar_estructura": {"admin", "secretaria", "bedel"},
    # --- Inscripciones ---
    "gestionar_preinscripcion": {"admin", "secretaria", "bedel"},
    "gestionar_ventanas": {"admin", "secretaria", "jefa_aaee"},
    "formalizar_inscripcion": {"admin", "secretaria", "bedel", "attp"},
    "gestionar_cambio_comision": {"admin", "secretaria", "bedel", "tutor", "attp"},
    # --- Equivalencias ---
    "gestionar_equivalencias": {"admin", "secretaria", "bedel", "tutor"},
    "revisar_equivalencias": {"admin", "secretaria", "equivalencias"},
    "cargar_equivalencias_titulos": {"admin", "secretaria", "titulos"},
    # --- Títulos y analíticos ---
    "gestionar_titulos": {"admin", "secretaria", "titulos", "tutor"},
    "gestionar_analiticos": {"admin", "secretaria", "titulos", "bedel"},
    "ver_analiticos": {"admin", "secretaria", "titulos", "bedel", "tutor"},
    # --- Curso introductorio ---
    "gestionar_ci": {"admin", "secretaria", "bedel", "curso_intro", "tutor"},
    "admin_ci": {"admin", "secretaria"},
    # --- Staff ---
    "asignar_roles": {"admin", "secretaria"},
    "gestionar_staff": {"admin", "secretaria"},
    # --- Horarios ---
    "ver_horarios": {"admin", "secretaria", "bedel", "coordinador", "rectorado", "attp", "estudiante", "docente"},
    "editar_horarios": {"admin", "secretaria"},
    # --- Asistencia de estudiantes ---
    "asistencia_estudiantes_ver": {"admin", "secretaria", "bedel", "docente"},
    "asistencia_estudiantes_editar": {"admin", "secretaria", "bedel", "docente"},
    "asistencia_estudiantes_justificar": {"admin", "secretaria", "bedel"},
    # --- Asistencia de docentes ---
    "asistencia_docentes_ver": {"admin", "secretaria"},
    "asistencia_docentes_editar": {"admin", "secretaria"},
    # --- Calendario ---
    "editar_calendario": {"admin", "secretaria", "bedel", "attp"},
    # --- Dashboard / reportes ---
    "ver_dashboard": {
        "admin",
        "secretaria",
        "bedel",
        "jefa_aaee",
        "jefes",
        "tutor",
        "coordinador",
        "consulta",
        "rectorado",
        "attp",
    },
    "ver_metricas": {"admin", "secretaria", "bedel", "jefes", "rectorado"},
    "ver_reportes": {"admin", "secretaria", "jefes", "rectorado", "attp"},
    # --- Mensajería ---
    # Nota: el estudiante puede ACCEDER a mensajería pero solo puede INICIAR
    # conversación con bedel/tutor de su carrera. Esa restricción se implementa
    # en el endpoint de mensajería, no en esta tabla.
    "enviar_mensajes": {"admin", "secretaria", "bedel", "coordinador", "tutor", "docente", "estudiante"},
    # --- Admin del sistema ---
    "admin_sistema": {"admin"},
    "primera_carga": {"admin", "secretaria", "bedel"},
    "auditoria": {"admin", "secretaria"},
}


def can(user: User, capability: str, active_role: str | None = None) -> bool:
    """
    ¿El usuario tiene esta capacidad?
    Consulta la tabla CAPABILITIES como fuente única de verdad.
    Si se provee active_role, evalúa de forma estricta contra ese rol (validando que pertenezca al usuario).
    """
    if user.is_superuser:
        return True
    allowed = CAPABILITIES.get(capability)
    if allowed is None:
        raise ValueError(f"Capability desconocida: '{capability}'. Revisar CAPABILITIES en permissions.py.")

    user_roles = get_user_roles(user)
    if active_role:
        role_part = active_role.split(":")[0].lower().strip()
        # Validamos que el active_role solicitado sea uno de los roles reales del usuario
        if role_part in user_roles:
            return role_part in allowed
        return False

    return bool(user_roles & allowed)


def require(user: User | None, capability: str, active_role: str | None = None) -> None:
    """
    Exige que el usuario tenga la capacidad indicada.
    Lanza AppError(401) si no está autenticado, AppError(403) si no tiene permiso.
    """
    user = _ensure_authenticated(user)
    if not can(user, capability, active_role):
        raise AppError(
            403,
            AppErrorCode.PERMISSION_DENIED,
            f"No tiene permisos para '{capability}'.",
        )


def requires(capability: str):
    """
    Decorador para endpoints Django Ninja.
    Uso: @requires("carga_regularidades")
    Lee el rol activo de la cabecera 'X-Active-Role'.
    """
    from functools import wraps

    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            # Leemos el rol activo desde las cabeceras HTTP de Django
            active_role = request.headers.get("X-Active-Role")
            require(request.user, capability, active_role)
            return func(request, *args, **kwargs)

        return wrapper

    return decorator


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
        if name == "rectorado":
            roles.add("rectorado")
        if name == "attp":
            roles.add("attp")

    if user.is_superuser:
        roles.add("admin")
    return roles


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

    # 1. Resolver el active_role y active_prof_id del request/sesión actual (si existe)
    session_role = None
    session_prof_id = None
    from core.middleware import get_current_request

    req = get_current_request()
    if req:
        ar = req.headers.get("X-Active-Role")
        if ar:
            ar = ar.lower().strip()
            if ":" in ar:
                parts = ar.split(":")
                session_role = parts[0]
                try:
                    session_prof_id = int(parts[1])
                except ValueError:
                    pass
            else:
                session_role = ar

    # 2. Determinar active_role y active_prof_id final a usar
    active_role = None
    active_prof_id = None

    if role_filter is None:
        if session_role:
            active_role = session_role
            active_prof_id = session_prof_id
            role_filter = [active_role]
    else:
        filter_list = {r.lower().strip() for r in role_filter}
        # Si el rol activo de la sesión actual coincide con los roles filtrados, aplicamos sus restricciones
        if session_role and session_role in filter_list:
            active_role = session_role
            active_prof_id = session_prof_id
            role_filter = [active_role]
        elif len(filter_list) == 1:
            ar = list(filter_list)[0]
            if ":" in ar:
                parts = ar.split(":")
                active_role = parts[0]
                try:
                    active_prof_id = int(parts[1])
                except ValueError:
                    pass
            else:
                active_role = ar
            role_filter = [active_role]

    groups = get_user_roles(user)
    if active_role:
        if active_role in _UNRESTRICTED_ROLES:
            return None
    else:
        if groups.intersection(_UNRESTRICTED_ROLES):
            return None

    # Si hay un active_prof_id explícito, validamos el acceso únicamente para ese ID
    if active_prof_id is not None:
        # Caso Estudiante:
        if "estudiante" in groups:
            est = getattr(user, "estudiante", None)
            if est and est.carreras.filter(id=active_prof_id).exists():
                return {active_prof_id}
        # Caso Staff:
        staff_qs = StaffAsignacion.objects.filter(user=user)
        if role_filter:
            role_filter_clean = [r.split(":")[0].lower() for r in role_filter]
            staff_qs = staff_qs.filter(rol__in=role_filter_clean)
        if staff_qs.filter(profesorado_id=active_prof_id).exists():
            return {active_prof_id}
        return set()

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
        return  # Acceso global concedido

    if profesorado_id in allowed:
        return

    raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos sobre este profesorado.")
