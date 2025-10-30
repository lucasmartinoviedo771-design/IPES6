from ninja import Schema
from typing import Optional, List, Literal, Dict
from pydantic import Field

class InscripcionCarreraIn(Schema):
    carrera_id: int

class InscripcionCarreraOut(Schema):
    message: str

class InscripcionMateriaIn(Schema):
    materia_id: int
    comision_id: Optional[int] = None
    dni: Optional[str] = None

class CancelarInscripcionIn(Schema):
    dni: Optional[str] = None

class CambioComisionIn(Schema):
    inscripcion_id: int
    comision_id: int

class PedidoAnaliticoOut(Schema):
    message: str

class MesaExamenIn(Schema):
    materia_id: int
    tipo_examen: str # parcial, final, libre, extraordinaria

class MesaExamenOut(Schema):
    message: str

class InscripcionMesaIn(Schema):
    mesa_id: int
    dni: Optional[str] = None

class InscripcionMesaOut(Schema):
    message: str

class MesaResultadoAlumno(Schema):
    inscripcion_id: int
    alumno_id: int
    dni: str
    apellido_nombre: str
    condicion: Optional[str] = None
    condicion_display: Optional[str] = None
    nota: Optional[float] = None
    folio: Optional[str] = None
    libro: Optional[str] = None
    fecha_resultado: Optional[str] = None
    cuenta_para_intentos: bool = True
    observaciones: Optional[str] = None

class MesaPlanillaOut(Schema):
    mesa_id: int
    materia_id: int
    materia_nombre: str
    tipo: str
    modalidad: str
    fecha: str
    condiciones: List[Dict[str, object]]
    alumnos: List[MesaResultadoAlumno]

class MesaResultadoIn(Schema):
    inscripcion_id: int
    fecha_resultado: Optional[str] = None
    condicion: Optional[str] = None
    nota: Optional[float] = None
    folio: Optional[str] = None
    libro: Optional[str] = None
    observaciones: Optional[str] = None
    cuenta_para_intentos: Optional[bool] = None

class MesaPlanillaUpdateIn(Schema):
    alumnos: List[MesaResultadoIn]

# Regularidad (importación por planilla)
class RegularidadRowIn(Schema):
    dni: str
    nombre: Optional[str] = None
    nota_final: Optional[int] = None
    situacion: str  # texto tal como en planilla (REGULAR, LIBRE-AT, etc.)

class RegularidadImportIn(Schema):
    materia_id: int
    fecha: str  # YYYY-MM-DD
    formato: Literal['ASIG', 'MOD', 'TAL']
    filas: List[RegularidadRowIn]

class RegularidadItemOut(Schema):
    dni: str
    nombre: Optional[str]
    materia_id: int
    fecha: str
    nota_final: Optional[int]
    situacion: str

# Nuevos schemas para materias-plan e historial
class Horario(Schema):
    dia: str
    desde: str
    hasta: str

Cuatrimestre = Literal['ANUAL','1C','2C']

class MateriaPlan(Schema):
    id: int
    nombre: str
    anio: int
    cuatrimestre: Cuatrimestre
    horarios: List[Horario] = []
    correlativas_regular: List[int] = []
    correlativas_aprob: List[int] = []
    profesorado: Optional[str] = None

class HistorialAlumno(Schema):
    aprobadas: List[int] = []
    regularizadas: List[int] = []
    inscriptas_actuales: List[int] = []


InscripcionEstado = Literal['CONF', 'PEND', 'RECH', 'ANUL']


class ComisionResumen(Schema):
    id: int
    codigo: str
    anio_lectivo: int
    turno_id: int
    turno: str
    materia_id: int
    materia_nombre: str
    plan_id: Optional[int] = None
    profesorado_id: Optional[int] = None
    profesorado_nombre: Optional[str] = None
    docente: Optional[str] = None
    cupo_maximo: Optional[int] = None
    estado: str
    horarios: List[Horario] = []


class MateriaInscriptaItem(Schema):
    inscripcion_id: int
    materia_id: int
    materia_nombre: str
    plan_id: Optional[int] = None
    profesorado_id: Optional[int] = None
    profesorado_nombre: Optional[str] = None
    anio_plan: int
    anio_academico: int
    estado: InscripcionEstado
    estado_display: str
    comision_actual: Optional[ComisionResumen] = None
    comision_solicitada: Optional[ComisionResumen] = None
    fecha_creacion: str
    fecha_actualizacion: str


class InscripcionMateriaOut(Schema):
    message: str
    inscripcion_id: Optional[int] = None
    estado: Optional[InscripcionEstado] = None
    comision_asignada: Optional[ComisionResumen] = None
    comision_solicitada: Optional[ComisionResumen] = None
    conflictos: List[dict] = []
    alternativas: List[ComisionResumen] = []


