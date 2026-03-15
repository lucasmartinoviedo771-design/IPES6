from ninja import Schema

class ProfesoradoIn(Schema):
    nombre: str
    duracion_anios: int
    activo: bool = True
    inscripcion_abierta: bool = True
    es_certificacion_docente: bool = False

class ProfesoradoOut(Schema):
    id: int
    nombre: str
    duracion_anios: int
    activo: bool
    inscripcion_abierta: bool
    es_certificacion_docente: bool

class PlanDeEstudioIn(Schema):
    resolucion: str
    anio_inicio: int
    anio_fin: int | None = None
    vigente: bool = True

class PlanDeEstudioOut(Schema):
    id: int
    profesorado_id: int
    resolucion: str
    anio_inicio: int
    anio_fin: int | None
    vigente: bool

class MateriaIn(Schema):
    plan_de_estudio_id: int
    nombre: str
    anio_cursada: int
    formato: str
    regimen: str
    tipo_formacion: str
    horas_semana: int = 0

class MateriaOut(Schema):
    id: int
    plan_de_estudio_id: int
    nombre: str
    anio_cursada: int
    formato: str
    regimen: str
    tipo_formacion: str
    horas_semana: int

class RequisitoDocumentacionOut(Schema):
    id: int
    codigo: str
    titulo: str
    descripcion: str
    categoria: str
    obligatorio: bool
    orden: int
    activo: bool

class PlanDeEstudioOverview(Schema):
    id: int
    resolucion: str
    vigente: bool
    num_materias: int

class ComisionOut(Schema):
    id: int
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: int
    docente_id: int | None = None
    horario_id: int | None = None
    cupo_maximo: int | None = None
    observaciones: str | None = None
    estado: str | None = None

class ComisionIn(Schema):
    materia_id: int
    anio_lectivo: int
    codigo: str
    turno_id: int
    docente_id: int | None = None
    horario_id: int | None = None
    cupo_maximo: int | None = None
    observaciones: str | None = None
    estado: str | None = None

class CorrelatividadSetIn(Schema):
    regular_para_cursar: list[int] = []
    aprobada_para_cursar: list[int] = []
    aprobada_para_rendir: list[int] = []

class CorrelatividadSetOut(Schema):
    regular_para_cursar: list[int]
    aprobada_para_cursar: list[int]
    aprobada_para_rendir: list[int]

class ComisionBulkGenerateIn(Schema):
    plan_id: int
    anio_lectivo: int
    turnos: list[int] | None = None
    cantidad: int = 1
    estado: str | None = None

class CorrelatividadVersionBase(Schema):
    nombre: str
    descripcion: str | None = None
    cohorte_desde: int
    cohorte_hasta: int | None = None
    vigencia_desde: str | None = None
    vigencia_hasta: str | None = None
    activo: bool = True

class CorrelatividadVersionCreateIn(CorrelatividadVersionBase):
    duplicar_version_id: int | None = None

class CorrelatividadVersionUpdateIn(CorrelatividadVersionBase):
    pass

class CorrelatividadVersionOut(Schema):
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
    id: int
    nombre: str
    anio_cursada: int
    regimen: str
    formato: str
    regular_para_cursar: list[int]
    aprobada_para_cursar: list[int]
    aprobada_para_rendir: list[int]
