
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from core.auth_ninja import JWTAuth
from core.models import PlanDeEstudio, Profesorado
from core.permissions import ensure_profesorado_access, ensure_roles

STRUCTURE_VIEW_ROLES = {
    "admin",
    "secretaria",
    "bedel",
    "coordinador",
    "tutor",
    "jefes",
    "jefa_aaee",
    "consulta",
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


carreras_router = Router(tags=["carreras"])


class ProfesoradoIn(Schema):
    nombre: str
    duracion_anios: int
    activo: bool = True
    inscripcion_abierta: bool = True
    es_certificacion_docente: bool = False


class ProfesoradoOut(Schema):
    id: int
    nombre: str
    duracion_anios: int
    activo: bool
    inscripcion_abierta: bool
    es_certificacion_docente: bool


# Schemas for PlanDeEstudio
class PlanDeEstudioIn(Schema):
    resolucion: str
    anio_inicio: int
    anio_fin: int | None = None
    vigente: bool = True


class PlanDeEstudioOut(Schema):
    id: int
    profesorado_id: int
    resolucion: str
    anio_inicio: int
    anio_fin: int | None
    vigente: bool


class RequisitoDocumentacionOut(Schema):
    id: int
    codigo: str
    titulo: str
    descripcion: str
    categoria: str
    obligatorio: bool
    orden: int
    activo: bool


@carreras_router.get("/", response=list[ProfesoradoOut])
def listar_carreras(request, vigentes: bool | None = None):
    if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False):
        _require_view(request.user)
    qs = Profesorado.objects.all().order_by("nombre")
    if vigentes is not None:
        qs = qs.filter(activo=vigentes, inscripcion_abierta=vigentes)
    return qs


@carreras_router.get("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def get_profesorado(request, profesorado_id: int):
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    if getattr(request.user, "is_authenticated", False):
        _require_view(request.user, profesorado.id)
    return profesorado


@carreras_router.post("/", response=ProfesoradoOut, auth=JWTAuth())
def crear_profesorado(request, payload: ProfesoradoIn):
    _require_edit(request.user)
    profesorado = Profesorado.objects.create(**payload.dict())
    return profesorado


@carreras_router.put("/{profesorado_id}", response=ProfesoradoOut, auth=JWTAuth())
def actualizar_profesorado(request, profesorado_id: int, payload: ProfesoradoIn):
    _require_edit(request.user, profesorado_id)
    profesorado = Profesorado.objects.get(id=profesorado_id)
    for attr, value in payload.dict().items():
        setattr(profesorado, attr, value)
    profesorado.save()
    return profesorado


@carreras_router.delete("/{profesorado_id}", response={"success": bool}, auth=JWTAuth())
def eliminar_profesorado(request, profesorado_id: int):
    _require_edit(request.user, profesorado_id)
    profesorado = Profesorado.objects.get(id=profesorado_id)
    profesorado.delete()
    return {"success": True}


# PlanDeEstudio Endpoints
@carreras_router.get("/{profesorado_id}/planes", response=list[PlanDeEstudioOut], auth=JWTAuth())
def planes_por_profesorado(request, profesorado_id: int):
    if getattr(request.user, "is_authenticated", False):
        _require_view(request.user, profesorado_id)
    qs = PlanDeEstudio.objects.filter(profesorado_id=profesorado_id, vigente=True).order_by("-anio_inicio", "id")
    return list(qs)


@carreras_router.post("/{profesorado_id}/planes", response=PlanDeEstudioOut, auth=JWTAuth())
def create_plan_for_profesorado(request, profesorado_id: int, payload: PlanDeEstudioIn):
    _require_edit(request.user, profesorado_id)
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, **payload.dict())
    return plan


@carreras_router.get("/planes/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def get_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    if getattr(request.user, "is_authenticated", False):
        _require_view(request.user, plan.profesorado_id)
    return plan


@carreras_router.put("/planes/{plan_id}", response=PlanDeEstudioOut, auth=JWTAuth())
def update_plan(request, plan_id: int, payload: PlanDeEstudioIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(plan, attr, value)
    plan.save()
    return plan


@carreras_router.delete("/planes/{plan_id}", response={204: None}, auth=JWTAuth())
def delete_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _require_edit(request.user, plan.profesorado_id)
    plan.vigente = False  # Soft delete
    plan.save()
    return 204, None


@carreras_router.get("/{profesorado_id}/requisitos-documentacion", response=list[RequisitoDocumentacionOut], auth=JWTAuth())
def listar_requisitos_documentacion(request, profesorado_id: int):
    _require_view(request.user, profesorado_id)
    from core.models import ProfesoradoRequisitoDocumentacion
    qs = ProfesoradoRequisitoDocumentacion.objects.filter(profesorado_id=profesorado_id).order_by("orden")
    return list(qs)
