from ninja import Router, Schema
from typing import List, Optional, Dict
from django.shortcuts import get_object_or_404
from core.models import Profesorado, PlanDeEstudio, Materia, Docente, Turno, Bloque, HorarioCatedra, HorarioCatedraDetalle, Comision, VentanaHabilitacion, Correlatividad, MesaExamen
from ninja.errors import HttpError
from datetime import time, date
from django.db.models import Case, When, Value, CharField, F, Q
from django.db import transaction
from apps.common.api_schemas import ApiResponse
import string

router = Router()


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

@router.get("/planes/{plan_id}", response=PlanDeEstudioOut)

def get_plan(request, plan_id: int):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    return plan

# Schemas for Materia
class MateriaIn(Schema):
    plan_de_estudio_id: int
    anio_cursada: int
    nombre: str
    horas_semana: int # Changed from carga_horaria_semanal
    formato: str
    regimen: str # Changed from tipo_cursada

def _compatible_cuatrimestres(valor: str | None):
    """
    Devuelve el conjunto de valores de cuatrimestre/regimen que deben considerarse
    compatibles para detectar superposiciones.

    - ANUAL se superpone con todo (ANU, 1C, 2C)
    - 1C se cruza solo con ANUAL y 1C
    - 2C se cruza solo con ANUAL y 2C
    - None (no especificado) se asume como anual.
    """
    v = (valor or 'ANU').upper()
    if v == 'ANU':
        return ['ANU', 'PCU', 'SCU', None]
    if v == 'PCU' or v == '1C':
        return ['ANU', 'PCU', '1C', None]
    if v == 'SCU' or v == '2C':
        return ['ANU', 'SCU', '2C', None]
    return ['ANU', v, None]


class MateriaOut(Schema):
    id: int
    plan_de_estudio_id: int
    anio_cursada: int
    nombre: str
    horas_semana: int # Changed from carga_horaria_semanal
    formato: str
    regimen: str # Changed from tipo_cursada

# Materia Endpoints
@router.get("/planes/{plan_id}/materias", response=List[MateriaOut])
def list_materias_for_plan(
    request,
    plan_id: int,
    anio_cursada: Optional[int] = None,
    nombre: Optional[str] = None,
    formato: Optional[str] = None,
    regimen: Optional[str] = None,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    materias = plan.materias.all()

    if anio_cursada is not None:
        materias = materias.filter(anio_cursada=anio_cursada)
    if nombre is not None:
        materias = materias.filter(nombre__icontains=nombre) # Case-insensitive contains
    if formato is not None:
        materias = materias.filter(formato=formato)
    if regimen is not None:
        materias = materias.filter(regimen=regimen)

    return materias

@router.post("/planes/{plan_id}/materias", response=MateriaOut)
def create_materia_for_plan(request, plan_id: int, payload: MateriaIn):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    # Ensure the materia is associated with the correct plan_id from the URL
    if payload.plan_de_estudio_id != plan_id:
        raise HttpError(400, "plan_de_estudio_id in payload must match plan_id in URL")
    materia = Materia.objects.create(plan_de_estudio=plan, **payload.dict())
    return materia

@router.get("/materias/{materia_id}", response=MateriaOut)
def get_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)
    return materia

@router.put("/materias/{materia_id}", response=MateriaOut)
def update_materia(request, materia_id: int, payload: MateriaIn):
    materia = get_object_or_404(Materia, id=materia_id)
    for attr, value in payload.dict().items():
        setattr(materia, attr, value)
    materia.save()
    return materia

@router.delete("/materias/{materia_id}", response={204: None})
def delete_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)
    materia.delete()
    return 204, None

# Schemas for Docente
class DocenteIn(Schema):
    nombre: str
    apellido: str
    dni: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    cuil: Optional[str] = None

class DocenteOut(Schema):
    id: int
    nombre: str
    apellido: str
    dni: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    cuil: Optional[str] = None

# Schemas for Turno
class TurnoIn(Schema):
    nombre: str

class TurnoOut(Schema):
    id: int
    nombre: str

