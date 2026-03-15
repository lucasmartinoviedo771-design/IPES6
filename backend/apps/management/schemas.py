from datetime import date
from ninja import Schema, Field

class MesaDocenteOut(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str | None = None
    dni: str | None = None

class MesaIn(Schema):
    materia_id: int
    tipo: str
    modalidad: str = "REGULAR"
    fecha: date
    hora_desde: str | None = None
    hora_hasta: str | None = None
    aula: str | None = None
    cupo: int | None = 0
    ventana_id: int | None = None
    docente_presidente_id: int | None = None
    docente_vocal1_id: int | None = None
    docente_vocal2_id: int | None = None

class MesaOut(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    plan_id: int | None = None
    plan_resolucion: str | None = None
    anio_cursada: int | None = None
    regimen: str | None = None
    tipo: str
    modalidad: str
    fecha: date
    hora_desde: str | None
    hora_hasta: str | None
    aula: str | None
    cupo: int
    codigo: str | None = None
    docentes: list[MesaDocenteOut] = Field(default_factory=list)

class VentanaIn(Schema):
    tipo: str
    desde: date
    hasta: date
    activo: bool = True
    periodo: str | None = None

class VentanaOut(Schema):
    id: int
    tipo: str
    desde: date
    hasta: date
    activo: bool
    periodo: str | None = None

class DashboardCatedra(Schema):
    id: int
    materia: str
    profesorado: str
    anio_lectivo: int
    turno: str | None

class DashboardDocente(Schema):
    id: int
    nombre: str
    documento: str
    total_catedras: int
    catedras: list[DashboardCatedra]

class DashboardProfesorado(Schema):
    id: int
    nombre: str
    planes: int
    materias: int
    correlativas: int

class DashboardPreinsEstado(Schema):
    estado: str
    total: int

class DashboardPreinsDetalle(Schema):
    id: int
    codigo: str
    estudiante: str
    carrera: str | None
    fecha: str | None

class DashboardPreinscripciones(Schema):
    total: int
    por_estado: list[DashboardPreinsEstado]
    recientes: list[DashboardPreinsDetalle]

class DashboardMesaTipo(Schema):
    tipo: str
    total: int

class DashboardMesas(Schema):
    total: int
    por_tipo: list[DashboardMesaTipo]

class DashboardRegularidad(Schema):
    id: int
    estudiante: str
    dni: str
    materia: str
    profesorado: str | None
    situacion: str
    nota: str | None
    fecha: str

class DashboardVentana(Schema):
    id: int
    tipo: str
    desde: str
    hasta: str
    activo: bool
    estado: str

class DashboardPedidoAnalitico(Schema):
    id: int
    estudiante: str
    dni: str
    fecha: str
    motivo: str
    profesorado: str | None

class DashboardCambioComision(Schema):
    id: int
    estudiante: str
    dni: str
    materia: str
    profesorado: str | None
    comision_actual: str | None
    comision_solicitada: str | None
    estado: str
    actualizado: str

class DashboardHorario(Schema):
    profesorado_id: int
    profesorado: str
    anio_cursada: int
    cantidad: int

class GlobalOverviewOut(Schema):
    docentes: list[DashboardDocente]
    profesorados: list[DashboardProfesorado]
    preinscripciones: DashboardPreinscripciones
    horarios: list[DashboardHorario]
    pedidos_comision: list[DashboardCambioComision]
    pedidos_analiticos: list[DashboardPedidoAnalitico]
    mesas: DashboardMesas
    regularidades: list[DashboardRegularidad]
    ventanas: list[DashboardVentana]
