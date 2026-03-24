"""
API para la gestión de Correlatividades y Trayectorias Curriculares.
Implementa un sistema de versionado de reglas de correlatividad por cohorte,
permitiendo que diferentes grupos de alumnos (según su año de ingreso) 
tengan requisitos de cursada o finales distintos dentro del mismo plan.
"""

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

# Roles autorizados para visualizar la estructura de correlatividades
STRUCTURE_VIEW_ROLES = {
    "admin", "secretaria", "bedel", "coordinador", "tutor", 
    "jefes", "jefa_aaee", "consulta"
}

# Roles autorizados para modificar las reglas curriculares (Diseño Curricular)
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}


def _ensure_view(user, profesorado_id: int | None = None):
    """Garantiza permisos de lectura para ver la matriz de correlatividades."""
    ensure_roles(user, STRUCTURE_VIEW_ROLES)
    if profesorado_id:
        ensure_profesorado_access(user, profesorado_id)


def _ensure_edit(user, profesorado_id: int | None = None):
    """Garantiza permisos de edición para modificar versiones o reglas."""
    ensure_roles(user, STRUCTURE_EDIT_ROLES)
    if profesorado_id:
        ensure_profesorado_access(user, profesorado_id)


def _to_set_out(qs) -> dict[str, list[int]]:
    """Transforma un queryset de correlatividades en un diccionario categorizado por tipo."""
    out = {
        "regular_para_cursar": [], 
        "aprobada_para_cursar": [], 
        "aprobada_para_rendir": []
    }
    for c in qs:
        if c.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
            out["regular_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
            out["aprobada_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR:
            out["aprobada_para_rendir"].append(c.materia_correlativa_id)
    return out


def _version_to_schema(version: CorrelatividadVersion) -> CorrelatividadVersionOut:
    """Serializa una versión de correlatividad a su esquema de salida JSON."""
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
    """
    Valida que los rangos de cohortes no se solapen con versiones existentes.
    Previene inconsistencias donde una cohorte tenga múltiples definiciones de correlatividad.
    """
    if cohorte_hasta is not None and cohorte_hasta < cohorte_desde:
        raise HttpError(400, "El año final de cohorte debe ser mayor o igual al inicial.")
        
    qs = CorrelatividadVersion.objects.filter(plan_de_estudio_id=plan_id)
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
        
    new_start = cohorte_desde
    new_end = cohorte_hasta if cohorte_hasta is not None else 9999
    
    for version in qs:
        existing_start = version.cohorte_desde
        existing_end = version.cohorte_hasta if version.cohorte_hasta is not None else 9999
        overlaps = not (new_end < existing_start or new_start > existing_end)
        
        if not overlaps:
            continue
        # Si se permite autoclose, ignoramos el solapamiento que será resuelto posteriormente
        if allow_autoclose and existing_start < new_start <= existing_end:
            continue
            
        raise HttpError(400, f"El rango de cohortes se superpone con la versión '{version.nombre}'.")


def _autoclose_previous_versions(plan_id: int, new_cohorte_desde: int, exclude_id: int | None = None):
    """Cierra automáticamente versiones anteriores si una nueva versión las 'pisa' en tiempo."""
    overlaps = CorrelatividadVersion.objects.filter(
        plan_de_estudio_id=plan_id, 
        cohorte_desde__lt=new_cohorte_desde
    )
    if exclude_id:
        overlaps = overlaps.exclude(id=exclude_id)
        
    # Versiones abiertas o con fin posterior a la nueva fecha de inicio
    overlaps = overlaps.filter(Q(cohorte_hasta__isnull=True) | Q(cohorte_hasta__gte=new_cohorte_desde))
    
    for version in overlaps:
        version.cohorte_hasta = new_cohorte_desde - 1
        version.save(update_fields=["cohorte_hasta", "updated_at"])


def _resolve_version_for_plan(*, plan: PlanDeEstudio, version_id: int | None = None, cohorte: int | None = None) -> CorrelatividadVersion | None:
    """Busca la versión de correlatividad aplicable según ID explícito, año de cohorte o vigencia actual."""
    if version_id is not None:
        version = get_object_or_404(CorrelatividadVersion, id=version_id)
        if version.plan_de_estudio_id != plan.id:
            raise HttpError(400, "La versión seleccionada no pertenece al plan indicado.")
        return version
        
    if cohorte is not None:
        return CorrelatividadVersion.vigente_para(
            plan_id=plan.id, 
            profesorado_id=plan.profesorado_id, 
            cohorte=cohorte
        )
    # Por defecto, retornar la más reciente
    return plan.correlatividad_versiones.order_by("-cohorte_desde").first()


@router.get("/planes/{plan_id}/correlatividades/versiones", response=list[CorrelatividadVersionOut], auth=JWTAuth())
def listar_versiones(request, plan_id: int):
    """Lista las versiones históricas y vigentes de las reglas de correlatividad de un plan."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_view(request.user, plan.profesorado_id)
    versiones = plan.correlatividad_versiones.select_related("plan_de_estudio").order_by("cohorte_desde")
    return [_version_to_schema(v) for v in versiones]


@router.post("/planes/{plan_id}/correlatividades/versiones", response=CorrelatividadVersionOut, auth=JWTAuth())
def crear_version(request, plan_id: int, payload: CorrelatividadVersionCreateIn):
    """Crea una nueva versión de reglas, permitiendo duplicar las existentes para facilitar cambios menores."""
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_edit(request.user, plan.profesorado_id)
    
    if not plan.profesorado_id:
        raise HttpError(400, "El plan seleccionado no está vinculado a una carrera activa.")
        
    _validate_version_range(plan.id, payload.cohorte_desde, payload.cohorte_hasta, allow_autoclose=True)
    
    version = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan, 
        profesorado_id=plan.profesorado_id, 
        **payload.dict(exclude={'duplicar_version_id'})
    )
    
    # Cierre automático de vigencia del periodo anterior
    _autoclose_previous_versions(plan.id, version.cohorte_desde, exclude_id=version.id)
    
    # Lógica de clonación (duplicación de reglas para el nuevo periodo)
    if payload.duplicar_version_id:
        origen = get_object_or_404(CorrelatividadVersion, id=payload.duplicar_version_id)
        detalles = origen.detalles.all()
        CorrelatividadVersionDetalle.objects.bulk_create([
            CorrelatividadVersionDetalle(version=version, correlatividad=d.correlatividad) 
            for d in detalles
        ])
        
    return _version_to_schema(version)


@router.get("/materias/{materia_id}/correlatividades", response=CorrelatividadSetOut, auth=JWTAuth())
def get_correlatividades(request, materia_id: int, version_id: int | None = None, cohorte: int | None = None):
    """Recupera el conjunto de correlatividades de una materia para una versión o cohorte específica."""
    materia = get_object_or_404(Materia, id=materia_id)
    _ensure_view(request.user, materia.plan_de_estudio.profesorado_id)
    
    version = _resolve_version_for_plan(plan=materia.plan_de_estudio, version_id=version_id, cohorte=cohorte)
    qs = Correlatividad.objects.filter(materia_origen=materia)
    
    if version:
        qs = qs.filter(versiones__version=version)
        
    return _to_set_out(qs)


@router.put("/correlatividades/versiones/{version_id}", response=CorrelatividadVersionOut, auth=JWTAuth())
def actualizar_version(request, version_id: int, payload: CorrelatividadVersionUpdateIn):
    """Actualiza metadatos o periodos de vigencia de una versión existente."""
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
    """
    Define o actualiza las correlatividades de una materia.
    Si se indica version_id, los cambios solo afectan a esa versión específica.
    """
    materia = get_object_or_404(Materia, id=materia_id)
    _ensure_edit(request.user, materia.plan_de_estudio.profesorado_id)
    
    version = _resolve_version_for_plan(plan=materia.plan_de_estudio, version_id=version_id)

    # Validación de perímetro (materias correlativas deben ser del mismo plan)
    all_ids = set(payload.regular_para_cursar + payload.aprobada_para_cursar + payload.aprobada_para_rendir)
    if all_ids:
        count = Materia.objects.filter(id__in=all_ids, plan_de_estudio=materia.plan_de_estudio).count()
        if count != len(all_ids):
            raise HttpError(400, "Inconsistencia: se intentó vincular materias de distintos planes.")

    with transaction.atomic():
        if version:
            return _set_correlatividades_for_version(materia, version, payload)
        
        # Modo 'Legacy' (sin versionado): Borrado y recreación masiva
        Correlatividad.objects.filter(materia_origen=materia).delete()
        for tipo, ids in [
            (Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, payload.regular_para_cursar),
            (Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, payload.aprobada_para_cursar),
            (Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, payload.aprobada_para_rendir),
        ]:
            if ids:
                Correlatividad.objects.bulk_create([
                    Correlatividad(materia_origen_id=materia.id, materia_correlativa_id=mid, tipo=tipo) 
                    for mid in ids
                ])
    
    qs = Correlatividad.objects.filter(materia_origen=materia)
    return _to_set_out(qs)


def _set_correlatividades_for_version(materia, version, payload):
    """Sincroniza el set de correlatividades para una versión específica eliminando lo obsoleto."""
    desired = set()
    for tipo, ids in [
        (Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, payload.regular_para_cursar),
        (Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, payload.aprobada_para_cursar),
        (Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, payload.aprobada_para_rendir),
    ]:
        for mid in ids: 
            desired.add((tipo, mid))

    # Limpieza de desvinculaciones
    existing_details = CorrelatividadVersionDetalle.objects.filter(
        version=version, 
        correlatividad__materia_origen=materia
    ).select_related("correlatividad")
    
    for detalle in existing_details:
        key = (detalle.correlatividad.tipo, detalle.correlatividad.materia_correlativa_id)
        if key not in desired:
            corr = detalle.correlatividad
            detalle.delete()
            # Si la regla de correlatividad ya no es usada por ninguna versión, borrar el objeto base
            if not corr.versiones.exists(): 
                corr.delete()

    # Alta de nuevas vinculaciones
    for tipo, mid in desired:
        corr, _ = Correlatividad.objects.get_or_create(materia_origen=materia, materia_correlativa_id=mid, tipo=tipo)
        CorrelatividadVersionDetalle.objects.get_or_create(version=version, correlatividad=corr)

    return _to_set_out(Correlatividad.objects.filter(materia_origen=materia, versiones__version=version))


@router.get("/planes/{plan_id}/correlatividades_matrix", response=list[MateriaCorrelatividadRow], auth=JWTAuth())
def correlatividades_matrix(request, plan_id: int, version_id: int | None = None, cohorte: int | None = None):
    """
    Genera la matriz curricular completa del plan para una versión o cohorte.
    Retorna cada materia con su lista de requisitos, ideal para visualización de grafos o tablas.
    """
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    _ensure_view(request.user, plan.profesorado_id)
    
    materias = plan.materias.all().order_by("anio_cursada", "nombre")
    version = _resolve_version_for_plan(plan=plan, version_id=version_id, cohorte=cohorte)
    
    rows = []
    for m in materias:
        qs = Correlatividad.objects.filter(materia_origen=m)
        if version: 
            qs = qs.filter(versiones__version=version)
            
        v = _to_set_out(qs)
        rows.append(MateriaCorrelatividadRow(
            id=m.id, 
            nombre=m.nombre, 
            anio_cursada=m.anio_cursada,
            regimen=m.regimen, 
            formato=m.formato,
            regular_para_cursar=v["regular_para_cursar"],
            aprobada_para_cursar=v["aprobada_para_cursar"],
            aprobada_para_rendir=v["aprobada_para_rendir"]
        ))
    return rows
