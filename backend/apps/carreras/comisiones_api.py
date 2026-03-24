"""
API para la gestión operativa de Comisiones y Cursadas.
Permite la creación, edición y generación masiva de comisiones para materias,
incluyendo la asignación de docentes, turnos y cupos por ciclo lectivo.
"""

import string
from django.shortcuts import get_object_or_404
from django.db import transaction
from ninja import Router
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.permissions import ensure_profesorado_access, ensure_roles, allowed_profesorados
from core.models import Comision, Materia, Turno, PlanDeEstudio
from .schemas import ComisionIn, ComisionOut, ComisionBulkGenerateIn

router = Router(tags=["Comisiones"])

# Roles autorizados para gestionar (crear/editar/borrar) comisiones
ACADEMIC_MANAGE_ROLES = {"admin", "secretaria", "bedel"}

# Roles autorizados solo para visualizar información de comisiones
ACADEMIC_VIEW_ROLES = {
    "admin", "secretaria", "bedel", "coordinador", "tutor", 
    "jefes", "jefa_aaee", "consulta"
}


def _require_manage(user):
    """Verifica si el usuario tiene permisos de gestión académica."""
    ensure_roles(user, ACADEMIC_MANAGE_ROLES)


def _require_view(user):
    """Verifica si el usuario tiene permisos de visualización académica."""
    ensure_roles(user, ACADEMIC_VIEW_ROLES)


def _serialize_comision(comision: Comision) -> ComisionOut:
    """Manual serializer para adaptar el modelo Comision al esquema de salida."""
    return ComisionOut(
        id=comision.id,
        materia_id=comision.materia_id,
        anio_lectivo=comision.anio_lectivo,
        codigo=comision.codigo,
        turno_id=comision.turno_id,
        docente_id=comision.docente_id,
        docente_nombre=str(comision.docente) if comision.docente else None,
        horario_id=comision.horario_id,
        cupo_maximo=comision.cupo_maximo,
        observaciones=comision.observaciones,
        estado=comision.estado,
        rol=comision.rol,
        orden=comision.orden
    )


def _restrict_comisiones_queryset(user, qs):
    """Filtra el queryset de comisiones según las carreras permitidas para el usuario."""
    allowed = allowed_profesorados(user)
    if allowed is not None:
        return qs.filter(materia__plan_de_estudio__profesorado_id__in=allowed)
    return qs


def _codigo_from_index(index: int) -> str:
    """
    Convierte un índice numérico en una codificación alfabética (A, B, C... Z, AA, AB...).
    Utilizado para identificar comisiones concurrentes de una misma materia.
    """
    letters = string.ascii_uppercase
    base = len(letters)
    result = ""
    i = index
    while True:
        result = letters[i % base] + result
        i = i // base - 1
        if i < 0:
            break
    return result


@router.get("/", response=list[ComisionOut], auth=JWTAuth())
def list_comisiones(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    materia_id: int | None = None,
    anio_lectivo: int | None = None,
    turno_id: int | None = None,
    estado: str | None = None,
    rol: str | None = None,
):
    """Lista las comisiones con filtros avanzados de carrera, plan, materia y ciclo lectivo."""
    _require_view(request.user)
    qs = Comision.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "turno",
        "docente",
    )
    qs = _restrict_comisiones_queryset(request.user, qs)

    if profesorado_id:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if plan_id:
        qs = qs.filter(materia__plan_de_estudio_id=plan_id)
    if materia_id:
        qs = qs.filter(materia_id=materia_id)
    if anio_lectivo:
        qs = qs.filter(anio_lectivo=anio_lectivo)
    if turno_id:
        qs = qs.filter(turno_id=turno_id)
        
    if estado:
        qs = qs.filter(estado=estado.upper())
    if rol:
        qs = qs.filter(rol=rol.upper())

    qs = qs.order_by("-anio_lectivo", "materia__nombre", "codigo")
    return [_serialize_comision(com) for com in qs]


