from datetime import date

from ninja import Schema, Field

# ==========================================
# 8. CURSO INTRODUCTORIO
# ==========================================

class CursoIntroCohorteIn(Schema):
    nombre: str | None = None
    anio_academico: int
    profesorado_id: int | None = None
    turno_id: int | None = None
    ventana_id: int | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    cupo: int | None = None
    observaciones: str | None = None

class CursoIntroCohorteOut(Schema):
    id: int
    nombre: str | None = None
    anio_academico: int
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    turno_id: int | None = None
    turno_nombre: str | None = None
    ventana_id: int | None = None
    ventana_tipo: str | None = None
    fecha_inicio: str | None = None
    fecha_fin: str | None = None
    cupo: int | None = None
    observaciones: str | None = None

class CursoIntroRegistroOut(Schema):
    id: int
    estudiante_id: int
    estudiante_nombre: str
    estudiante_dni: str
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    cohorte_id: int | None = None
    cohorte_nombre: str | None = None
    turno_id: int | None = None
    turno_nombre: str | None = None
    resultado: str
    resultado_display: str
    asistencias_totales: int | None = None
    nota_final: float | None = None
    observaciones: str | None = None
    es_historico: bool
    resultado_at: str | None = None

class CursoIntroRegistroIn(Schema):
    cohorte_id: int | None = None
    estudiante_id: int
    profesorado_id: int | None = None
    turno_id: int | None = None

class CursoIntroAsistenciaIn(Schema):
    asistencias_totales: int = Field(ge=0, le=100)

class CursoIntroCierreIn(Schema):
    nota_final: float | None = Field(default=None, ge=1, le=10)
    asistencias_totales: int | None = Field(default=None, ge=0, le=100)
    resultado: str
    observaciones: str | None = None

class CursoIntroPendienteOut(Schema):
    estudiante_id: int
    estudiante_dni: str
    estudiante_nombre: str
    profesorados: list[dict] = Field(default_factory=list)
    anio_ingreso: int | None = None

class CursoIntroVentanaOut(Schema):
    id: int
    desde: str
    hasta: str
    activo: bool
    periodo: str | None = None

class CursoIntroEstadoOut(Schema):
    aprobado: bool
    registro_actual: CursoIntroRegistroOut | None = None
    cohortes_disponibles: list[CursoIntroCohorteOut] = Field(default_factory=list)
    ventanas: list[CursoIntroVentanaOut] = Field(default_factory=list)

CursoIntroEstadoOut.model_rebuild()


class CursoIntroAutoInscripcionIn(Schema):
    cohorte_id: int
    profesorado_id: int | None = None
    turno_id: int | None = None
