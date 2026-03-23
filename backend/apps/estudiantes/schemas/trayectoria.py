from typing import Literal

from ninja import Schema, Field

from apps.estudiantes.schemas.regularidad import RegularidadEstudianteOut
from apps.estudiantes.schemas.estudiantes_admin import RegularidadResumen

# ==========================================
# 12. TRAYECTORIA Y PERFIL
# ==========================================

EventoTipo = Literal["preinscripcion", "inscripcion_materia", "regularidad", "mesa", "tramite", "nota"]

class TrayectoriaEvento(Schema):
    id: str
    tipo: EventoTipo
    fecha: str
    titulo: str
    subtitulo: str | None = None
    detalle: str | None = None
    estado: str | None = None
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    metadata: dict[str, str] = Field(default_factory=dict)

class TrayectoriaMesa(Schema):
    id: int
    mesa_id: int
    materia_id: int
    materia_nombre: str
    tipo: str
    tipo_display: str
    fecha: str
    estado: str
    estado_display: str
    aula: str | None = None
    nota: str | None = None

class MateriaSugerida(Schema):
    materia_id: int
    materia_nombre: str
    anio: int
    cuatrimestre: str
    motivos: list[str] = Field(default_factory=list)
    alertas: list[str] = Field(default_factory=list)

class FinalHabilitado(Schema):
    materia_id: int
    materia_nombre: str
    regularidad_fecha: str
    vigencia_hasta: str | None = None
    dias_restantes: int | None = None
    comentarios: list[str] = Field(default_factory=list)
    correlativas_aprobadas: list[str] = Field(default_factory=list)

class RegularidadVigenciaOut(Schema):
    materia_id: int
    materia_nombre: str
    situacion: str
    situacion_display: str
    fecha_cierre: str
    vigencia_hasta: str
    dias_restantes: int
    vigente: bool
    intentos_usados: int
    intentos_max: int

class CarreraPlanResumen(Schema):
    id: int
    resolucion: str | None = None
    vigente: bool = False

class CarreraDetalleResumen(Schema):
    profesorado_id: int
    nombre: str
    planes: list[CarreraPlanResumen] = Field(default_factory=list)

class EstudianteResumen(Schema):
    dni: str
    legajo: str | None = None
    apellido_nombre: str
    carreras: list[str] = Field(default_factory=list)
    carreras_detalle: list[CarreraDetalleResumen] = Field(default_factory=list)
    email: str | None = None
    telefono: str | None = None
    fecha_nacimiento: str | None = None
    lugar_nacimiento: str | None = None
    curso_introductorio: str | None = None
    promedio_general: str | None = None
    libreta_entregada: bool | None = None
    legajo_estado: str | None = None
    cohorte: str | None = None
    activo: bool | None = None
    materias_totales: int | None = None
    materias_aprobadas: int | None = None
    materias_regularizadas: int | None = None
    materias_en_curso: int | None = None
    fotoUrl: str | None = None

class RecomendacionesOut(Schema):
    materias_sugeridas: list[MateriaSugerida] = Field(default_factory=list)
    finales_habilitados: list[FinalHabilitado] = Field(default_factory=list)
    alertas: list[str] = Field(default_factory=list)

class CartonEvento(Schema):
    fecha: str | None = None
    fecha_iso: str | None = None
    condicion: str | None = None
    nota: str | None = None
    folio: str | None = None
    libro: str | None = None
    id_fila: int | None = None

class CartonMateria(Schema):
    materia_id: int
    materia_nombre: str
    anio: int | None = None
    regimen: str | None = None
    regimen_display: str | None = None
    formato: str | None = None
    formato_display: str | None = None
    regularidad: CartonEvento | None = None
    regularidades: list[CartonEvento] = Field(default_factory=list)
    final: CartonEvento | None = None
    finales: list[CartonEvento] = Field(default_factory=list)

class CartonPlan(Schema):
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    materias: list[CartonMateria] = Field(default_factory=list)

class TrayectoriaOut(Schema):
    estudiante: EstudianteResumen
    historial: list[TrayectoriaEvento] = Field(default_factory=list)
    mesas: list[TrayectoriaMesa] = Field(default_factory=list)
    regularidades: list[RegularidadResumen] = Field(default_factory=list)
    recomendaciones: RecomendacionesOut
    regularidades_vigencia: list[RegularidadVigenciaOut] = Field(default_factory=list)
    aprobadas: list[int] = Field(default_factory=list)
    regularizadas: list[int] = Field(default_factory=list)
    inscriptas_actuales: list[int] = Field(default_factory=list)
    carton: list[CartonPlan] = Field(default_factory=list)
    updated_at: str

TrayectoriaOut.model_rebuild()


# ==========================================
# 13. HORARIOS (GRILLA)
# ==========================================

class HorarioMateriaCelda(Schema):
    materia_id: int
    materia_nombre: str
    comisiones: list[str] = Field(default_factory=list)
    docentes: list[str] = Field(default_factory=list)
    observaciones: str | None = None
    regimen: str
    cuatrimestre: str | None = None
    es_cuatrimestral: bool = False

class HorarioDia(Schema):
    numero: int
    nombre: str

class HorarioFranja(Schema):
    orden: int
    posicion: int = 0
    desde: str
    hasta: str
    es_recreo: bool = False
    desde_sec: str | None = None
    hasta_sec: str | None = None

class HorarioCelda(Schema):
    dia_numero: int
    franja_orden: int
    franja_posicion: int = 0
    dia: str
    desde: str
    hasta: str
    materias: list[HorarioMateriaCelda] = Field(default_factory=list)

class HorarioTabla(Schema):
    key: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str | None = None
    anio_plan: int
    anio_plan_label: str
    turno_id: int
    turno_nombre: str
    cuatrimestres: list[str] = Field(default_factory=list)
    dias: list[HorarioDia] = Field(default_factory=list)
    franjas: list[HorarioFranja] = Field(default_factory=list)
    celdas: list[HorarioCelda] = Field(default_factory=list)
    observaciones: str | None = None

HorarioTabla.model_rebuild()
