from ninja import Router, Schema
from typing import List, Optional
from django.shortcuts import get_object_or_404
from core.models import Profesorado, PlanDeEstudio

carreras_router = Router(tags=["carreras"])

class ProfesoradoIn(Schema):
    nombre: str
    duracion_anios: int
    activo: bool = True
    inscripcion_abierta: bool = True

class ProfesoradoOut(Schema):
    id: int
    nombre: str
    duracion_anios: int
    activo: bool
    inscripcion_abierta: bool

# Schemas for PlanDeEstudio
class PlanDeEstudioIn(Schema):
    resolucion: str
    anio_inicio: int
    anio_fin: Optional[int] = None
    vigente: bool = True

class PlanDeEstudioOut(Schema):
    id: int
    profesorado_id: int
    resolucion: str
    anio_inicio: int
    anio_fin: Optional[int]
    vigente: bool

@carreras_router.get("/", response=List[ProfesoradoOut])
def listar_carreras(request, vigentes: Optional[bool] = None):
    qs = Profesorado.objects.all().order_by("nombre")
    if vigentes is not None:
        qs = qs.filter(activo=vigentes, inscripcion_abierta=vigentes)
    return qs

@carreras_router.get("/{profesorado_id}", response=ProfesoradoOut)
def get_profesorado(request, profesorado_id: int):
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    return profesorado

@carreras_router.post("/", response=ProfesoradoOut)
def crear_profesorado(request, payload: ProfesoradoIn):
    profesorado = Profesorado.objects.create(**payload.dict())
    return profesorado

@carreras_router.put("/{profesorado_id}", response=ProfesoradoOut)
def actualizar_profesorado(request, profesorado_id: int, payload: ProfesoradoIn):
    profesorado = Profesorado.objects.get(id=profesorado_id)
    for attr, value in payload.dict().items():
        setattr(profesorado, attr, value)
    profesorado.save()
    return profesorado

@carreras_router.delete("/{profesorado_id}", response={"success": bool})
def eliminar_profesorado(request, profesorado_id: int):
    profesorado = Profesorado.objects.get(id=profesorado_id)
    profesorado.delete()
    return {"success": True}

# PlanDeEstudio Endpoints
@carreras_router.get("/{profesorado_id}/planes", response=List[PlanDeEstudioOut])
def planes_por_profesorado(request, profesorado_id: int):
    qs = (PlanDeEstudio.objects
          .filter(profesorado_id=profesorado_id, vigente=True)
          .order_by("-anio_inicio", "id"))
    return list(qs)

@carreras_router.post("/{profesorado_id}/planes", response=PlanDeEstudioOut)
def create_plan_for_profesorado(request, profesorado_id: int, payload: PlanDeEstudioIn):
    profesorado = get_object_or_404(Profesorado, id=profesorado_id)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, **payload.dict())
    return plan

@carreras_router.get("/planes/{plan_id}", response=PlanDeEstudioOut)
def get_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    return plan

@carreras_router.put("/planes/{plan_id}", response=PlanDeEstudioOut)
def update_plan(request, plan_id: int, payload: PlanDeEstudioIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    for attr, value in payload.dict().items():
        setattr(plan, attr, value)
    plan.save()
    return plan

@carreras_router.delete("/planes/{plan_id}", response={204: None})
def delete_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    plan.vigente = False  # Soft delete
    plan.save()
    return 204, None
