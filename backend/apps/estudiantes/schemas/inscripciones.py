from typing import Literal

from ninja import Schema, Field

from apps.estudiantes.schemas.materias import Horario

# ==========================================
# 1. INSCRIPCIONES A CARRERA Y MATERIAS
# ==========================================

class InscripcionCarreraIn(Schema):
    carrera_id: int

class InscripcionCarreraOut(Schema):
    message: str

class InscripcionMateriaIn(Schema):
    materia_id: int
    comision_id: int | None = None
    dni: str | None = None

class CancelarInscripcionIn(Schema):
    dni: str | None = None

class BajaInscripcionIn(Schema):
    motivo: str
    dni: str | None = None

class CambioComisionIn(Schema):
    inscripcion_id: int
    comision_id: int

class InscripcionEstado(Schema):
    pass # Placeholder si se necesita tipado estricto, o usar Literal abajo

InscripcionEstadoType = Literal["CONF", "PEND", "RECH", "ANUL", "BAJA"]

# ==========================================
# 7. COMISIONES Y LOOKUP
# ==========================================

class MateriaOption(Schema):
    id: int
    nombre: str
    plan_id: int
    anio: int | None = None
    cuatrimestre: str | None = None
    formato: str | None = None

class ComisionOption(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    anio: int
    cuatrimestre: str | None = None
    turno: str
    codigo: str

class CargaNotasLookup(Schema):
    materias: list[MateriaOption] = Field(default_factory=list)
    comisiones: list[ComisionOption] = Field(default_factory=list)

CargaNotasLookup.model_rebuild()


# ==========================================
# 9. INSCRIPCIONES DETALLE / RESUMEN
# ==========================================

class ComisionResumen(Schema):
    id: int
    codigo: str
    anio_lectivo: int
    turno_id: int
    turno: str
    materia_id: int
    materia_nombre: str
    plan_id: int | None = None
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    docente: str | None = None
    cupo_maximo: int | None = None
    estado: str
    horarios: list[Horario] = Field(default_factory=list)

class MateriaInscriptaItem(Schema):
    inscripcion_id: int
    materia_id: int
    materia_nombre: str
    plan_id: int | None = None
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    anio_plan: int
    anio_academico: int
    estado: InscripcionEstadoType
    estado_display: str
    comision_actual: ComisionResumen | None = None
    comision_solicitada: ComisionResumen | None = None
    fecha_creacion: str
    fecha_actualizacion: str

class InscripcionMateriaOut(Schema):
    message: str
    inscripcion_id: int | None = None
    estado: InscripcionEstadoType | None = None
    comision_asignada: ComisionResumen | None = None
    comision_solicitada: ComisionResumen | None = None
    conflictos: list[dict] = Field(default_factory=list)
    alternativas: list[ComisionResumen] = Field(default_factory=list)

InscripcionMateriaOut.model_rebuild()


CambioComisionOut = InscripcionMateriaOut
