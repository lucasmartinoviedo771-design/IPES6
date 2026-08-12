import datetime
from typing import List, Optional

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from ninja import Router, Schema

from apps.asistencia.cargos_models import (
    AsistenciaCargoDocente,
    Cargo,
    CargoDocente,
    HorarioCargo,
    validar_solapamiento_horario_docente,
)
from core.models import Docente

router = Router(tags=["Cargos y Asistencia de Cargos"])


# --- Schemas ---

class HorarioCargoSchema(Schema):
    id: int
    dia_semana: int
    dia_nombre: str
    hora_inicio: str
    hora_fin: str


class HorarioCargoCreateSchema(Schema):
    dia_semana: int
    hora_inicio: str  # "HH:MM"
    hora_fin: str     # "HH:MM"


class AsignacionDocenteSchema(Schema):
    id: int
    docente_id: int
    docente_nombre: str
    docente_dni: str
    sit_revista: str
    sit_revista_display: str
    fecha_inicio: str
    fecha_fin: Optional[str] = None
    resolucion: Optional[str] = ""
    activo: bool


class CargoSchema(Schema):
    id: int
    codigo_cargo: str
    codigo_salarial: str
    nombre: str
    tipo_cargo: str
    tipo_cargo_display: str
    duracion_minutos: int
    descripcion: str
    activo: bool
    horarios: List[HorarioCargoSchema]
    asignaciones: List[AsignacionDocenteSchema]


class CargoCreateSchema(Schema):
    codigo_cargo: str
    codigo_salarial: Optional[str] = ""
    nombre: str
    tipo_cargo: Optional[str] = "horas_reloj"
    duracion_minutos: Optional[int] = 260
    descripcion: Optional[str] = ""


class AsignarDocenteSchema(Schema):
    docente_id: int
    sit_revista: str  # "titular", "interino", "suplente"
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    resolucion: Optional[str] = ""


class PlanillaCargoItemSchema(Schema):
    cargo_id: int
    cargo_codigo: str
    cargo_nombre: str
    cargo_docente_id: int
    docente_id: int
    docente_nombre: str
    docente_dni: str
    sit_revista: str
    hora_inicio: str
    hora_fin: str
    estado_asistencia: Optional[str] = None
    observaciones: Optional[str] = ""


class MarcarAsistenciaCargoSchema(Schema):
    cargo_docente_id: int
    fecha: str  # "YYYY-MM-DD"
    estado: str  # "presente", "ausente", "tarde", "justificada"
    observaciones: Optional[str] = ""


# --- Endpoints ---

@router.get("/cargos", response=List[CargoSchema])
def listar_cargos(request):
    """Lista todos los cargos registrados con sus horarios y docentes asignados."""
    cargos = Cargo.objects.prefetch_related("horarios", "asignaciones_docentes__docente").all()
    resultado = []
    for c in cargos:
        horarios = [
            HorarioCargoSchema(
                id=h.id,
                dia_semana=h.dia_semana,
                dia_nombre=h.get_dia_semana_display(),
                hora_inicio=h.hora_inicio.strftime("%H:%M"),
                hora_fin=h.hora_fin.strftime("%H:%M"),
            )
            for h in c.horarios.all()
        ]
        asignaciones = [
            AsignacionDocenteSchema(
                id=a.id,
                docente_id=a.docente.id,
                docente_nombre=f"{a.docente.nombre} {a.docente.apellido}",
                docente_dni=a.docente.dni,
                sit_revista=a.sit_revista,
                sit_revista_display=a.get_sit_revista_display(),
                fecha_inicio=str(a.fecha_inicio),
                fecha_fin=str(a.fecha_fin) if a.fecha_fin else None,
                resolucion=a.resolucion or "",
                activo=a.activo,
            )
            for a in c.asignaciones_docentes.all()
        ]
        resultado.append(
            CargoSchema(
                id=c.id,
                codigo_cargo=c.codigo_cargo,
                codigo_salarial=c.codigo_salarial or "",
                nombre=c.nombre,
                tipo_cargo=c.tipo_cargo,
                tipo_cargo_display=c.get_tipo_cargo_display(),
                duracion_minutos=c.duracion_minutos,
                descripcion=c.descripcion or "",
                activo=c.activo,
                horarios=horarios,
                asignaciones=asignaciones,
            )
        )
    return resultado


