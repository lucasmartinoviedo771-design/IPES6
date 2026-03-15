from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Prefetch, Q
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import MesaExamen, Materia, Docente, Profesorado
from core.permissions import ensure_profesorado_access, ensure_roles, allowed_profesorados
from ..router import management_router
from ..schemas import MesaIn, MesaOut, MesaDocenteOut

def _serialize_mesa(mesa: MesaExamen) -> MesaOut:
    m = mesa.materia
    p = m.plan_de_estudio
    docentes = []
    if mesa.docente_presidente:
        docentes.append(MesaDocenteOut(rol="Presidente", docente_id=mesa.docente_presidente_id, nombre=mesa.docente_presidente.persona.nombre_completo, dni=mesa.docente_presidente.persona.dni))
    if mesa.docente_vocal1:
        docentes.append(MesaDocenteOut(rol="Vocal 1", docente_id=mesa.docente_vocal1_id, nombre=mesa.docente_vocal1.persona.nombre_completo, dni=mesa.docente_vocal1.persona.dni))
    if mesa.docente_vocal2:
        docentes.append(MesaDocenteOut(rol="Vocal 2", docente_id=mesa.docente_vocal2_id, nombre=mesa.docente_vocal2.persona.nombre_completo, dni=mesa.docente_vocal2.persona.dni))

    return MesaOut(
        id=mesa.id,
        materia_id=mesa.materia_id,
        materia_nombre=m.nombre,
        profesorado_id=p.profesorado_id if p else None,
        profesorado_nombre=p.profesorado.nombre if p and p.profesorado else None,
        plan_id=m.plan_de_estudio_id,
        plan_resolucion=p.resolucion if p else None,
        anio_cursada=m.anio_cursada,
        regimen=m.regimen,
        tipo=mesa.tipo,
        modalidad=mesa.modalidad,
        fecha=mesa.fecha,
        hora_desde=str(mesa.hora_desde) if mesa.hora_desde else None,
        hora_hasta=str(mesa.hora_hasta) if mesa.hora_hasta else None,
        aula=mesa.aula,
        cupo=mesa.cupo or 0,
        codigo=mesa.codigo,
        docentes=docentes
    )

@management_router.get("/mesas", response=list[MesaOut], auth=JWTAuth())
def list_mesas(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    materia_id: int | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    tipo: str | None = None,
):
    ensure_roles(request.user, {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee", "consulta"})
    
    qs = MesaExamen.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "docente_presidente__persona",
        "docente_vocal1__persona",
        "docente_vocal2__persona",
    )
    
    allowed = allowed_profesorados(request.user)
    if allowed is not None:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id__in=allowed)

    if profesorado_id: qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if plan_id: qs = qs.filter(materia__plan_de_estudio_id=plan_id)
    if materia_id: qs = qs.filter(materia_id=materia_id)
    if desde: qs = qs.filter(fecha__gte=desde)
    if hasta: qs = qs.filter(fecha__lte=hasta)
    if tipo: qs = qs.filter(tipo=tipo.upper())

    qs = qs.order_by("fecha", "hora_desde")
    return [_serialize_mesa(m) for m in qs]

@management_router.post("/mesas", response=MesaOut, auth=JWTAuth())
def create_mesa(request, payload: MesaIn):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    materia = get_object_or_404(Materia, id=payload.materia_id)
    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)
    
    mesa = MesaExamen.objects.create(
        materia=materia,
        tipo=payload.tipo.upper(),
        modalidad=payload.modalidad.upper(),
        fecha=payload.fecha,
        hora_desde=payload.hora_desde,
        hora_hasta=payload.hora_hasta,
        aula=payload.aula,
        cupo=payload.cupo,
        ventana_id=payload.ventana_id,
        docente_presidente_id=payload.docente_presidente_id,
        docente_vocal1_id=payload.docente_vocal1_id,
        docente_vocal2_id=payload.docente_vocal2_id,
    )
    return _serialize_mesa(mesa)

@management_router.put("/mesas/{mesa_id}", response=MesaOut, auth=JWTAuth())
def update_mesa(request, mesa_id: int, payload: MesaIn):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    ensure_profesorado_access(request.user, mesa.materia.plan_de_estudio.profesorado_id)
    
    for attr, value in payload.dict().items():
        if value is not None:
            setattr(mesa, attr, value)
    mesa.save()
    return _serialize_mesa(mesa)

@management_router.delete("/mesas/{mesa_id}", response={204: None}, auth=JWTAuth())
def delete_mesa(request, mesa_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    ensure_profesorado_access(request.user, mesa.materia.plan_de_estudio.profesorado_id)
    mesa.delete()
    return 204, None