# Schemas for Bloque
class BloqueIn(Schema):
    turno_id: int
    dia: int
    hora_desde: time
    hora_hasta: time
    es_recreo: bool = False

class BloqueOut(Schema):
    id: int
    turno_id: int
    dia: int
    hora_desde: time
    hora_hasta: time
    es_recreo: bool
    # Optional: Add a display for dia and turno name for better readability
    dia_display: str
    turno_nombre: str

# Schemas for HorarioCatedra
class HorarioCatedraIn(Schema):
    espacio_id: int
    turno_id: int
    anio_cursada: int
    cuatrimestre: Optional[str] = None # ANUAL, C1, C2

class HorarioCatedraOut(Schema):
    id: int
    espacio_id: int
    turno_id: int
    anio_cursada: int
    cuatrimestre: Optional[str]
    # Optional: Add display names for related objects
    espacio_nombre: str
    turno_nombre: str

# Schemas for HorarioCatedraDetalle
class HorarioCatedraDetalleIn(Schema):
    bloque_id: int

class HorarioCatedraDetalleOut(Schema):
    id: int
    horario_catedra_id: int
    bloque_id: int
    # Optional: Add display for bloque details
    bloque_dia: int
    bloque_hora_desde: time
    bloque_hora_hasta: time

# Docente Endpoints
@router.get("/docentes", response=List[DocenteOut])
def list_docentes(request):
    return Docente.objects.all()

@router.post("/docentes", response=DocenteOut)
def create_docente(request, payload: DocenteIn):
    docente = Docente.objects.create(**payload.dict())
    return docente

@router.get("/docentes/{docente_id}", response=DocenteOut)
def get_docente(request, docente_id: int):
    docente = get_object_or_404(Docente, id=docente_id)
    return docente

@router.put("/docentes/{docente_id}", response=DocenteOut)
def update_docente(request, docente_id: int, payload: DocenteIn):
    docente = get_object_or_404(Docente, id=docente_id)
    for attr, value in payload.dict().items():
        if attr == 'cuil' and value == '':
            setattr(docente, attr, None)
        else:
            setattr(docente, attr, value)
    docente.save()
    return docente

@router.delete("/docentes/{docente_id}", response={204: None})
def delete_docente(request, docente_id: int):
    docente = get_object_or_404(Docente, id=docente_id)
    docente.delete()
    return 204, None

# Turno Endpoints
@router.get("/turnos", response=List[TurnoOut])
def list_turnos(request):
    return Turno.objects.all()

@router.post("/turnos", response=TurnoOut)
def create_turno(request, payload: TurnoIn):
    turno = Turno.objects.create(**payload.dict())
    return turno

# Bloque Endpoints
@router.get("/turnos/{turno_id}/bloques", response=List[BloqueOut])
def list_bloques_for_turno(request, turno_id: int):
    turno = get_object_or_404(Turno, id=turno_id)
    # Add annotations for dia_display and turno_nombre
    bloques = turno.bloques.annotate(
        dia_display=Case(
            *[When(dia=choice[0], then=Value(choice[1])) for choice in Bloque.DIA_CHOICES],
            output_field=CharField()
        ),
        turno_nombre=Value(turno.nombre, output_field=CharField())
    )
    return bloques

@router.post("/turnos/{turno_id}/bloques", response=BloqueOut)
def create_bloque_for_turno(request, turno_id: int, payload: BloqueIn):
    turno = get_object_or_404(Turno, id=turno_id)
    bloque = Bloque.objects.create(turno=turno, **payload.dict())
    return bloque

