from django.shortcuts import get_object_or_404
from django.db.models import ProtectedError
from ninja import Router
from ninja.errors import HttpError
from django.contrib.auth.models import User

from core.auth_ninja import JWTAuth
from core.models import (
    PlanDeEstudio, 
    Profesorado, 
    Materia, 
    InscripcionMateriaEstudiante, 
    Comision,
    ProfesoradoRequisitoDocumentacion
)
from core.permissions import (
    ensure_profesorado_access, 
    ensure_roles, 
    allowed_profesorados,
    get_user_roles,
)
from apps.common.errors import AppError
from apps.common.constants import AppErrorCode

from .schemas import (
    ProfesoradoIn, 
    ProfesoradoOut, 
    PlanDeEstudioIn, 
    PlanDeEstudioOut, 
    MateriaIn, 
    MateriaOut, 
    RequisitoDocumentacionOut
)
from ninja import Schema

class MateriaInscriptoOut(Schema):
    id: int
    estudiante_id: int
    estudiante: str
    dni: str
    legajo: str | None = None
    estado: str
    anio: int
    comision_id: int | None = None
    comision_codigo: str | None = None

STRUCTURE_VIEW_ROLES = {
    "admin", "secretaria", "bedel", "coordinador", "tutor", 
    "jefes", "jefa_aaee", "consulta", "estudiante",
}
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}

def _require_view(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, STRUCTURE_VIEW_ROLES)
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)

def _require_edit(user, profesorado_id: int | None = None) -> None:
    ensure_roles(user, STRUCTURE_EDIT_ROLES)
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)

def _normalized_user_roles(user: User) -> set[str]:
    raw_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    roles = set(raw_names)
    for name in raw_names:
        if name.startswith("bedel"): roles.add("bedel")
        if name.startswith("secretaria"): roles.add("secretaria")
        if name.startswith("coordinador"): roles.add("coordinador")
        if "estudiante" in name: roles.add("estudiante")
        if "docente" in name: roles.add("docente")

    if user.is_superuser or user.is_staff:
        roles.add("admin")
    return roles

def _docente_from_user(user: User):
    return getattr(user, "docente_perfil", None)

profesorados_router = Router(tags=["Carreras"])
planes_router = Router(tags=["Planes de Estudio"])
materias_router = Router(tags=["Materias"])

# --- PROFESORADOS ---

@profesorados_router.get("/", response=list[ProfesoradoOut], auth=JWTAuth())
def listar_carreras(request, vigentes: bool | None = None):
    qs = Profesorado.objects.all().order_by("nombre")
    if getattr(request.user, "is_authenticated", False):
        _require_view(request.user)
        allowed = allowed_profesorados(request.user)
        if allowed is not None:
            qs = qs.filter(id__in=allowed)
            
    if vigentes is not None:
        qs = qs.filter(activo=vigentes, inscripcion_abierta=vigentes)
    return qs

