from django.shortcuts import get_object_or_404
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import VentanaHabilitacion
from core.permissions import ensure_roles
from ..router import management_router
from ..schemas import VentanaIn, VentanaOut

VENTANA_GESTION_ROLES = {"admin", "secretaria", "jefa_aaee"}

@management_router.get("/ventanas", response=list[VentanaOut], auth=JWTAuth())
def list_ventanas(request, tipo: str | None = None):
    ensure_roles(request.user, {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee", "consulta", "estudiante"})
    qs = VentanaHabilitacion.objects.all()
    if tipo: qs = qs.filter(tipo=tipo)
    return qs.order_by("-desde", "-created_at")

@management_router.post("/ventanas", response=VentanaOut, auth=JWTAuth())
def create_ventana(request, payload: VentanaIn):
    ensure_roles(request.user, VENTANA_GESTION_ROLES)
    return VentanaHabilitacion.objects.create(**payload.dict())

@management_router.put("/ventanas/{ventana_id}", response=VentanaOut, auth=JWTAuth())
def update_ventana(request, ventana_id: int, payload: VentanaIn):
    ensure_roles(request.user, VENTANA_GESTION_ROLES)
    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    for attr, value in payload.dict().items():
        setattr(obj, attr, value)
    obj.save()
    return obj

@management_router.delete("/ventanas/{ventana_id}", response={204: None}, auth=JWTAuth())
def delete_ventana(request, ventana_id: int):
    ensure_roles(request.user, VENTANA_GESTION_ROLES)
    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    obj.delete()
    return 204, None