# HorarioCatedra Endpoints
@router.get("/horarios_catedra", response=List[HorarioCatedraOut])
def list_horarios_catedra(
    request,
    espacio_id: Optional[int] = None,
    turno_id: Optional[int] = None,
    anio_cursada: Optional[int] = None,
    cuatrimestre: Optional[str] = None,
):
    # Add annotations for espacio_nombre and turno_nombre
    horarios = HorarioCatedra.objects.select_related('espacio', 'turno').annotate(
        espacio_nombre=F('espacio__nombre'),
        turno_nombre=F('turno__nombre')
    )
    
    if espacio_id:
        horarios = horarios.filter(espacio_id=espacio_id)
    if turno_id:
        horarios = horarios.filter(turno_id=turno_id)
    if anio_cursada:
        horarios = horarios.filter(anio_cursada=anio_cursada)
    
    # Handle cuatrimestre filtering carefully
    if cuatrimestre:
        horarios = horarios.filter(cuatrimestre=cuatrimestre)
    else:
        horarios = horarios.filter(cuatrimestre__isnull=True)

    return horarios

@router.post("/horarios_catedra", response=HorarioCatedraOut)
def create_horario_catedra(request, payload: HorarioCatedraIn):
    # Basic validation: check if cuatrimestre is provided for non-ANUAL regimen
    espacio = get_object_or_404(Materia, id=payload.espacio_id)
    if espacio.regimen != Materia.TipoCursada.ANUAL and not payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre is required for non-ANUAL regimen.")
    if espacio.regimen == Materia.TipoCursada.ANUAL and payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre should not be provided for ANUAL regimen.")
    if payload.cuatrimestre and payload.cuatrimestre != espacio.regimen:
        raise HttpError(400, f"Cuatrimestre '{payload.cuatrimestre}' does not match espacio regimen '{espacio.regimen}'.")

    # Idempotente: si ya existe con misma (espacio, turno, anio_cursada, cuatrimestre) devolverlo
    existing = HorarioCatedra.objects.filter(
        espacio_id=payload.espacio_id,
        turno_id=payload.turno_id,
        anio_cursada=payload.anio_cursada,
        cuatrimestre=payload.cuatrimestre,
    ).first()
    if existing:
        # Asegurar campos calculados requeridos por el schema de respuesta
        existing.espacio_nombre = existing.espacio.nombre
        existing.turno_nombre = existing.turno.nombre
        return existing

    horario = HorarioCatedra.objects.create(
        espacio_id=payload.espacio_id,
        turno_id=payload.turno_id,
        anio_cursada=payload.anio_cursada,
        cuatrimestre=payload.cuatrimestre,
    )
    # Asegurar campos calculados requeridos por el schema de respuesta
    horario.espacio_nombre = horario.espacio.nombre
    horario.turno_nombre = horario.turno.nombre
    return horario

@router.get("/horarios_catedra/{horario_id}", response=HorarioCatedraOut)
def get_horario_catedra(request, horario_id: int):
    horario = get_object_or_404(HorarioCatedra.objects.select_related('espacio', 'turno'), id=horario_id)
    horario.espacio_nombre = horario.espacio.nombre
    horario.turno_nombre = horario.turno.nombre
    return horario

@router.put("/horarios_catedra/{horario_id}", response=HorarioCatedraOut)
def update_horario_catedra(request, horario_id: int, payload: HorarioCatedraIn):
    horario = get_object_or_404(HorarioCatedra, id=horario_id)
    espacio = get_object_or_404(Materia, id=payload.espacio_id)

    # Basic validation: check if cuatrimestre is provided for non-ANUAL regimen
    if espacio.regimen != Materia.TipoCursada.ANUAL and not payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre is required for non-ANUAL regimen.")
    if espacio.regimen == Materia.TipoCursada.ANUAL and payload.cuatrimestre:
        raise HttpError(400, "Cuatrimestre should not be provided for ANUAL regimen.")
    if payload.cuatrimestre and payload.cuatrimestre != espacio.regimen:
        raise HttpError(400, f"Cuatrimestre '{payload.cuatrimestre}' does not match espacio regimen '{espacio.regimen}'.")

    for attr, value in payload.dict().items():
        setattr(horario, attr, value)
    horario.save()
    # Asegurar campos calculados requeridos por el schema de respuesta
    horario.espacio_nombre = horario.espacio.nombre
    horario.turno_nombre = horario.turno.nombre
    return horario