@profesorados_router.get("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def get_profesorado(request, profesorado_id: int):
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    _require_view(request.user, profesorado.id)
    return profesorado

@profesorados_router.post("/", response=ProfesoradoOut, auth=JWTAuth())
def crear_profesorado(request, payload: ProfesoradoIn):
    _require_edit(request.user)
    profesorado = Profesorado.objects.create(**payload.dict())
    return profesorado

@profesorados_router.put("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def actualizar_profesorado(request, profesorado_id: int, payload: ProfesoradoIn):
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    for attr, value in payload.dict().items():
        setattr(profesorado, attr, value)
    profesorado.save()
    return profesorado

@profesorados_router.delete("/{profesorado_id}", response={200: dict, 400: dict}, auth=JWTAuth())
def eliminar_profesorado(request, profesorado_id: int):
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    try:
        profesorado.delete()
        return 200, {"success": True}
    except ProtectedError:
        raise HttpError(400, "No se puede eliminar el profesorado porque ya tiene datos asociados (planes, materias, alumnos, etc.)")
    except Exception as e:
        raise HttpError(400, f"Error al eliminar: {str(e)}")

@profesorados_router.get("/{profesorado_id}/planes", response=list[PlanDeEstudioOut], auth=JWTAuth())
def planes_por_profesorado(request, profesorado_id: int):
    _require_view(request.user, profesorado_id)
    qs = PlanDeEstudio.objects.filter(profesorado_id=profesorado_id, vigente=True).order_by("-anio_inicio", "id")
    return list(qs)

@profesorados_router.post("/{profesorado_id}/planes", response=PlanDeEstudioOut, auth=JWTAuth())
def create_plan_for_profesorado(request, profesorado_id: int, payload: PlanDeEstudioIn):
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, **payload.dict())
    return plan

@profesorados_router.get("/{profesorado_id}/requisitos-documentacion", response=list[RequisitoDocumentacionOut], auth=JWTAuth())
def listar_requisitos_documentacion(request, profesorado_id: int):
    _require_view(request.user, profesorado_id)
    qs = ProfesoradoRequisitoDocumentacion.objects.filter(profesorado_id=profesorado_id).order_by("orden")
    return list(qs)

# --- PLANES DE ESTUDIO ---

@planes_router.get("/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def get_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_view(request.user, plan.profesorado_id)
    return plan

@planes_router.put("/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def update_plan(request, plan_id: int, payload: PlanDeEstudioIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(plan, attr, value)
    plan.save()
    return plan

@planes_router.delete("/{plan_id}", response={204: None}, auth=JWTAuth())
def delete_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    plan.vigente = False  # Soft delete
    plan.save()
    return 204, None

@planes_router.get("/{plan_id}/materias", response=list[MateriaOut], auth=JWTAuth())
def list_materias_for_plan(
    request,
    plan_id: int,
    anio_cursada: int | None = None,
    nombre: str | None = None,
    formato: str | None = None,
    regimen: str | None = None,
    tipo_formacion: str | None = None,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_view(request.user, plan.profesorado_id)
    materias = plan.materias.all()

    if anio_cursada is not None: materias = materias.filter(anio_cursada=anio_cursada)
    if nombre: materias = materias.filter(nombre__icontains=nombre)
    if formato: materias = materias.filter(formato=formato)
    if regimen: materias = materias.filter(regimen=regimen)
    if tipo_formacion: materias = materias.filter(tipo_formacion=tipo_formacion)

    return materias

@planes_router.post("/{plan_id}/materias", response=MateriaOut, auth=JWTAuth())
def create_materia_for_plan(request, plan_id: int, payload: MateriaIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    if payload.plan_de_estudio_id != plan_id:
        raise HttpError(400, "plan_de_estudio_id in payload must match plan_id in URL")
    materia = Materia.objects.create(plan_de_estudio=plan, **payload.dict())
    return materia

# --- MATERIAS ---

@materias_router.get("/{materia_id}", response=MateriaOut, auth=JWTAuth())
def get_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)
    _require_view(request.user, materia.plan_de_estudio.profesorado_id)
    return materia

@materias_router.put("/{materia_id}", response=MateriaOut, auth=JWTAuth())
def update_materia(request, materia_id: int, payload: MateriaIn):
    materia = get_object_or_404(Materia, id=materia_id)
    _require_edit(request.user, materia.plan_de_estudio.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(materia, attr, value)
    materia.save()
    return materia

@materias_router.delete("/{materia_id}", response={204: None}, auth=JWTAuth())
def delete_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)
    _require_edit(request.user, materia.plan_de_estudio.profesorado_id)
    materia.delete()
    return 204, None

@materias_router.get("/{materia_id}/inscriptos", response=list[MateriaInscriptoOut], auth=JWTAuth())
def list_inscriptos_materia(request, materia_id: int, anio: int | None = None, estado: str | None = None):
    materia = get_object_or_404(Materia, id=materia_id)
    roles = get_user_roles(request.user)
    docente_profile = _docente_from_user(request.user)

    solo_docente = False
    if "docente" in roles and not (roles & STRUCTURE_VIEW_ROLES):
        if not docente_profile:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tienes perfil de docente asociado.")
        asignado = Comision.objects.filter(materia_id=materia_id, docente=docente_profile).exists()
        if not asignado:
            raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tienes comisiones asignadas a esta materia.")
        solo_docente = True
    else:
        _require_view(request.user, materia.plan_de_estudio.profesorado_id)

    inscripciones = InscripcionMateriaEstudiante.objects.select_related("estudiante__user", "estudiante__persona", "comision").filter(materia_id=materia_id)
    if solo_docente:
        inscripciones = inscripciones.filter(comision__docente=docente_profile)
    if anio is not None:
        inscripciones = inscripciones.filter(anio=anio)
    if estado:
        inscripciones = inscripciones.filter(estado=estado)

    resultado: list[MateriaInscriptoOut] = []
    for inscripcion in inscripciones.order_by("estudiante__persona__apellido", "estudiante__persona__nombre"):
        est = inscripcion.estudiante
        nombre = est.user.get_full_name() if est.user else est.dni
        resultado.append(MateriaInscriptoOut(
            id=inscripcion.id, estudiante_id=est.id, estudiante=nombre, dni=est.dni,
            legajo=est.legajo, estado=inscripcion.estado, anio=inscripcion.anio,
            comision_id=inscripcion.comision_id,
            comision_codigo=inscripcion.comision.codigo if inscripcion.comision_id else None,
        ))
    return resultado
