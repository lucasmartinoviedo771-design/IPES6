"""Helpers relacionados con usuarios, roles y resolución de estudiantes/docentes."""

from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q

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
    full_name = (user.get_full_name() or "").strip()
    if full_name:
        return full_name
    username = getattr(user, "username", None)
    if username:
        return username
    return None


def _resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
    if dni:
        return Estudiante.objects.filter(persona__dni=dni).first()
    if isinstance(request.user, AnonymousUser):
        return None
    return getattr(request.user, "estudiante", None)


def _ensure_estudiante_access(request, dni: str | None) -> None:
    if not dni:
        return
    solicitante = getattr(request.user, "estudiante", None)
    if solicitante and solicitante.dni != dni:
        require(request.user, "ver_estudiantes")


def _resolve_docente_from_user(user) -> Docente | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    lookup = Q()
    username = (getattr(user, "username", "") or "").strip()
    email = (getattr(user, "email", "") or "").strip()
    if username:
        lookup |= Q(persona__dni__iexact=username)
    if email:
        lookup |= Q(persona__email__iexact=email)
    if not lookup:
        return None
    return Docente.objects.filter(lookup).first()


def _user_can_manage_mesa_planilla(request, mesa) -> bool:
    if can(request.user, "editar_estudiantes"):
        return True
    if "docente" in get_user_roles(request.user):
        docente = _resolve_docente_from_user(request.user)
        if not docente:
            return False
        tribunal_ids = {
            mesa.docente_presidente_id,
            mesa.docente_vocal1_id,
            mesa.docente_vocal2_id,
        }
        return docente.id in tribunal_ids
    return False


def _user_can_override_planilla_lock(user) -> bool:
    return can(user, "gestionar_staff")