@router.post("/cargos", response={201: CargoSchema, 400: dict})
def crear_cargo(request, payload: CargoCreateSchema):
    """Crea un nuevo cargo institucional."""
    if Cargo.objects.filter(codigo_cargo=payload.codigo_cargo).exists():
        return 400, {"message": f"El código de cargo '{payload.codigo_cargo}' ya existe."}

    cargo = Cargo.objects.create(
        codigo_cargo=payload.codigo_cargo,
        codigo_salarial=payload.codigo_salarial or "",
        nombre=payload.nombre,
        tipo_cargo=payload.tipo_cargo or "horas_reloj",
        duracion_minutos=payload.duracion_minutos or 260,
        descripcion=payload.descripcion or "",
    )

    return 201, CargoSchema(
        id=cargo.id,
        codigo_cargo=cargo.codigo_cargo,
        codigo_salarial=cargo.codigo_salarial or "",
        nombre=cargo.nombre,
        tipo_cargo=cargo.tipo_cargo,
        tipo_cargo_display=cargo.get_tipo_cargo_display(),
        duracion_minutos=cargo.duracion_minutos,
        descripcion=cargo.descripcion or "",
        activo=cargo.activo,
        horarios=[],
        asignaciones=[],
    )


@router.post("/cargos/{cargo_id}/asignar", response={200: dict, 400: dict})
def asignar_docente_a_cargo(request, cargo_id: int, payload: AsignarDocenteSchema):
    """Asigna una persona/docente a un cargo con su Situación de Revista."""
    cargo = get_object_or_404(Cargo, id=cargo_id)
    docente = get_object_or_404(Docente, id=payload.docente_id)

    # Validar solapamiento de horarios del cargo contra los horarios del docente
    for h in cargo.horarios.all():
        solapado, error_msg = validar_solapamiento_horario_docente(
            docente_id=docente.id,
            dia_semana=h.dia_semana,
            hora_inicio=h.hora_inicio,
            hora_fin=h.hora_fin,
        )
        if solapado:
            return 400, {"message": f"No se puede asignar el cargo: {error_msg}"}

    fecha_inicio = (
        datetime.datetime.strptime(payload.fecha_inicio, "%Y-%m-%d").date()
        if payload.fecha_inicio
        else datetime.date.today()
    )
    fecha_fin = (
        datetime.datetime.strptime(payload.fecha_fin, "%Y-%m-%d").date()
        if payload.fecha_fin
        else None
    )

    asignacion = CargoDocente.objects.create(
        cargo=cargo,
        docente=docente,
        sit_revista=payload.sit_revista,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        resolucion=payload.resolucion or "",
        activo=True,
    )

    return 200, {
        "message": f"Docente {docente.nombre} {docente.apellido} asignado exitosamente al cargo {cargo.nombre}.",
        "asignacion_id": asignacion.id,
    }


