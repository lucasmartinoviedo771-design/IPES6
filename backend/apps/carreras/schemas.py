"""
Esquemas de validación (Pydantic/Ninja) para el módulo de Carreras.
Define las estructuras de datos para la gestión administrativa de profesorados,
asignaturas, planes de estudio, comisiones y reglas de correlatividad.
"""

from ninja import Schema


# --- PROFESORADOS (CARRERAS) ---

class ProfesoradoIn(Schema):
    """Payload para la creación o actualización de un Profesorado."""
    nombre: str
    duracion_anios: int
    activo: bool = True
    inscripcion_abierta: bool = True
    es_certificacion_docente: bool = False


class ProfesoradoOut(Schema):
    """Información pública/administrativa de un Profesorado."""
    id: int
    nombre: str
    duracion_anios: int
    activo: bool
    inscripcion_abierta: bool
    es_certificacion_docente: bool


# --- PLANES DE ESTUDIO ---

class PlanDeEstudioIn(Schema):
    """Datos de una resolución ministerial que define un Plan de Estudio."""
    resolucion: str
    anio_inicio: int
    anio_fin: int | None = None
    vigente: bool = True


class PlanDeEstudioOut(Schema):
    """Detalle de un Plan de Estudio registrado."""
    id: int
    profesorado_id: int
    resolucion: str
    anio_inicio: int
    anio_fin: int | None
    vigente: bool


class PlanDeEstudioOverview(Schema):
    """Resumen estadístico de un plan (utilizado en dashboards)."""
    id: int
    resolucion: str
    vigente: bool
    num_materias: int


# --- MATERIAS (ASIGNATURAS) ---

class MateriaIn(Schema):
    """Definición técnica de una materia dentro de un plan."""
    plan_de_estudio_id: int
    nombre: str
    anio_cursada: int
    formato: str
    regimen: str
    tipo_formacion: str
    horas_semana: int = 0


class MateriaOut(Schema):
    """Información completa de una asignatura."""
    id: int
    plan_de_estudio_id: int
    nombre: str
    anio_cursada: int
    formato: str
    regimen: str
    tipo_formacion: str
    horas_semana: int


# --- DOCUMENTACIÓN DE INGRESO ---

class RequisitoDocumentacionOut(Schema):
    """Requisito administrativo obligatorio para el legajo del alumno."""
    id: int
    codigo: str
    titulo: str
    descripcion: str
    categoria: str
    obligatorio: bool
    orden: int
    activo: bool


# --- COMISIONES Y CURSADAS ---

class ComisionIn(Schema):
    """Payload para la gestión manual de una comisión."""
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: int
    docente_id: int | None = None
    horario_id: int | None = None
    cupo_maximo: int | None = None
    observaciones: str | None = None
    estado: str | None = None
    rol: str | None = None
    orden: int | None = 1


class ComisionOut(Schema):
    """Detalle de una comisión con información de docente y turno."""
    id: int
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: int
    docente_id: int | None = None
    docente_nombre: str | None = None
    horario_id: int | None = None
    cupo_maximo: int | None = None
    observaciones: str | None = None
    estado: str | None = None
    rol: str | None = None
    orden: int | None = 1


class ComisionBulkGenerateIn(Schema):
    """Parámetros para la generación automatizada de comisiones por plan."""
    plan_id: int
    anio_lectivo: int
    turnos: list[int] | None = None
    cantidad: int = 1
    estado: str | None = None


# --- CORRELATIVIDADES ---

class CorrelatividadSetIn(Schema):
    """Set de IDs de materias correlativas para actualización masiva."""
    regular_para_cursar: list[int] = []
    aprobada_para_cursar: list[int] = []
    aprobada_para_rendir: list[int] = []


class CorrelatividadSetOut(Schema):
    """Representación de las reglas de correlatividad vigentes."""
    regular_para_cursar: list[int]
    aprobada_para_cursar: list[int]
    aprobada_para_rendir: list[int]


class CorrelatividadVersionBase(Schema):
    """Estructura base para el versionado por cohortes."""
    nombre: str
    descripcion: str | None = None
    cohorte_desde: int
    cohorte_hasta: int | None = None
    vigencia_desde: str | None = None
    vigencia_hasta: str | None = None
    activo: bool = True


class CorrelatividadVersionCreateIn(CorrelatividadVersionBase):
    """Payload de creación con opción de clonado desde versión previa."""
    duplicar_version_id: int | None = None


class CorrelatividadVersionUpdateIn(CorrelatividadVersionBase):
    """Actualización de metadatos de una versión."""
    pass


class CorrelatividadVersionOut(Schema):
    """Metadatos de una versión registrados en el sistema."""
    id: int
    nombre: str
    descripcion: str | None
    cohorte_desde: int
    cohorte_hasta: int | None
    vigencia_desde: str | None
    vigencia_hasta: str | None
    activo: bool
    correlatividades: int
    created_at: str | None
    updated_at: str | None


class MateriaCorrelatividadRow(Schema):
    """Fila de la matriz curricular para visualización tabular."""
    id: int
    nombre: str
    anio_cursada: int
    regimen: str
    formato: str
    regular_para_cursar: list[int]
    aprobada_para_cursar: list[int]
    aprobada_para_rendir: list[int]
