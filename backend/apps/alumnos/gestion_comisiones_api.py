from django.db import transaction
from django.db.models import Count, Q
from ninja import Router, Schema
from typing import List, Optional
import random

from core.models import Comision, Materia, InscripcionMateriaAlumno, Turno, Estudiante
from core.auth_ninja import JWTAuth, ensure_roles
from apps.common.api_schemas import ApiResponse

router = Router(tags=["gestion_comisiones"])

class ComisionGestionDTO(Schema):
    id: int
    codigo: str
    anio_lectivo: int
    turno_nombre: str
    cantidad_inscriptos: int
    cupo_maximo: Optional[int]

class CrearComisionIn(Schema):
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: Optional[int] = None
    cupo_maximo: Optional[int] = None

class CrearComisionMasivaIn(Schema):
    plan_id: int
    anio_cursada: int
    anio_lectivo: int
    codigo: str
    turno_id: Optional[int] = None
    cupo_maximo: Optional[int] = None

class DistribuirAlumnosIn(Schema):
    comision_origen_id: int
    comision_destino_id: int
    porcentaje: int = 50

class MoverAlumnosIn(Schema):
    comision_destino_id: int
    inscripcion_ids: List[int]

@router.get("/materia/{materia_id}/anio/{anio_lectivo}", response=List[ComisionGestionDTO], auth=JWTAuth())
@ensure_roles(["admin", "secretaria"])
def listar_comisiones_gestion(request, materia_id: int, anio_lectivo: int):
    comisiones = Comision.objects.filter(
        materia_id=materia_id,
        anio_lectivo=anio_lectivo
    ).annotate(
        cantidad_inscriptos=Count('inscripciones', filter=Q(inscripciones__estado=InscripcionMateriaAlumno.Estado.CONFIRMADA))
    ).order_by('codigo')

    return [
        ComisionGestionDTO(
            id=c.id,
            codigo=c.codigo,
            anio_lectivo=c.anio_lectivo,
            turno_nombre=c.turno.nombre if c.turno else "Sin turno",
            cantidad_inscriptos=c.cantidad_inscriptos,
            cupo_maximo=c.cupo_maximo
        ) for c in comisiones
    ]

@router.post("/crear", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria"])
def crear_comision(request, payload: CrearComisionIn):
    if Comision.objects.filter(materia_id=payload.materia_id, anio_lectivo=payload.anio_lectivo, codigo=payload.codigo).exists():
        return 400, ApiResponse(ok=False, message=f"Ya existe una comisión con el código {payload.codigo} para este año.")

    try:
        materia = Materia.objects.get(id=payload.materia_id)
    except Materia.DoesNotExist:
        return 400, ApiResponse(ok=False, message="Materia no encontrada.")

    # Si no se especifica turno, intentar copiar de otra comision existente o default
    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
    
    if not turno:
        # Intentar buscar el turno de la comision 'A' o la primera que encuentre
        otra_comision = Comision.objects.filter(materia_id=payload.materia_id, anio_lectivo=payload.anio_lectivo).first()
        if otra_comision:
            turno = otra_comision.turno
    
    if not turno:
        # Fallback: Primer turno disponible (probablemente Tarde o Noche)
        turno = Turno.objects.first()

    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=payload.anio_lectivo,
        codigo=payload.codigo,
        turno=turno,
        cupo_maximo=payload.cupo_maximo,
        estado=Comision.Estado.ABIERTA
    )

    return ApiResponse(ok=True, message="Comisión creada exitosamente.", data={"id": comision.id})

@router.post("/crear-masiva", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria"])
def crear_comision_masiva(request, payload: CrearComisionMasivaIn):
    materias = Materia.objects.filter(plan_id=payload.plan_id, anio_cursada=payload.anio_cursada)
    
    if not materias.exists():
        return 400, ApiResponse(ok=False, message="No se encontraron materias para el plan y año de cursada especificados.")

    created_count = 0
    
    # Determinar turno (similar a crear_comision)
    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
    
    if not turno:
        turno = Turno.objects.first()

    for materia in materias:
        if not Comision.objects.filter(materia=materia, anio_lectivo=payload.anio_lectivo, codigo=payload.codigo).exists():
            Comision.objects.create(
                materia=materia,
                anio_lectivo=payload.anio_lectivo,
                codigo=payload.codigo,
                turno=turno,
                cupo_maximo=payload.cupo_maximo,
                estado=Comision.Estado.ABIERTA
            )
            created_count += 1

    if created_count == 0:
        return ApiResponse(ok=True, message="No se crearon nuevas comisiones (ya existían todas).")

    return ApiResponse(ok=True, message=f"Se crearon {created_count} comisiones para el {payload.anio_cursada}º año.")

@router.post("/distribuir", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria"])
def distribuir_alumnos(request, payload: DistribuirAlumnosIn):
    with transaction.atomic():
        inscripciones = list(InscripcionMateriaAlumno.objects.filter(
            comision_id=payload.comision_origen_id,
            estado=InscripcionMateriaAlumno.Estado.CONFIRMADA
        ))
        
        if not inscripciones:
            return 400, ApiResponse(ok=False, message="La comisión de origen no tiene alumnos inscriptos.")

        cantidad_a_mover = int(len(inscripciones) * (payload.porcentaje / 100))
        
        if cantidad_a_mover == 0:
            return ApiResponse(ok=True, message="No hay suficientes alumnos para mover con ese porcentaje.")

        alumnos_a_mover = random.sample(inscripciones, cantidad_a_mover)
        
        for inscripcion in alumnos_a_mover:
            inscripcion.comision_id = payload.comision_destino_id
            inscripcion.save()

    return ApiResponse(ok=True, message=f"Se movieron {cantidad_a_mover} alumnos a la nueva comisión.")

@router.post("/mover", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria"])
def mover_alumnos(request, payload: MoverAlumnosIn):
    updated = InscripcionMateriaAlumno.objects.filter(
        id__in=payload.inscripcion_ids
    ).update(comision_id=payload.comision_destino_id)

    return ApiResponse(ok=True, message=f"Se movieron {updated} alumnos.")
