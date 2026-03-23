from typing import Literal

from ninja import Schema, Field

# ==========================================
# 2. MESAS DE EXAMEN (ALUMNOS)
# ==========================================

class MesaExamenIn(Schema):
    materia_id: int
    tipo_examen: str  # parcial, final, libre, extraordinaria

class MesaExamenOut(Schema):
    message: str

class InscripcionMesaIn(Schema):
    mesa_id: int
    dni: str | None = None

class InscripcionMesaOut(Schema):
    message: str

class ConstanciaExamenItem(Schema):
    inscripcion_id: int
    estudiante: str
    dni: str
    materia: str
    materia_anio: int | None = None
    profesorado: str | None = None
    profesorado_id: int | None = None
    plan_resolucion: str | None = None
    mesa_codigo: str | None = None
    mesa_fecha: str
    mesa_hora_desde: str | None = None
    mesa_hora_hasta: str | None = None
    mesa_tipo: str
    mesa_modalidad: str
    condicion: str
    condicion_display: str
    nota: str | None = None
    folio: str | None = None
    libro: str | None = None
    tribunal_presidente: str | None = None
    tribunal_vocal1: str | None = None
    tribunal_vocal2: str | None = None

# ==========================================
# 4. GESTIÓN DE MESAS (PLANILLA)
# ==========================================

class MesaResultadoEstudiante(Schema):
    inscripcion_id: int
    estudiante_id: int
    dni: str
    apellido_nombre: str
    condicion: str | None = None
    condicion_display: str | None = None
    nota: float | None = None
    folio: str | None = None
    libro: str | None = None
    fecha_resultado: str | None = None
    cuenta_para_intentos: bool = True
    observaciones: str | None = None

class MesaPlanillaOut(Schema):
    mesa_id: int
    materia_id: int
    materia_nombre: str
    materia_anio: int | None = None
    regimen: str | None = None
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    plan_id: int | None = None
    plan_resolucion: str | None = None
    tipo: str
    modalidad: str
    fecha: str
    hora_desde: str | None = None
    hora_hasta: str | None = None
    mesa_codigo: str | None = None
    tribunal_presidente: str | None = None
    tribunal_vocal1: str | None = None
    tribunal_vocal2: str | None = None
    condiciones: list[dict[str, object]] = Field(default_factory=list)
    estudiantes: list[MesaResultadoEstudiante] = Field(default_factory=list)
    esta_cerrada: bool = False
    cerrada_en: str | None = None
    cerrada_por: str | None = None
    puede_editar: bool = True
    puede_cerrar: bool = True
    puede_reabrir: bool = False

MesaPlanillaOut.model_rebuild()


class MesaResultadoIn(Schema):
    inscripcion_id: int
    fecha_resultado: str | None = None
    condicion: str | None = None
    nota: float | None = None
    folio: str | None = None
    libro: str | None = None
    observaciones: str | None = None
    cuenta_para_intentos: bool | None = None

class MesaPlanillaUpdateIn(Schema):
    estudiantes: list[MesaResultadoIn]

class MesaPlanillaCierreIn(Schema):
    accion: Literal["cerrar", "reabrir"]