@router.delete("/horarios_catedra/{horario_id}", response={204: None})
def delete_horario_catedra(request, horario_id: int):
    horario = get_object_or_404(HorarioCatedra, id=horario_id)
    horario.delete()
    return 204, None

# HorarioCatedraDetalle Endpoints
@router.get("/horarios_catedra/{horario_catedra_id}/detalles", response=List[HorarioCatedraDetalleOut])
def list_horario_catedra_detalles(request, horario_catedra_id: int):
    horario_catedra = get_object_or_404(HorarioCatedra, id=horario_catedra_id)
    # Add annotations for bloque details
    detalles = horario_catedra.detalles.select_related('bloque').annotate(
        bloque_dia=F('bloque__dia'),
        bloque_hora_desde=F('bloque__hora_desde'),
        bloque_hora_hasta=F('bloque__hora_hasta')
    )
    return detalles

@router.post("/horarios_catedra/{horario_catedra_id}/detalles", response={200: HorarioCatedraDetalleOut, 409: ApiResponse})
def create_horario_catedra_detalle(request, horario_catedra_id: int, payload: HorarioCatedraDetalleIn):
    horario_catedra = get_object_or_404(HorarioCatedra, id=horario_catedra_id)
    bloque = get_object_or_404(Bloque, id=payload.bloque_id)
    
    # Check for overlaps with other HorarioCatedraDetalle for the same block
    conflict = (
        HorarioCatedraDetalle.objects
        .select_related(
            'bloque',
            'horario_catedra__espacio',
            'horario_catedra__turno',
        )
        .filter(
            bloque=bloque,
            horario_catedra__anio_cursada=horario_catedra.anio_cursada,
            horario_catedra__turno=horario_catedra.turno,
            horario_catedra__espacio__plan_de_estudio=horario_catedra.espacio.plan_de_estudio,
            horario_catedra__espacio__anio_cursada=horario_catedra.espacio.anio_cursada,
            horario_catedra__cuatrimestre__in=_compatible_cuatrimestres(horario_catedra.cuatrimestre),
            horario_catedra__espacio__regimen__in=_compatible_cuatrimestres(horario_catedra.espacio.regimen),
        )
        .exclude(horario_catedra=horario_catedra)
        .first()
    )
    if conflict:
        hc = conflict.horario_catedra
        espacio = hc.espacio
        turno = hc.turno
        conflict_payload = {
            "horario_id": hc.id,
            "materia_id": espacio.id if espacio else None,
            "materia_nombre": espacio.nombre if espacio else None,
            "turno": turno.nombre if turno else None,
            "anio_cursada": hc.anio_cursada,
            "cuatrimestre": hc.cuatrimestre,
            "bloque": {
                "id": conflict.bloque_id,
                "dia": conflict.bloque.get_dia_display(),
                "hora_desde": str(conflict.bloque.hora_desde)[:5],
                "hora_hasta": str(conflict.bloque.hora_hasta)[:5],
            },
        }
        return 409, ApiResponse(
            ok=False,
            message="Bloque ocupado por otra cátedra en el mismo turno y año.",
            data={"conflict": conflict_payload},
        )

    # Idempotente: evitar duplicado por unique_together
    detalle, _created = HorarioCatedraDetalle.objects.get_or_create(
        horario_catedra=horario_catedra,
        bloque=bloque,
    )
    
    # Manually add the required fields for the response schema
    detalle.bloque_dia = detalle.bloque.dia
    detalle.bloque_hora_desde = detalle.bloque.hora_desde
    detalle.bloque_hora_hasta = detalle.bloque.hora_hasta

    return detalle

@router.delete("/horarios_catedra_detalles/{detalle_id}", response={204: None})
def delete_horario_catedra_detalle(request, detalle_id: int):
    detalle = get_object_or_404(HorarioCatedraDetalle, id=detalle_id)
    detalle.delete()
    return 204, None

