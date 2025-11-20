from datetime import date
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
    condiciones: list[dict[str, object]]
    alumnos: list[MesaResultadoAlumno]
    esta_cerrada: bool = False
    cerrada_en: str | None = None
    cerrada_por: str | None = None
    puede_editar: bool = True
    puede_cerrar: bool = True
    puede_reabrir: bool = False


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


class MesaPlanillaCierreIn(Schema):
    accion: Literal["cerrar", "reabrir"]

class ConstanciaExamenItem(Schema):
    inscripcion_id: int
    alumno: str
    dni: str
    materia: str
    materia_anio: int | None = None
    profesorado: str | None = None
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
    profesorados: list[dict]
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


class CursoIntroAutoInscripcionIn(Schema):
    cohorte_id: int
    profesorado_id: int | None = None
    turno_id: int | None = None


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


class PedidoEquivalenciaMateriaIn(Schema):
    nombre: str = Field(..., min_length=1)
    formato: str | None = None
    anio_cursada: str | None = None
    nota: str | None = None


class PedidoEquivalenciaSaveIn(Schema):
    tipo: Literal["ANEXO_A", "ANEXO_B"]
    ciclo_lectivo: str | None = None
    profesorado_destino_id: int | None = None
    profesorado_destino_nombre: str | None = None
    plan_destino_id: int | None = None
    plan_destino_resolucion: str | None = None
    profesorado_origen_nombre: str | None = None
    plan_origen_resolucion: str | None = None
    establecimiento_origen: str | None = None
    establecimiento_localidad: str | None = None
    establecimiento_provincia: str | None = None
    materias: list[PedidoEquivalenciaMateriaIn] = Field(default_factory=list)


class PedidoEquivalenciaMateriaOut(Schema):
    id: int
    nombre: str
    formato: str | None = None
    anio_cursada: str | None = None
    nota: str | None = None
    resultado: Literal["pendiente", "otorgada", "rechazada"] | None = None
    observaciones: str | None = None


class PedidoEquivalenciaTimeline(Schema):
    formulario_descargado_en: str | None = None
    inscripcion_verificada_en: str | None = None
    documentacion_registrada_en: str | None = None
    evaluacion_registrada_en: str | None = None
    titulos_registrado_en: str | None = None
    notificado_en: str | None = None


class PedidoEquivalenciaOut(Schema):
    id: int
    tipo: Literal["ANEXO_A", "ANEXO_B"]
    estado: Literal["draft", "final"]
    estado_display: str
    workflow_estado: Literal["draft", "pending_docs", "review", "titulos", "notified"]
    workflow_estado_display: str
    ciclo_lectivo: str | None = None
    profesorado_destino_id: int | None = None
    profesorado_destino_nombre: str | None = None
    plan_destino_id: int | None = None
    plan_destino_resolucion: str | None = None
    profesorado_origen_nombre: str | None = None
    plan_origen_resolucion: str | None = None
    establecimiento_origen: str | None = None
    establecimiento_localidad: str | None = None
    establecimiento_provincia: str | None = None
    ventana_id: int
    ventana_label: str
    created_at: str
    updated_at: str
    bloqueado_en: str | None = None
    puede_editar: bool = False
    estudiante_dni: str
    estudiante_nombre: str | None = None
    requiere_tutoria: bool = False
    documentacion_presentada: bool = False
    documentacion_detalle: str | None = None
    documentacion_cantidad: int | None = None
    documentacion_registrada_en: str | None = None
    evaluacion_observaciones: str | None = None
    evaluacion_registrada_en: str | None = None
    resultado_final: Literal["pendiente", "otorgada", "denegada", "mixta"]
    titulos_documento_tipo: Literal["ninguno", "nota", "disposicion", "ambos"]
    titulos_nota_numero: str | None = None
    titulos_nota_fecha: str | None = None
    titulos_disposicion_numero: str | None = None
    titulos_disposicion_fecha: str | None = None
    titulos_observaciones: str | None = None
    titulos_registrado_en: str | None = None
    materias: list[PedidoEquivalenciaMateriaOut] = Field(default_factory=list)
    timeline: PedidoEquivalenciaTimeline | None = None


class PedidoEquivalenciaDocumentacionIn(Schema):
    presentada: bool
    cantidad: int | None = None
    detalle: str | None = None


class PedidoEquivalenciaEvaluacionMateriaIn(Schema):
    id: int
    resultado: Literal["otorgada", "rechazada"]
    observaciones: str | None = None


class PedidoEquivalenciaEvaluacionIn(Schema):
    materias: list[PedidoEquivalenciaEvaluacionMateriaIn]
    observaciones: str | None = None


class PedidoEquivalenciaTitulosIn(Schema):
    nota_numero: str | None = None
    nota_fecha: str | None = None
    disposicion_numero: str | None = None
    disposicion_fecha: str | None = None
    observaciones: str | None = None


class PedidoEquivalenciaNotificarIn(Schema):
    mensaje: str | None = None


class EquivalenciaDisposicionDetalleIn(Schema):
    materia_id: int
    nota: str


class EquivalenciaDisposicionDetalleOut(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    nota: str


class EquivalenciaDisposicionCreateIn(Schema):
    dni: str
    profesorado_id: int
    plan_id: int
    numero_disposicion: str
    fecha_disposicion: date
    observaciones: str | None = None
    detalles: list[EquivalenciaDisposicionDetalleIn]


class EquivalenciaDisposicionOut(Schema):
    id: int
    origen: Literal["primera_carga", "secretaria"]
    numero_disposicion: str
    fecha_disposicion: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    observaciones: str | None = None
    creado_por: str | None = None
    creado_en: str
    detalles: list[EquivalenciaDisposicionDetalleOut] = Field(default_factory=list)


class EquivalenciaMateriaPendiente(Schema):
    id: int
    nombre: str
    anio: int
    plan_id: int


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
    incumbencia: bool | None = None


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
    email: str | None = None
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
    formato: str | None = None
    formato_display: str | None = None
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
