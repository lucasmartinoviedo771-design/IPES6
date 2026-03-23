from datetime import date
from typing import Literal

from ninja import Schema, Field

# ==========================================
# 5. REGULARIDAD (PLANILLA Y CARGA)
# ==========================================

# -- Schemas para la API de Carga de Regularidad (Docentes/Admin) --
class RegularidadEstudianteOut(Schema):
    inscripcion_id: int
    estudiante_id: int
    orden: int
    apellido_nombre: str
    dni: str
    nota_tp: float | None = None
    nota_final: int | None = None
    asistencia: int | None = None
    excepcion: bool = False
    situacion: str | None = None
    observaciones: str | None = None
    correlativas_caidas: list[str] = Field(default_factory=list)

class RegularidadPlanillaOut(Schema):
    materia_id: int
    materia_nombre: str
    materia_anio: int | None = None
    formato: str
    regimen: str | None = None
    comision_id: int
    comision_codigo: str
    anio: int
    turno: str
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    plan_id: int | None = None
    plan_resolucion: str | None = None
    docentes: list[str] = Field(default_factory=list)
    fecha_cierre: date | None = None
    esta_cerrada: bool = False
    cerrada_en: str | None = None
    cerrada_por: str | None = None
    puede_editar: bool = True
    puede_cerrar: bool = True
    puede_reabrir: bool = False
    situaciones: list[dict] = Field(default_factory=list)
    estudiantes: list[RegularidadEstudianteOut] = Field(default_factory=list)

RegularidadPlanillaOut.model_rebuild()


class RegularidadEstudianteIn(Schema):
    inscripcion_id: int
    nota_tp: float | None = None
    nota_final: int | None = None
    asistencia: int | None = None
    excepcion: bool = False
    situacion: str
    observaciones: str | None = None

class RegularidadCargaIn(Schema):
    comision_id: int
    fecha_cierre: date | None = None
    estudiantes: list[RegularidadEstudianteIn] = Field(default_factory=list)
    observaciones_generales: str | None = None

class RegularidadCierreIn(Schema):
    comision_id: int
    accion: Literal["cerrar", "reabrir"]

# -- Schemas para Importación por Planilla (Legacy/Admin) --
class RegularidadRowIn(Schema):
    dni: str
    nombre: str | None = None
    nota_final: int | None = None
    situacion: str

class RegularidadImportIn(Schema):
    materia_id: int
    fecha: str
    formato: Literal["ASIG", "MOD", "TAL"]
    filas: list[RegularidadRowIn] = Field(default_factory=list)

class RegularidadItemOut(Schema):
    dni: str
    nombre: str | None
    materia_id: int
    fecha: str
    nota_final: int | None
    situacion: str
