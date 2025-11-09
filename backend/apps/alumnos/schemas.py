from typing import Any, Literal

from ninja import Schema
from pydantic import Field


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


class CambioComisionIn(Schema):
    inscripcion_id: int
    comision_id: int


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


class MesaResultadoAlumno(Schema):
    inscripcion_id: int
    alumno_id: int
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
    tipo: str
    modalidad: str
    fecha: str
    condiciones: list[dict[str, object]]
    alumnos: list[MesaResultadoAlumno]


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
    alumnos: list[MesaResultadoIn]


# Regularidad (importación por planilla)
class RegularidadRowIn(Schema):
    dni: str
    nombre: str | None = None
    nota_final: int | None = None
    situacion: str  # texto tal como en planilla (REGULAR, LIBRE-AT, etc.)


class RegularidadImportIn(Schema):
    materia_id: int
    fecha: str  # YYYY-MM-DD
    formato: Literal["ASIG", "MOD", "TAL"]
    filas: list[RegularidadRowIn]


class RegularidadItemOut(Schema):
    dni: str
    nombre: str | None
    materia_id: int
    fecha: str
    nota_final: int | None
    situacion: str


# Nuevos schemas para materias-plan e historial
class Horario(Schema):
    dia: str
    desde: str
    hasta: str


Cuatrimestre = Literal["ANUAL", "1C", "2C"]


class MateriaPlan(Schema):
    id: int
    nombre: str
    anio: int
    cuatrimestre: Cuatrimestre
    horarios: list[Horario] = []
    correlativas_regular: list[int] = []
    correlativas_aprob: list[int] = []
    profesorado: str | None = None
    profesorado_id: int | None = None
    plan_id: int | None = None


class HistorialAlumno(Schema):
    aprobadas: list[int] = []
    regularizadas: list[int] = []
    inscriptas_actuales: list[int] = []


InscripcionEstado = Literal["CONF", "PEND", "RECH", "ANUL"]


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
    horarios: list[Horario] = []


class MateriaInscriptaItem(Schema):
    inscripcion_id: int
    materia_id: int
    materia_nombre: str
    plan_id: int | None = None
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    anio_plan: int
    anio_academico: int
    estado: InscripcionEstado
    estado_display: str
    comision_actual: ComisionResumen | None = None
    comision_solicitada: ComisionResumen | None = None
    fecha_creacion: str
    fecha_actualizacion: str


class InscripcionMateriaOut(Schema):
    message: str
    inscripcion_id: int | None = None
    estado: InscripcionEstado | None = None
    comision_asignada: ComisionResumen | None = None
    comision_solicitada: ComisionResumen | None = None
    conflictos: list[dict] = []
    alternativas: list[ComisionResumen] = []


CambioComisionOut = InscripcionMateriaOut


class EquivalenciaItem(Schema):
    materia_id: int
    materia_nombre: str
    plan_id: int | None = None
    profesorado_id: int | None = None
    profesorado: str
    cuatrimestre: Cuatrimestre
    horarios: list[Horario] = []
    comisiones: list[ComisionResumen] = []


class PedidoAnaliticoIn(Schema):
    motivo: Literal["equivalencia", "beca", "control", "otro"]
    motivo_otro: str | None = None
    dni: str | None = None  # para que bedel/secretaría/admin soliciten por alumno
    cohorte: int | None = None
    profesorado_id: int | None = None
    plan_id: int | None = None


class PedidoAnaliticoOut(Schema):
    message: str


class PedidoAnaliticoItem(Schema):
    dni: str
    apellido_nombre: str
    profesorado: str | None
    anio_cursada: int | None = None  # placeholder
    cohorte: int | None
    fecha_solicitud: str  # ISO
    motivo: str
    motivo_otro: str | None = None


class RegularidadResumen(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    situacion: str
    situacion_display: str
    fecha_cierre: str
    nota_tp: float | None = None
    nota_final: int | None = None
    asistencia: int | None = None
    excepcion: bool = False
    observaciones: str | None = None
    vigencia_hasta: str | None = None
    vigente: bool | None = None
    dias_restantes: int | None = None


class EstudianteAdminDocumentacion(Schema):
    dni_legalizado: bool | None = None
    fotos_4x4: bool | None = None
    certificado_salud: bool | None = None
    folios_oficio: int | None = None
    titulo_secundario_legalizado: bool | None = None
    certificado_titulo_en_tramite: bool | None = None
    analitico_legalizado: bool | None = None
    certificado_alumno_regular_sec: bool | None = None
    adeuda_materias: bool | None = None
    adeuda_materias_detalle: str | None = None
    escuela_secundaria: str | None = None
    es_certificacion_docente: bool | None = None
    titulo_terciario_univ: bool | None = None


class EstudianteAdminListItem(Schema):
    dni: str
    apellido: str
    nombre: str
    email: str | None = None
    telefono: str | None = None
    estado_legajo: str
    estado_legajo_display: str
    carreras: list[str]
    legajo: str | None = None


class EstudianteAdminListResponse(Schema):
    total: int
    items: list[EstudianteAdminListItem]


class EstudianteAdminDetail(Schema):
    dni: str
    apellido: str
    nombre: str
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    fecha_nacimiento: str | None = None
    estado_legajo: str
    estado_legajo_display: str
    must_change_password: bool
    carreras: list[str]
    legajo: str | None = None
    datos_extra: dict[str, Any] = {}
    documentacion: EstudianteAdminDocumentacion | None = None
    condicion_calculada: str | None = None
    curso_introductorio_aprobado: bool | None = None
    libreta_entregada: bool | None = None
    regularidades: list[RegularidadResumen] = Field(default_factory=list)


class EstudianteAdminUpdateIn(Schema):
    telefono: str | None = None
    domicilio: str | None = None
    estado_legajo: str | None = Field(default=None, pattern="^(COM|INC|PEN)$", description="COM, INC o PEN")
    must_change_password: bool | None = None
    fecha_nacimiento: str | None = None  # dd/mm/yyyy o yyyy-mm-dd
    documentacion: EstudianteAdminDocumentacion | None = None
    anio_ingreso: str | None = None
    genero: str | None = None
    rol_extra: str | None = None
    observaciones: str | None = None
    cuil: str | None = None
    curso_introductorio_aprobado: bool | None = None
    libreta_entregada: bool | None = None


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
    regularidad: CartonEvento | None = None
    final: CartonEvento | None = None


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
    desde: str
    hasta: str


class HorarioCelda(Schema):
    dia_numero: int
    franja_orden: int
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