# Comision Endpoints
class ComisionIn(Schema):
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: int
    docente_id: Optional[int] = None
    horario_id: Optional[int] = None
    cupo_maximo: Optional[int] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class ComisionOut(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    plan_id: int
    plan_resolucion: str
    profesorado_id: int
    profesorado_nombre: str
    anio_lectivo: int
    codigo: str
    turno_id: int
    turno_nombre: str
    docente_id: Optional[int] = None
    docente_nombre: Optional[str] = None
    horario_id: Optional[int] = None
    cupo_maximo: Optional[int] = None
    estado: str
    observaciones: Optional[str] = None


def _serialize_comision(comision: Comision) -> ComisionOut:
    materia = comision.materia
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado
    turno = comision.turno
    docente = comision.docente
    return ComisionOut(
        id=comision.id,
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        plan_id=plan.id,
        plan_resolucion=plan.resolucion,
        profesorado_id=profesorado.id,
        profesorado_nombre=profesorado.nombre,
        anio_lectivo=comision.anio_lectivo,
        codigo=comision.codigo,
        turno_id=turno.id,
        turno_nombre=turno.nombre,
        docente_id=docente.id if docente else None,
        docente_nombre=f"{docente.apellido}, {docente.nombre}" if docente else None,
        horario_id=comision.horario_id,
        cupo_maximo=comision.cupo_maximo,
        estado=comision.estado,
        observaciones=comision.observaciones or None,
    )


def _clean_estado(value: Optional[str]) -> str:
    estado = (value or Comision.Estado.ABIERTA).upper()
    allowed = {choice[0] for choice in Comision.Estado.choices}
    if estado not in allowed:
        raise HttpError(400, f"Estado invalido: {estado}")
    return estado


def _resolve_docente(docente_id: Optional[int]) -> Optional[Docente]:
    if docente_id is None:
        return None
    return get_object_or_404(Docente, id=docente_id)


def _resolve_horario(horario_id: Optional[int]) -> Optional[HorarioCatedra]:
    if horario_id is None:
        return None
    return get_object_or_404(HorarioCatedra, id=horario_id)


def _codigo_from_index(index: int) -> str:
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


@router.get("/comisiones", response=List[ComisionOut])
def list_comisiones(
    request,
    profesorado_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    materia_id: Optional[int] = None,
    anio_lectivo: Optional[int] = None,
    turno_id: Optional[int] = None,
    estado: Optional[str] = None,
):
    qs = Comision.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "turno",
        "docente",
    )
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

    qs = qs.order_by("-anio_lectivo", "materia__nombre", "codigo")
    return [_serialize_comision(com) for com in qs]


@router.post("/comisiones", response=ComisionOut)
def create_comision(request, payload: ComisionIn):
    materia = get_object_or_404(Materia, id=payload.materia_id)
    turno = get_object_or_404(Turno, id=payload.turno_id)
    docente = _resolve_docente(payload.docente_id)
    horario = _resolve_horario(payload.horario_id)
    estado = _clean_estado(payload.estado)

    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=payload.anio_lectivo,
        codigo=payload.codigo,
        turno=turno,
        docente=docente,
        horario=horario,
        cupo_maximo=payload.cupo_maximo,
        estado=estado,
        observaciones=payload.observaciones or "",
    )
    return _serialize_comision(comision)


class ComisionBulkGenerateIn(Schema):
    plan_id: int
    anio_lectivo: int
    turnos: Optional[List[int]] = None
    cantidad: int = 1
    estado: Optional[str] = None


@router.post("/comisiones/generar", response=List[ComisionOut])
def bulk_generate_comisiones(request, payload: ComisionBulkGenerateIn):
    if payload.cantidad < 1:
        raise HttpError(400, "Cantidad debe ser al menos 1.")

    plan = get_object_or_404(PlanDeEstudio.objects.select_related("profesorado"), id=payload.plan_id)
    materias = list(plan.materias.all().order_by("anio_cursada", "nombre"))
    if not materias:
        raise HttpError(400, "El plan no posee materias para generar comisiones.")

    estado = _clean_estado(payload.estado)

    if payload.turnos:
        turnos = list(Turno.objects.filter(id__in=payload.turnos))
        if not turnos:
            raise HttpError(400, "No se encontraron turnos con los identificadores provistos.")
        if len(turnos) != len(set(payload.turnos)):
            raise HttpError(400, "Alguno de los turnos solicitados no existe.")
    else:
        turnos = list(Turno.objects.all().order_by("id"))
        if not turnos:
            raise HttpError(400, "No hay turnos dados de alta en el sistema.")

    created: List[Comision] = []

    with transaction.atomic():
        for materia in materias:
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
            while nuevos_creados < faltantes:
                codigo = _codigo_from_index(code_index)
                code_index += 1
                if codigo in existing_codes:
                    continue
                existing_codes.add(codigo)
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


