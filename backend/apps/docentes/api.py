from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User, Group
from django.db.models import Q
from django.db import IntegrityError
from ninja import Router
from ninja.errors import HttpError

from core.auth_ninja import JWTAuth
from core.models import Docente, StaffAsignacion, Profesorado
from core.permissions import ensure_roles, ensure_profesorado_access, allowed_profesorados, STRUCTURE_VIEW_ROLES, STRUCTURE_EDIT_ROLES
from .schemas import DocenteIn, DocenteOut, DocenteRoleAssignIn, DocenteRoleAssignOut
from .services.docente_service import DocenteService

router = Router(tags=["Docentes"])

def _ensure_structure_view(user):
    ensure_roles(user, STRUCTURE_VIEW_ROLES)

def _ensure_structure_edit(user):
    ensure_roles(user, STRUCTURE_EDIT_ROLES)

@router.get("/", response=list[DocenteOut], auth=JWTAuth())
def list_docentes(request):
    _ensure_structure_view(request.user)
    docentes = Docente.objects.select_related("persona").exclude(
        Q(persona__dni__startswith="DOC-HIS-") |
        Q(persona__apellido__icontains="CARGA HISTÓRICA") |
        Q(persona__apellido__icontains="SISTEMA")
    ).order_by("persona__apellido", "persona__nombre")
    return [DocenteService.serialize_docente(d) for d in docentes]

@router.post("/", response=DocenteOut, auth=JWTAuth())
def create_docente(request, payload: DocenteIn):
    _ensure_structure_edit(request.user)
    docente = Docente.objects.create(**payload.dict())
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
        raise HttpError(409, f"El DNI '{payload.dni}' ya está registrado en otro docente.")
    return DocenteService.serialize_docente(docente)

@router.delete("/{docente_id}", response={204: None}, auth=JWTAuth())
def delete_docente(request, docente_id: int):
    _ensure_structure_edit(request.user)
    docente = get_object_or_404(Docente, id=docente_id)
    docente.delete()
    return 204, None