@router.post("/", response=ComisionOut, auth=JWTAuth())
def create_comision(request, payload: ComisionIn):
    """Crea manualmente una comisión para una materia específica."""
    _require_manage(request.user)
    materia = get_object_or_404(Materia, id=payload.materia_id)
    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)
    
    estado = (payload.estado or Comision.Estado.ABIERTA).upper()
    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=payload.anio_lectivo,
        codigo=payload.codigo,
        turno_id=payload.turno_id,
        docente_id=payload.docente_id,
        horario_id=payload.horario_id,
        cupo_maximo=payload.cupo_maximo,
        estado=estado,
        rol=(payload.rol or Comision.Rol.TITULAR).upper(),
        orden=payload.orden or 1,
        observaciones=payload.observaciones or "",
    )
    return _serialize_comision(comision)


@router.put("/{comision_id}", response=ComisionOut, auth=JWTAuth())
def update_comision(request, comision_id: int, payload: ComisionIn):
    """Actualiza la configuración (docente, turno, cupo) de una comisión."""
    _require_manage(request.user)
    comision = get_object_or_404(Comision, id=comision_id)
    ensure_profesorado_access(request.user, comision.materia.plan_de_estudio.profesorado_id)
    
    for attr, value in payload.dict().items():
        if value is not None:
            setattr(comision, attr, value)
    comision.save()
    return _serialize_comision(comision)


@router.post("/generar", response=list[ComisionOut], auth=JWTAuth())
def bulk_generate_comisiones(request, payload: ComisionBulkGenerateIn):
    """
    Generación automática y masiva de comisiones para todo un plan de estudios.
    
    Flujo:
    1. Identifica todas las materias del plan.
    2. Crea N comisiones para cada materia (si no existen aún).
    3. Asigna códigos secuenciales (A, B, C...) y rota los turnos disponibles.
    """
    _require_manage(request.user)
    if payload.cantidad < 1:
        raise HttpError(400, "La cantidad de comisiones por materia debe ser al menos 1.")

    plan = get_object_or_404(PlanDeEstudio.objects.select_related("profesorado"), id=payload.plan_id)
    ensure_profesorado_access(request.user, plan.profesorado_id)

    materias = list(plan.materias.all().order_by("anio_cursada", "nombre"))
    if not materias:
        raise HttpError(400, "El plan seleccionado no posee materias registradas.")

    estado = (payload.estado or Comision.Estado.ABIERTA).upper()

    # Selección de turnos para rotación automática
    if payload.turnos:
        turnos = list(Turno.objects.filter(id__in=payload.turnos))
        if not turnos:
            raise HttpError(400, "No se encontraron los turnos especificados.")
    else:
        turnos = list(Turno.objects.all().order_by("id"))
        if not turnos:
            raise HttpError(400, "Debe existir al menos un turno cargado en el sistema.")

    created: list[Comision] = []
    with transaction.atomic():
        for materia in materias:
            # Auditamos códigos existentes para evitar duplicados en el mismo ciclo
            existing_codes = set(
                Comision.objects.filter(
                    materia=materia,
                    anio_lectivo=payload.anio_lectivo,
                ).values_list("codigo", flat=True)
            )

            existentes = len(existing_codes)
            if existentes >= payload.cantidad:
                continue

            faltantes = payload.cantidad - existentes
            code_index = 0
            nuevos_creados = 0

            # Generamos comisiones hasta alcanzar la cantidad deseada
            while nuevos_creados < faltantes:
                codigo = _codigo_from_index(code_index)
                code_index += 1
                if codigo in existing_codes:
                    continue

                existing_codes.add(codigo)
                # Rotación de turnos basada en la cantidad de comisiones
                turno = turnos[(existentes + nuevos_creados) % len(turnos)]
                
                comision = Comision.objects.create(
                    materia=materia,
                    anio_lectivo=payload.anio_lectivo,
                    codigo=codigo,
                    turno=turno,
                    estado=estado,
                    observaciones="",
                )
                created.append(comision)
                nuevos_creados += 1

    return [_serialize_comision(com) for com in created]


@router.delete("/{comision_id}", response={204: None}, auth=JWTAuth())
def delete_comision(request, comision_id: int):
    """Elimina una comisión. Precaución: puede afectar inscripciones existentes."""
    _require_manage(request.user)
    comision = get_object_or_404(Comision, id=comision_id)
    ensure_profesorado_access(request.user, comision.materia.plan_de_estudio.profesorado_id)
    comision.delete()
    return 204, None