@router.put("/comisiones/{comision_id}", response=ComisionOut)
def update_comision(request, comision_id: int, payload: ComisionIn):
    comision = get_object_or_404(Comision, id=comision_id)
    materia = get_object_or_404(Materia, id=payload.materia_id)
    turno = get_object_or_404(Turno, id=payload.turno_id)
    docente = _resolve_docente(payload.docente_id)
    horario = _resolve_horario(payload.horario_id)
    estado = _clean_estado(payload.estado)

    comision.materia = materia
    comision.anio_lectivo = payload.anio_lectivo
    comision.codigo = payload.codigo
    comision.turno = turno
    comision.docente = docente
    comision.horario = horario
    comision.cupo_maximo = payload.cupo_maximo
    comision.estado = estado
    comision.observaciones = payload.observaciones or ""
    comision.save()

    return _serialize_comision(comision)


@router.delete("/comisiones/{comision_id}", response={204: None})
def delete_comision(request, comision_id: int):
    comision = get_object_or_404(Comision, id=comision_id)
    comision.delete()
    return 204, None

# Specific endpoint for timetable builder: Get occupied blocks
@router.get("/horarios/ocupacion", response=List[BloqueOut])
def get_occupied_blocks(request, anio_cursada: int, turno_id: int, cuatrimestre: Optional[str] = None):
    # This endpoint will return all blocks occupied by other schedules
    # for a given year, turn, and optionally cuatrimestre.
    # This is crucial for the frontend to display overlaps.

    # Filter schedules by anio_cursada and turno
    schedules = HorarioCatedra.objects.filter(
        anio_cursada=anio_cursada,
        turno_id=turno_id
    )

    # If a cuatrimestre is provided, filter schedules that are ANUAL or match the cuatrimestre
    if cuatrimestre:
        schedules = schedules.filter(
            Q(cuatrimestre=Materia.TipoCursada.ANUAL) | Q(cuatrimestre=cuatrimestre)
        )
    
    # Get all unique blocks associated with these schedules
    occupied_bloque_ids = HorarioCatedraDetalle.objects.filter(
        horario_catedra__in=schedules
    ).values_list('bloque_id', flat=True).distinct()

    # Retrieve the actual Bloque objects
    occupied_bloques = Bloque.objects.filter(id__in=occupied_bloque_ids).annotate(
        dia_display=Case(
            *[When(dia=choice[0], then=Value(choice[1])) for choice in Bloque.DIA_CHOICES],
            output_field=CharField()
        ),
        turno_nombre=Value(get_object_or_404(Turno, id=turno_id).nombre, output_field=CharField())
    )
    return occupied_bloques

# === Ventanas de Habilitación ===
class VentanaIn(Schema):
    tipo: str
    desde: date
    hasta: date
    activo: bool = True
    periodo: Optional[str] = None

class VentanaOut(Schema):
    id: int
    tipo: str
    desde: date
    hasta: date
    activo: bool
    periodo: Optional[str] = None

@router.get("/ventanas", response=List[VentanaOut])
def list_ventanas(request, tipo: Optional[str] = None, estado: Optional[str] = None):
    qs = VentanaHabilitacion.objects.all()
    if tipo:
        qs = qs.filter(tipo=tipo)
    today = date.today()
    if estado:
        if estado.lower() == 'activa':
            qs = qs.filter(activo=True, desde__lte=today, hasta__gte=today)
        elif estado.lower() == 'pendiente':
            qs = qs.filter(activo=True, desde__gt=today)
        elif estado.lower() == 'pasada':
            qs = qs.filter(hasta__lt=today)
    return qs.order_by('tipo', '-desde', '-created_at')