@router.post("/cargos/{cargo_id}/horarios", response={201: HorarioCargoSchema, 400: dict})
def agregar_horario_a_cargo(request, cargo_id: int, payload: HorarioCargoCreateSchema):
    """Agrega un bloque de horario a un cargo con validación de solapamientos."""
    cargo = get_object_or_404(Cargo, id=cargo_id)

    try:
        h_inicio = datetime.datetime.strptime(payload.hora_inicio, "%H:%M").time()
        h_fin = datetime.datetime.strptime(payload.hora_fin, "%H:%M").time()
    except ValueError:
        return 400, {"message": "Formato de hora inválido. Use HH:MM."}

    if h_fin <= h_inicio:
        return 400, {"message": "La hora de fin debe ser posterior a la hora de inicio."}

    # Validar solapamiento contra docentes actualmente asignados a este cargo
    for a in cargo.asignaciones_docentes.filter(activo=True):
        solapado, error_msg = validar_solapamiento_horario_docente(
            docente_id=a.docente_id,
            dia_semana=payload.dia_semana,
            hora_inicio=h_inicio,
            hora_fin=h_fin,
        )
        if solapado:
            return 400, {"message": f"No se puede agregar el horario: {error_msg}"}

    horario = HorarioCargo.objects.create(
        cargo=cargo,
        dia_semana=payload.dia_semana,
        hora_inicio=h_inicio,
        hora_fin=h_fin,
    )

    return 210, HorarioCargoSchema(
        id=horario.id,
        dia_semana=horario.dia_semana,
        dia_nombre=horario.get_dia_semana_display(),
        hora_inicio=horario.hora_inicio.strftime("%H:%M"),
        hora_fin=horario.hora_fin.strftime("%H:%M"),
    )


@router.get("/cargos/planilla", response=List[PlanillaCargoItemSchema])
def obtener_planilla_asistencia_cargos(request, fecha: Optional[str] = None):
    """Obtiene la planilla diaria de cargos para registrar la asistencia."""
    fecha_obj = (
        datetime.datetime.strptime(fecha, "%Y-%m-%d").date()
        if fecha
        else datetime.date.today()
    )
    # Python weekday(): Mon=0..Sun=6 -> DB: Sun=0..Sat=6
    py_weekday = fecha_obj.weekday()
    db_dia_semana = (py_weekday + 1) % 7

    horarios = HorarioCargo.objects.filter(dia_semana=db_dia_semana).select_related("cargo")
    planilla = []

    for h in horarios:
        asignaciones = h.cargo.asignaciones_docentes.filter(activo=True).select_related("docente")
        for a in asignaciones:
            asistencia = AsistenciaCargoDocente.objects.filter(
                cargo_docente=a,
                fecha=fecha_obj,
            ).first()

            planilla.append(
                PlanillaCargoItemSchema(
                    cargo_id=h.cargo.id,
                    cargo_codigo=h.cargo.codigo_cargo,
                    cargo_nombre=h.cargo.nombre,
                    cargo_docente_id=a.id,
                    docente_id=a.docente.id,
                    docente_nombre=f"{a.docente.nombre} {a.docente.apellido}",
                    docente_dni=a.docente.dni,
                    sit_revista=a.get_sit_revista_display(),
                    hora_inicio=h.hora_inicio.strftime("%H:%M"),
                    hora_fin=h.hora_fin.strftime("%H:%M"),
                    estado_asistencia=asistencia.estado if asistencia else None,
                    observaciones=asistencia.observaciones if asistencia else "",
                )
            )

    return planilla


@router.post("/cargos/marcar", response={200: dict, 400: dict})
def marcar_asistencia_cargo(request, payload: MarcarAsistenciaCargoSchema):
    """Registra o actualiza el estado de asistencia a un cargo para una fecha."""
    cargo_docente = get_object_or_404(CargoDocente, id=payload.cargo_docente_id)

    try:
        fecha_obj = datetime.datetime.strptime(payload.fecha, "%Y-%m-%d").date()
    except ValueError:
        return 400, {"message": "Formato de fecha inválido. Use YYYY-MM-DD."}

    user = request.user if request.user and request.user.is_authenticated else None

    asistencia, created = AsistenciaCargoDocente.objects.update_or_create(
        cargo_docente=cargo_docente,
        fecha=fecha_obj,
        defaults={
            "estado": payload.estado,
            "observaciones": payload.observaciones or "",
            "registrado_por": user,
        },
    )

    return 200, {
        "message": f"Asistencia marcada como '{asistencia.get_estado_display()}' para {cargo_docente.docente.nombre} {cargo_docente.docente.apellido}.",
        "asistencia_id": asistencia.id,
        "estado": asistencia.estado,
    }
