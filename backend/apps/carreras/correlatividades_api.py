from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Q
from ninja import Router
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import (
    PlanDeEstudio, 
    Materia, 
    Correlatividad, 
    CorrelatividadVersion, 
    CorrelatividadVersionDetalle
)
from core.permissions import ensure_profesorado_access, ensure_roles
from .schemas import (
    CorrelatividadSetIn, 
    CorrelatividadSetOut, 
    CorrelatividadVersionOut, 
    CorrelatividadVersionCreateIn, 
    CorrelatividadVersionUpdateIn,
    MateriaCorrelatividadRow
)

router = Router(tags=["Correlatividades"])

STRUCTURE_VIEW_ROLES = {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee", "consulta"}
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}

def _ensure_view(user, profesorado_id: int | None = None):
    ensure_roles(user, STRUCTURE_VIEW_ROLES)
    if profesorado_id: ensure_profesorado_access(user, profesorado_id)

def _ensure_edit(user, profesorado_id: int | None = None):
    ensure_roles(user, STRUCTURE_EDIT_ROLES)
    if profesorado_id: ensure_profesorado_access(user, profesorado_id)

def _to_set_out(qs) -> dict[str, list[int]]:
    out = {"regular_para_cursar": [], "aprobada_para_cursar": [], "aprobada_para_rendir": []}
    for c in qs:
        if c.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
            out["regular_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
            out["aprobada_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR:
            out["aprobada_para_rendir"].append(c.materia_correlativa_id)
    return out

def _version_to_schema(version: CorrelatividadVersion) -> CorrelatividadVersionOut:
    return CorrelatividadVersionOut(
        id=version.id,
        nombre=version.nombre,
        descripcion=version.descripcion or None,
        cohorte_desde=version.cohorte_desde,
        cohorte_hasta=version.cohorte_hasta,
        vigencia_desde=version.vigencia_desde.isoformat() if version.vigencia_desde else None,
        vigencia_hasta=version.vigencia_hasta.isoformat() if version.vigencia_hasta else None,
        activo=version.activo,
        correlatividades=version.detalles.count(),
        created_at=version.created_at.isoformat() if version.created_at else None,
        updated_at=version.updated_at.isoformat() if version.updated_at else None,
    )

def _validate_version_range(plan_id: int, cohorte_desde: int, cohorte_hasta: int | None, exclude_id: int | None = None, allow_autoclose: bool = False):
    if cohorte_hasta is not None and cohorte_hasta < cohorte_desde:
        raise HttpError(400, "El año final de cohorte debe ser mayor o igual al inicial.")
    qs = CorrelatividadVersion.objects.filter(plan_de_estudio_id=plan_id)
    if exclude_id: qs = qs.exclude(id=exclude_id)
    new_start = cohorte_desde
    new_end = cohorte_hasta if cohorte_hasta is not None else 9999
    for version in qs:
        existing_start = version.cohorte_desde
        existing_end = version.cohorte_hasta if version.cohorte_hasta is not None else 9999
        overlaps = not (new_end < existing_start or new_start > existing_end)
        if not overlaps: continue
        if allow_autoclose and existing_start < new_start <= existing_end: continue
        raise HttpError(400, f"El rango de cohortes se superpone con la versión '{version.nombre}'.")

def _autoclose_previous_versions(plan_id: int, new_cohorte_desde: int, exclude_id: int | None = None):
    overlaps = CorrelatividadVersion.objects.filter(plan_de_estudio_id=plan_id, cohorte_desde__lt=new_cohorte_desde)
    if exclude_id: overlaps = overlaps.exclude(id=exclude_id)
    overlaps = overlaps.filter(Q(cohorte_hasta__isnull=True) | Q(cohorte_hasta__gte=new_cohorte_desde))
    for version in overlaps:
        version.cohorte_hasta = new_cohorte_desde - 1
        version.save(update_fields=["cohorte_hasta", "updated_at"])

def _resolve_version_for_plan(*, plan: PlanDeEstudio, version_id: int | None = None, cohorte: int | None = None) -> CorrelatividadVersion | None:
    if version_id is not None:
        version = get_object_or_404(CorrelatividadVersion, id=version_id)
        if version.plan_de_estudio_id != plan.id: raise HttpError(400, "La versión seleccionada no pertenece al plan indicado.")
        return version
    if cohorte is not None:
        return CorrelatividadVersion.vigente_para(plan_id=plan.id, profesorado_id=plan.profesorado_id, cohorte=cohorte)
    return plan.correlatividad_versiones.order_by("-cohorte_desde").first()

@router.get("/planes/{plan_id}/correlatividades/versiones", response=list[CorrelatividadVersionOut], auth=JWTAuth())
def listar_versiones(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_view(request.user, plan.profesorado_id)
    versiones = plan.correlatividad_versiones.select_related("plan_de_estudio").order_by("cohorte_desde")
    return [_version_to_schema(v) for v in versiones]

@router.post("/planes/{plan_id}/correlatividades/versiones", response=CorrelatividadVersionOut, auth=JWTAuth())
def crear_version(request, plan_id: int, payload: CorrelatividadVersionCreateIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_edit(request.user, plan.profesorado_id)
    if not plan.profesorado_id: raise HttpError(400, "El plan seleccionado no está vinculado a un profesorado.")
    _validate_version_range(plan.id, payload.cohorte_desde, payload.cohorte_hasta, allow_autoclose=True)
    version = CorrelatividadVersion.objects.create(plan_de_estudio=plan, profesorado_id=plan.profesorado_id, **payload.dict(exclude={'duplicar_version_id'}))
    _autoclose_previous_versions(plan.id, version.cohorte_desde, exclude_id=version.id)
    if payload.duplicar_version_id:
        origen = get_object_or_404(CorrelatividadVersion, id=payload.duplicar_version_id)
        detalles = origen.detalles.all()
        CorrelatividadVersionDetalle.objects.bulk_create([CorrelatividadVersionDetalle(version=version, correlatividad=d.correlatividad) for d in detalles])
    return _version_to_schema(version)

@router.get("/materias/{materia_id}/correlatividades", response=CorrelatividadSetOut, auth=JWTAuth())
def get_correlatividades(request, materia_id: int, version_id: int | None = None, cohorte: int | None = None):
    materia = get_object_or_404(Materia, id=materia_id)
    _ensure_view(request.user, materia.plan_de_estudio.profesorado_id)
    version = _resolve_version_for_plan(plan=materia.plan_de_estudio, version_id=version_id, cohorte=cohorte)
    qs = Correlatividad.objects.filter(materia_origen=materia)
    if version: qs = qs.filter(versiones__version=version)
    return _to_set_out(qs)

@router.put("/correlatividades/versiones/{version_id}", response=CorrelatividadVersionOut, auth=JWTAuth())
def actualizar_version(request, version_id: int, payload: CorrelatividadVersionUpdateIn):
    version = get_object_or_404(CorrelatividadVersion, id=version_id)
    plan = version.plan_de_estudio
    _ensure_edit(request.user, plan.profesorado_id)
    _validate_version_range(plan.id, payload.cohorte_desde, payload.cohorte_hasta, exclude_id=version.id, allow_autoclose=True)
    for attr, value in payload.dict().items():
        setattr(version, attr, value)
    version.save()
    _autoclose_previous_versions(plan.id, version.cohorte_desde, exclude_id=version.id)
    return _version_to_schema(version)

@router.post("/materias/{materia_id}/correlatividades", response=CorrelatividadSetOut, auth=JWTAuth())
def set_correlatividades(request, materia_id: int, payload: CorrelatividadSetIn, version_id: int | None = None):
    materia = get_object_or_404(Materia, id=materia_id)
    _ensure_edit(request.user, materia.plan_de_estudio.profesorado_id)
    version = _resolve_version_for_plan(plan=materia.plan_de_estudio, version_id=version_id)

    all_ids = set(payload.regular_para_cursar + payload.aprobada_para_cursar + payload.aprobada_para_rendir)
    if all_ids:
        count = Materia.objects.filter(id__in=all_ids, plan_de_estudio=materia.plan_de_estudio).count()
        if count != len(all_ids): raise HttpError(400, "Todas las materias correlativas deben pertenecer al mismo plan de estudio.")

    with transaction.atomic():
        if version:
            return _set_correlatividades_for_version(materia, version, payload)
        
        Correlatividad.objects.filter(materia_origen=materia).delete()
        for tipo, ids in [
            (Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, payload.regular_para_cursar),
            (Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, payload.aprobada_para_cursar),
            (Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, payload.aprobada_para_rendir),
        ]:
            if ids:
                Correlatividad.objects.bulk_create([Correlatividad(materia_origen_id=materia.id, materia_correlativa_id=mid, tipo=tipo) for mid in ids])
    
    qs = Correlatividad.objects.filter(materia_origen=materia)
    return _to_set_out(qs)

def _set_correlatividades_for_version(materia, version, payload):
    # Lógica de sincronización de versiones (simplificada para el ejemplo, pero siguiendo la original)
    desired = set()
    for tipo, ids in [
        (Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, payload.regular_para_cursar),
        (Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, payload.aprobada_para_cursar),
        (Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, payload.aprobada_para_rendir),
    ]:
        for mid in ids: desired.add((tipo, mid))

    existing_details = CorrelatividadVersionDetalle.objects.filter(version=version, correlatividad__materia_origen=materia).select_related("correlatividad")
    for detalle in existing_details:
        key = (detalle.correlatividad.tipo, detalle.correlatividad.materia_correlativa_id)
        if key not in desired:
            corr = detalle.correlatividad
            detalle.delete()
            if not corr.versiones.exists(): corr.delete()

    for tipo, mid in desired:
        corr, _ = Correlatividad.objects.get_or_create(materia_origen=materia, materia_correlativa_id=mid, tipo=tipo)
        CorrelatividadVersionDetalle.objects.get_or_create(version=version, correlatividad=corr)

    return _to_set_out(Correlatividad.objects.filter(materia_origen=materia, versiones__version=version))

@router.get("/planes/{plan_id}/correlatividades_matrix", response=list[MateriaCorrelatividadRow], auth=JWTAuth())
def correlatividades_matrix(request, plan_id: int, version_id: int | None = None, cohorte: int | None = None):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_view(request.user, plan.profesorado_id)
    materias = plan.materias.all().order_by("anio_cursada", "nombre")
    version = _resolve_version_for_plan(plan=plan, version_id=version_id, cohorte=cohorte)
    
    from .schemas import MateriaCorrelatividadRow # schema
    rows = []
    for m in materias:
        qs = Correlatividad.objects.filter(materia_origen=m)
        if version: qs = qs.filter(versiones__version=version)
        v = _to_set_out(qs)
        rows.append(MateriaCorrelatividadRow(
            id=m.id, nombre=m.nombre, anio_cursada=m.anio_cursada,
            regimen=m.regimen, formato=m.formato,
            regular_para_cursar=v["regular_para_cursar"],
            aprobada_para_cursar=v["aprobada_para_cursar"],
            aprobada_para_rendir=v["aprobada_para_rendir"]
        ))
    return rows