@router.post("/ventanas", response=VentanaOut)
def create_ventana(request, payload: VentanaIn):
    obj = VentanaHabilitacion.objects.create(
        tipo=payload.tipo,
        desde=payload.desde,
        hasta=payload.hasta,
        activo=payload.activo,
        periodo=payload.periodo,
    )
    return obj

# ====== Correlatividades de Materias ======

class CorrelatividadSetIn(Schema):
    regular_para_cursar: List[int] = []   # RPC
    aprobada_para_cursar: List[int] = []  # APC
    aprobada_para_rendir: List[int] = []  # APR

class CorrelatividadSetOut(Schema):
    regular_para_cursar: List[int]
    aprobada_para_cursar: List[int]
    aprobada_para_rendir: List[int]


def _to_set_out(qs) -> Dict[str, List[int]]:
    out = {
        "regular_para_cursar": [],
        "aprobada_para_cursar": [],
        "aprobada_para_rendir": [],
    }
    for c in qs:
        if c.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
            out["regular_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
            out["aprobada_para_cursar"].append(c.materia_correlativa_id)
        elif c.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR:
            out["aprobada_para_rendir"].append(c.materia_correlativa_id)
    return out


@router.get("/materias/{materia_id}/correlatividades", response=CorrelatividadSetOut)
def get_correlatividades_materia(request, materia_id: int):
    materia = get_object_or_404(Materia, id=materia_id)
    qs = Correlatividad.objects.filter(materia_origen=materia)
    return _to_set_out(qs)


@router.post("/materias/{materia_id}/correlatividades", response=CorrelatividadSetOut)
def set_correlatividades_materia(request, materia_id: int, payload: CorrelatividadSetIn):
    materia = get_object_or_404(Materia, id=materia_id)
    # Validar que los IDs pertenecen al mismo plan para evitar incoherencias
    all_ids = set(payload.regular_para_cursar + payload.aprobada_para_cursar + payload.aprobada_para_rendir)
    if all_ids:
        count = Materia.objects.filter(id__in=all_ids, plan_de_estudio=materia.plan_de_estudio).count()
        if count != len(all_ids):
            raise HttpError(400, "Todas las materias correlativas deben pertenecer al mismo plan de estudio.")
        # Validar que no se exijan materias de años futuros (anio_cursada > anio de la materia)
        anios = dict(Materia.objects.filter(id__in=all_ids).values_list("id", "anio_cursada"))
        futuros = [mid for mid in all_ids if anios.get(mid, 0) > materia.anio_cursada]
        if futuros:
            raise HttpError(400, "No se pueden requerir correlativas de años futuros para esta materia.")

    with transaction.atomic():
        Correlatividad.objects.filter(materia_origen=materia).delete()

        def _bulk_create(ids: List[int], tipo: str):
            objs = [
                Correlatividad(
                    materia_origen_id=materia.id,
                    materia_correlativa_id=mid,
                    tipo=tipo,
                )
                for mid in ids
            ]
            if objs:
                Correlatividad.objects.bulk_create(objs)

        _bulk_create(payload.regular_para_cursar, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR)
        _bulk_create(payload.aprobada_para_cursar, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR)
        _bulk_create(payload.aprobada_para_rendir, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR)

    qs = Correlatividad.objects.filter(materia_origen=materia)
    return _to_set_out(qs)


class MateriaCorrelatividadRow(Schema):
    id: int
    nombre: str
    anio_cursada: int
    regimen: str
    formato: str
    regular_para_cursar: List[int]
    aprobada_para_cursar: List[int]
    aprobada_para_rendir: List[int]


@router.get("/planes/{plan_id}/correlatividades_matrix", response=List[MateriaCorrelatividadRow])
def correlatividades_por_plan(
    request,
    plan_id: int,
    anio_cursada: Optional[int] = None,
    nombre: Optional[str] = None,
    regimen: Optional[str] = None,
    formato: Optional[str] = None,
):
    plan = get_object_or_404(PlanDeEstudio, id=plan_id)
    materias = plan.materias.all().order_by("anio_cursada", "nombre")
    if anio_cursada is not None:
        materias = materias.filter(anio_cursada=anio_cursada)
    if nombre is not None and nombre != "":
        materias = materias.filter(nombre__icontains=nombre)
    if regimen is not None and regimen != "":
        materias = materias.filter(regimen=regimen)
    if formato is not None and formato != "":
        materias = materias.filter(formato=formato)

    rows: List[MateriaCorrelatividadRow] = []
    corr_map = {}
    corr_qs = Correlatividad.objects.filter(materia_origen__in=materias)
    for c in corr_qs:
        corr_map.setdefault(c.materia_origen_id, []).append(c)

    for m in materias:
        setvals = _to_set_out(corr_map.get(m.id, []))
        rows.append(
            MateriaCorrelatividadRow(
                id=m.id,
                nombre=m.nombre,
                anio_cursada=m.anio_cursada,
                regimen=m.regimen,
                formato=m.formato,
                regular_para_cursar=setvals["regular_para_cursar"],
                aprobada_para_cursar=setvals["aprobada_para_cursar"],
                aprobada_para_rendir=setvals["aprobada_para_rendir"],
            )
        )
    return rows

@router.put("/ventanas/{ventana_id}", response=VentanaOut)
def update_ventana(request, ventana_id: int, payload: VentanaIn):
    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    obj.tipo = payload.tipo
    obj.desde = payload.desde
    obj.hasta = payload.hasta
    obj.activo = payload.activo
    obj.periodo = payload.periodo
    obj.save()
    return obj

@router.delete("/ventanas/{ventana_id}", response={204: None})
def delete_ventana(request, ventana_id: int):
    obj = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    obj.delete()
    return 204, None
# ===== Mesas de Examen (Secretaría/Bedel) =====
class MesaIn(Schema):
    materia_id: int
    tipo: str   # 'PAR' | 'FIN' | 'LIB' | 'EXT'
    fecha: date
    hora_desde: Optional[str] = None
    hora_hasta: Optional[str] = None
    aula: Optional[str] = None
    cupo: Optional[int] = 0
    ventana_id: Optional[int] = None

class MesaOut(Schema):
    id: int
    materia_id: int
    tipo: str
    fecha: date
    hora_desde: Optional[str]
    hora_hasta: Optional[str]
    aula: Optional[str]
    cupo: int

@router.get('/mesas', response=List[MesaOut])
def list_mesas(request, ventana_id: Optional[int] = None, tipo: Optional[str] = None):
    qs = MesaExamen.objects.all().order_by('fecha', 'hora_desde')
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if tipo:
        qs = qs.filter(tipo=tipo)
    return qs

@router.post('/mesas', response=MesaOut)
def crear_mesa(request, payload: MesaIn):
    mat = get_object_or_404(Materia, id=payload.materia_id)
    mesa = MesaExamen.objects.create(
        materia=mat,
        tipo=payload.tipo,
        fecha=payload.fecha,
        hora_desde=payload.hora_desde or None,
        hora_hasta=payload.hora_hasta or None,
        aula=payload.aula or None,
        cupo=payload.cupo or 0,
        ventana_id=payload.ventana_id or None,
    )
    return mesa

@router.put('/mesas/{mesa_id}', response=MesaOut)
def actualizar_mesa(request, mesa_id: int, payload: MesaIn):
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    for k,v in payload.dict().items():
        if k == 'materia_id':
            mesa.materia = get_object_or_404(Materia, id=v)
        elif hasattr(mesa, k):
            setattr(mesa, k, v)
    mesa.save()
    return mesa

@router.delete('/mesas/{mesa_id}', response={204: None})
def eliminar_mesa(request, mesa_id: int):
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    mesa.delete()
    return 204, None
