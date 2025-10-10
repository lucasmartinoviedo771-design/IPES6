from ninja import Router, Schema
from typing import List, Optional
from django.shortcuts import get_object_or_404
from core.models import Profesorado, PlanDeEstudio, Materia, Docente, Turno, Bloque, HorarioCatedra, HorarioCatedraDetalle
from ninja.errors import HttpError
from datetime import time
from django.db.models import Case, When, Value, CharField, F, Q

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
def list_horarios_catedra(request):
    # Add annotations for espacio_nombre and turno_nombre
    horarios = HorarioCatedra.objects.select_related('espacio', 'turno').annotate(
        espacio_nombre=F('espacio__nombre'),
        turno_nombre=F('turno__nombre')
    )
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

    horario = HorarioCatedra.objects.create(**payload.dict())
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

@router.post("/horarios_catedra/{horario_catedra_id}/detalles", response=HorarioCatedraDetalleOut)
def create_horario_catedra_detalle(request, horario_catedra_id: int, payload: HorarioCatedraDetalleIn):
    horario_catedra = get_object_or_404(HorarioCatedra, id=horario_catedra_id)
    bloque = get_object_or_404(Bloque, id=payload.bloque_id)
    
    # Check for overlaps with other HorarioCatedraDetalle for the same block
    # This is a basic check, more complex overlap logic will be needed
    if HorarioCatedraDetalle.objects.filter(bloque=bloque, horario_catedra__anio_cursada=horario_catedra.anio_cursada, horario_catedra__turno=horario_catedra.turno).exclude(horario_catedra=horario_catedra).exists():
        raise HttpError(409, "Block is already occupied by another schedule in the same year and turn.")

    detalle = HorarioCatedraDetalle.objects.create(horario_catedra=horario_catedra, bloque=bloque)
    return detalle

@router.delete("/horarios_catedra_detalles/{detalle_id}", response={204: None})
def delete_horario_catedra_detalle(request, detalle_id: int):
    detalle = get_object_or_404(HorarioCatedraDetalle, id=detalle_id)
    detalle.delete()
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
