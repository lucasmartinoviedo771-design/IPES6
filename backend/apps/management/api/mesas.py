from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Prefetch, Q, Count
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import MesaExamen, Materia, Docente, Profesorado
from core.permissions import ensure_profesorado_access, ensure_roles, allowed_profesorados
from apps.common.date_utils import calcular_limite_baja_mesa
from datetime import datetime
from ..router import management_router
from ..schemas import MesaIn, MesaOut, MesaDocenteOut

def _serialize_mesa(mesa: MesaExamen) -> MesaOut:
    m = mesa.materia
    p = m.plan_de_estudio
    docentes = []
    if mesa.docente_presidente:
        docentes.append(MesaDocenteOut(rol="Presidente", docente_id=mesa.docente_presidente_id, nombre=f"{mesa.docente_presidente.persona.apellido}, {mesa.docente_presidente.persona.nombre}", dni=mesa.docente_presidente.persona.dni))
    if mesa.docente_vocal1:
        docentes.append(MesaDocenteOut(rol="Vocal 1", docente_id=mesa.docente_vocal1_id, nombre=f"{mesa.docente_vocal1.persona.apellido}, {mesa.docente_vocal1.persona.nombre}", dni=mesa.docente_vocal1.persona.dni))
    if mesa.docente_vocal2:
        docentes.append(MesaDocenteOut(rol="Vocal 2", docente_id=mesa.docente_vocal2_id, nombre=f"{mesa.docente_vocal2.persona.apellido}, {mesa.docente_vocal2.persona.nombre}", dni=mesa.docente_vocal2.persona.dni))

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
        docentes=docentes,
        esta_cerrada=mesa.planilla_cerrada_en is not None,
        inscriptos_count=getattr(mesa, "num_inscriptos", 0)
    )

def _auto_cleanup_deserted_mesas():
    """
    Barrido automático de mesas sin alumnos inscriptos una vez vencido el plazo de baja (48hs hábiles).
    Esto evita que persistan mesas 'fantasmas' que no serán utilizadas.
    """
    ahora = datetime.now()
    # Solo procesamos mesas próximas (desde hace 7 días hasta el futuro)
    # para no sobrecargar el barrido con historial muy antiguo.
    from datetime import timedelta
    rango_fecha = ahora.date() - timedelta(days=7)
    
    # 1. Buscar mesas candidatas (sin inscritos o solo con cancelados)
    mesas_candidatas = MesaExamen.objects.filter(
        fecha__gte=rango_fecha
    ).annotate(
        count_inscriptos=Count('inscripciones', filter=Q(inscripciones__estado='INS'))
    ).filter(count_inscriptos=0)

    # 2. Verificar el plazo de 48hs hábiles para cada una
    deleted_count = 0
    for mesa in mesas_candidatas:
        limite = calcular_limite_baja_mesa(mesa.fecha)
        if ahora > limite:
            mesa.delete()
            deleted_count += 1
    
    if deleted_count > 0:
        import logging
        logging.getLogger(__name__).info(f"Cleanup: Se eliminaron {deleted_count} mesas desiertas automáticamente.")

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
    
    # Barrido automático antes de listar
    _auto_cleanup_deserted_mesas()

    qs = MesaExamen.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "docente_presidente__persona",
        "docente_vocal1__persona",
        "docente_vocal2__persona",
    ).annotate(
        num_inscriptos=Count('inscripciones', filter=Q(inscripciones__estado='INS'))
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