CambioComisionOut = InscripcionMateriaOut


class EquivalenciaItem(Schema):
    materia_id: int
    materia_nombre: str
    plan_id: Optional[int] = None
    profesorado_id: Optional[int] = None
    profesorado: str
    cuatrimestre: Cuatrimestre
    horarios: List[Horario] = []
    comisiones: List[ComisionResumen] = []

class PedidoAnaliticoIn(Schema):
    motivo: Literal['equivalencia','beca','control','otro']
    motivo_otro: Optional[str] = None
    dni: Optional[str] = None  # para que bedel/secretaría/admin soliciten por alumno
    cohorte: Optional[int] = None

class PedidoAnaliticoOut(Schema):
    message: str

class PedidoAnaliticoItem(Schema):
    dni: str
    apellido_nombre: str
    profesorado: Optional[str]
    anio_cursada: Optional[int] = None  # placeholder
    cohorte: Optional[int]
    fecha_solicitud: str  # ISO
    motivo: str
    motivo_otro: Optional[str] = None

EventoTipo = Literal['preinscripcion', 'inscripcion_materia', 'regularidad', 'mesa', 'tramite', 'nota']

class TrayectoriaEvento(Schema):
    id: str
    tipo: EventoTipo
    fecha: str
    titulo: str
    subtitulo: Optional[str] = None
    detalle: Optional[str] = None
    estado: Optional[str] = None
    metadata: Dict[str, str] = Field(default_factory=dict)

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
    aula: Optional[str] = None
    nota: Optional[str] = None

class RegularidadResumen(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    situacion: str
    situacion_display: str
    fecha_cierre: str
    nota_tp: Optional[float] = None
    nota_final: Optional[int] = None
    asistencia: Optional[int] = None
    excepcion: bool = False
    observaciones: Optional[str] = None
    vigencia_hasta: Optional[str] = None
    vigente: Optional[bool] = None
    dias_restantes: Optional[int] = None

class MateriaSugerida(Schema):
    materia_id: int
    materia_nombre: str
    anio: int
    cuatrimestre: str
    motivos: List[str] = Field(default_factory=list)
    alertas: List[str] = Field(default_factory=list)

class FinalHabilitado(Schema):
    materia_id: int
    materia_nombre: str
    regularidad_fecha: str
    vigencia_hasta: Optional[str] = None
    dias_restantes: Optional[int] = None
    comentarios: List[str] = Field(default_factory=list)

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

class EstudianteResumen(Schema):
    dni: str
    legajo: Optional[str] = None
    apellido_nombre: str
    carreras: List[str] = Field(default_factory=list)
    email: Optional[str] = None
    telefono: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    lugar_nacimiento: Optional[str] = None
    curso_introductorio: Optional[str] = None
    promedio_general: Optional[str] = None
    libreta_entregada: Optional[bool] = None
    legajo_estado: Optional[str] = None
    cohorte: Optional[str] = None
    activo: Optional[bool] = None
    materias_totales: Optional[int] = None
    materias_aprobadas: Optional[int] = None
    materias_regularizadas: Optional[int] = None
    materias_en_curso: Optional[int] = None
    fotoUrl: Optional[str] = None

class RecomendacionesOut(Schema):
    materias_sugeridas: List[MateriaSugerida] = Field(default_factory=list)
    finales_habilitados: List[FinalHabilitado] = Field(default_factory=list)
    alertas: List[str] = Field(default_factory=list)

class CartonEvento(Schema):
    fecha: Optional[str] = None
    condicion: Optional[str] = None
    nota: Optional[str] = None
    folio: Optional[str] = None
    libro: Optional[str] = None
    id_fila: Optional[int] = None

class CartonMateria(Schema):
    materia_id: int
    materia_nombre: str
    anio: Optional[int] = None
    regimen: Optional[str] = None
    regimen_display: Optional[str] = None
    regularidad: Optional[CartonEvento] = None
    final: Optional[CartonEvento] = None

class CartonPlan(Schema):
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    materias: List[CartonMateria] = Field(default_factory=list)

class TrayectoriaOut(Schema):
    estudiante: EstudianteResumen
    historial: List[TrayectoriaEvento] = Field(default_factory=list)
    mesas: List[TrayectoriaMesa] = Field(default_factory=list)
    regularidades: List[RegularidadResumen] = Field(default_factory=list)
    recomendaciones: RecomendacionesOut
    regularidades_vigencia: List[RegularidadVigenciaOut] = Field(default_factory=list)
    aprobadas: List[int] = Field(default_factory=list)
    regularizadas: List[int] = Field(default_factory=list)
    inscriptas_actuales: List[int] = Field(default_factory=list)
    carton: List[CartonPlan] = Field(default_factory=list)
    updated_at: str
