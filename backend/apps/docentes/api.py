from django.contrib.auth.models import Group, User
from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from core.auth_ninja import JWTAuth
from core.models import Docente, Persona, Profesorado, StaffAsignacion
from core.permissions import (
    allowed_profesorados,
    ensure_profesorado_access,
    require,
)

from .schemas import DocenteIn, DocenteOut, DocenteRoleAssignIn, DocenteRoleAssignOut
from .services.docente_service import DocenteService

router = Router(tags=["Docentes"])

from .horarios_api import router as horarios_router
router.add_router("", horarios_router)


def _ensure_structure_view(user):
    require(user, "ver_estructura")


def _ensure_structure_edit(user):
    require(user, "editar_estructura")


@router.get("/", response=list[DocenteOut], auth=JWTAuth())
def list_docentes(request):
    _ensure_structure_view(request.user)
    docentes = (
        Docente.objects.select_related("persona")
        .exclude(
            Q(persona__dni__startswith="DOC-HIS-")
            | Q(persona__apellido__icontains="CARGA HISTÓRICA")
            | Q(persona__apellido__icontains="SISTEMA")
        )
        .order_by("persona__apellido", "persona__nombre")
    )
    return [DocenteService.serialize_docente(d) for d in docentes]


@router.post("/", response=DocenteOut, auth=JWTAuth())
def create_docente(request, payload: DocenteIn):
    _ensure_structure_edit(request.user)
    try:
        persona = Persona.objects.create(**payload.dict())
    except IntegrityError:
        existing = Persona.objects.filter(dni=payload.dni).first()
        if existing:
            has_docente = False
            try:
                existing.docente_perfil
                has_docente = True
            except Exception:
                pass

            if has_docente:
                raise HttpError(
                    409,
                    f"El DNI '{payload.dni}' ya está registrado como docente: {existing.apellido}, {existing.nombre}.",
                )

            # Es estudiante (u otro), pero no docente. Actualizamos y creamos el perfil.
            for attr, value in payload.dict().items():
                if hasattr(existing, attr):
                    setattr(existing, attr, value)
            existing.save()
            persona = existing
        else:
            raise HttpError(409, f"El DNI '{payload.dni}' ya está en uso.")
    docente = Docente.objects.create(persona=persona)
    return DocenteService.serialize_docente(docente)


@router.get("/{docente_id}", response=DocenteOut, auth=JWTAuth())
def get_docente(request, docente_id: int):
    _ensure_structure_view(request.user)
    docente = get_object_or_404(Docente, id=docente_id)
    return DocenteService.serialize_docente(docente)


@router.put("/{docente_id}", response=DocenteOut, auth=JWTAuth())
def update_docente(request, docente_id: int, payload: DocenteIn):
    _ensure_structure_edit(request.user)
    docente = get_object_or_404(Docente, id=docente_id)
    persona = docente.persona
    for attr, value in payload.dict().items():
        if hasattr(persona, attr):
            setattr(persona, attr, value)
    try:
        persona.save()
    except IntegrityError:
        existing = Persona.objects.filter(dni=payload.dni).first()
        if existing:
            parts = []
            try:
                existing.docente_perfil
                parts.append("docente")
            except Exception:
                pass
            try:
                existing.estudiante_perfil
                parts.append("estudiante")
            except Exception:
                pass
            quien = " y ".join(parts) if parts else "otra persona"
            raise HttpError(
                409, f"El DNI '{payload.dni}' ya está registrado como {quien}: {existing.apellido}, {existing.nombre}."
            )
        raise HttpError(409, f"El DNI '{payload.dni}' ya está en uso.")
    return DocenteService.serialize_docente(docente)


@router.delete("/{docente_id}", response={204: None}, auth=JWTAuth())
def delete_docente(request, docente_id: int):
    _ensure_structure_edit(request.user)
    docente = get_object_or_404(Docente, id=docente_id)
    docente.delete()
    return 204, None
