"""Helpers relacionados con usuarios, roles y resolución de estudiantes/docentes."""

from __future__ import annotations

from django.contrib.auth.models import AnonymousUser

from apps.common.constants import AppErrorCode
from apps.common.errors import AppError
from core.models import (
    Docente,
    Estudiante,
)
from core.permissions import can, get_user_roles, require


def _docente_full_name(docente: Docente | None) -> str | None:
    if not docente:
        return None
    apellido = (docente.apellido or "").strip()
    nombre = (docente.nombre or "").strip()
    if apellido and nombre:
        return f"{apellido}, {nombre}"
    return apellido or nombre or None


def _format_user_display(user) -> str | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    username = getattr(user, "username", "") or ""
    first_name = (getattr(user, "first_name", "") or "").strip()
    last_name = (getattr(user, "last_name", "") or "").strip()
    if first_name or last_name:
        full_name = f"{first_name} {last_name}".strip()
        return f"{username} ({full_name})"
    return username


def _resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
    if dni:
        return Estudiante.objects.filter(persona__dni=dni).first()
    if not request.user.is_authenticated:
        return None
    # Un usuario puede tener a la vez un rol de gestión (bedel, secretaria, etc.)
    # y una ficha de Estudiante propia (ej. cursa una certificación docente).
    # Si está operando activamente en un rol de gestión, no debe resolverse
    # como "consultando su propio historial de estudiante".
    active_role = (request.headers.get("X-Active-Role") or "").split(":")[0].lower().strip()
    if active_role and active_role != "estudiante":
        return None
    return getattr(request.user, "estudiante", None)


def _ensure_estudiante_access(request, dni: str | None) -> None:
    if not dni:
        return
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.UNAUTHENTICATED, "Autenticación requerida.")

    user_dni = getattr(user, "username", "")
    solicitante = getattr(user, "estudiante", None)

    # 1. Si el usuario consulta su propio DNI:
    if (solicitante and solicitante.dni == dni) or user_dni == dni:
        return

    # Si es estudiante intentando consultar el legajo/historial de otro alumno:
    if solicitante or user.groups.filter(name__in=["estudiante", "estudiantes"]).exists():
        raise AppError(
            403,
            AppErrorCode.PERMISSION_DENIED,
            "No tienes permisos para consultar la información académica de otro estudiante.",
        )

    # 2. Si es personal administrativo / staff:
    require(user, "ver_estudiantes")

    # Si tiene alcance acotado por profesorados (Bedel, Coordinador):
    from core.permissions import allowed_profesorados

    allowed_ids = allowed_profesorados(user)
    if allowed_ids is not None:
        from core.models import Estudiante

        est = Estudiante.objects.filter(persona__dni=dni).first()
        if est:
            est_carreras = set(est.carreras.values_list("id", flat=True))
            if not allowed_ids.intersection(est_carreras):
                raise AppError(
                    403,
                    AppErrorCode.PERMISSION_DENIED,
                    "No tiene permisos sobre la carrera de este estudiante.",
                )


def _resolve_docente_from_user(user) -> Docente | None:
    """
    Resuelve el Docente a partir del usuario autenticado usando SOLO el username (= DNI).

    No se usa `User.email`: es un campo obsoleto que puede contener datos históricos
    sucios (ver decisión P-1, Persona es la fuente de verdad de identidad). Resolver
    identidad por ahí permitiría que un email mal cargado habilite a un docente sobre
    la planilla de otro.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return None
    username = (getattr(user, "username", "") or "").strip()
    if not username:
        return None
    return Docente.objects.filter(persona__dni__iexact=username).first()


def _user_can_manage_mesa_planilla(request, mesa) -> bool:
    if can(request.user, "editar_estudiantes"):
        return True
    if "docente" in get_user_roles(request.user):
        docente = _resolve_docente_from_user(request.user)
        if not docente:
            return False
        # Solo el docente titular (presidente) de la mesa gestiona la planilla.
        # Los vocales integran el tribunal pero no cargan ni editan el acta.
        return mesa.docente_presidente_id is not None and docente.id == mesa.docente_presidente_id
    return False


def _user_can_view_mesa_planilla(request, mesa) -> bool:
    """
    Acceso de lectura a la planilla: el personal autorizado y CUALQUIER
    integrante del tribunal (presidente o vocales). Los vocales no cargan ni
    editan (eso lo controla _user_can_manage_mesa_planilla), pero sí pueden
    ver la planilla en modo solo lectura.
    """
    if can(request.user, "editar_estudiantes"):
        return True
    if "docente" in get_user_roles(request.user):
        docente = _resolve_docente_from_user(request.user)
        if not docente:
            return False
        return docente.id in (
            mesa.docente_presidente_id,
            mesa.docente_vocal1_id,
            mesa.docente_vocal2_id,
        )
    return False


def _user_can_override_planilla_lock(user) -> bool:
    return can(user, "gestionar_staff")
