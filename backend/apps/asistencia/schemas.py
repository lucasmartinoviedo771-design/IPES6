from datetime import date, datetime
from typing import List, Optional

from ninja import Schema


class DocenteInfoOut(Schema):
    nombre: str
    dni: str


class DocenteClaseOut(Schema):
    id: int
    fecha: date
    comision_id: int
    materia: str
    materia_id: int
    comision: str
    turno: str
    horario: Optional[str]
    aula: Optional[str]
    puede_marcar: bool
    editable_staff: bool
    ya_registrada: bool
    registrada_en: Optional[datetime]
    ventana_inicio: Optional[datetime]
    ventana_fin: Optional[datetime]
    umbral_tarde: Optional[datetime]
    plan_id: Optional[int]
    plan_resolucion: Optional[str]
    profesorado_id: Optional[int]
    profesorado_nombre: Optional[str]


class DocenteHistorialOut(Schema):
    fecha: date
    turno: str
    estado: str
    observacion: Optional[str]


class DocenteClasesResponse(Schema):
    docente: DocenteInfoOut
    clases: List[DocenteClaseOut]
    historial: List[DocenteHistorialOut]


class DocenteMarcarPresenteIn(Schema):
    dni: str
    observaciones: Optional[str] = None
    via: str = "docente"  # docente | staff
    propagar_turno: bool = False


class DocenteMarcarPresenteOut(Schema):
    clase_id: int
    estado: str
    registrada_en: datetime
    categoria: str
    alerta: bool
    alerta_tipo: Optional[str]
    alerta_motivo: Optional[str]
    mensaje: Optional[str]
    turno: Optional[str]


class EstudianteResumenOut(Schema):
    estudiante_id: int
    dni: str
    nombre: str
    apellido: str
    estado: str
    justificada: bool
    porcentaje_asistencia: float = 0.0


class ClaseNavegacionOut(Schema):
    id: int
    fecha: date
    descripcion: str
    actual: bool = False


class ClaseEstudianteDetalleOut(Schema):
    clase_id: int
    comision: str
    fecha: date
    horario: Optional[str]
    materia: str
    docentes: List[str]
    docente_presente: bool
    docente_categoria_asistencia: Optional[str] = None
    estudiantes: List[EstudianteResumenOut]
    otras_clases: List[ClaseNavegacionOut] = []


class RegistrarAsistenciaEstudiantesIn(Schema):
    presentes: List[int]
    tardes: List[int] = []  # IDs de estudiantes
    observaciones: Optional[str] = None


class JustificacionCreateIn(Schema):
    tipo: str  # estudiante | docente
    motivo: str
    vigencia_desde: date
    vigencia_hasta: date
    origen: str = "posterior"
    comision_id: int
    estudiante_id: Optional[int] = None
    docente_id: Optional[int] = None
    observaciones: Optional[str] = None
    archivo_url: Optional[str] = None


class JustificacionOut(Schema):
    id: int
    estado: str


class JustificacionDetalleOut(Schema):
    id: int
    clase_id: int
    fecha: date
    comision_id: Optional[int]
    comision: Optional[str]
    materia: Optional[str]
    estudiante_id: Optional[int] = None
    estudiante: Optional[str] = None
    docente_id: Optional[int] = None
    docente: Optional[str] = None
    aplica_automaticamente: bool


class JustificacionListItemOut(Schema):
    id: int
    tipo: str
    estado: str
    origen: str
    motivo: str
    vigencia_desde: date
    vigencia_hasta: date
    comision_id: Optional[int]
    comision: Optional[str]
    materia: Optional[str]
    profesorado_id: Optional[int]
    profesorado: Optional[str]
    estudiante_id: Optional[int] = None
    estudiante: Optional[str] = None
    docente_id: Optional[int] = None
    docente: Optional[str] = None
    creado_en: datetime
    aprobado_en: Optional[datetime]


class JustificacionDetailOut(Schema):
    id: int
    tipo: str
    estado: str
    origen: str
    motivo: str
    observaciones: Optional[str]
    archivo_url: Optional[str]
    vigencia_desde: date
    vigencia_hasta: date
    comision_id: Optional[int]
    comision: Optional[str]
    materia: Optional[str]
    profesorado_id: Optional[int]
    profesorado: Optional[str]
    estudiante_id: Optional[int]
    estudiante: Optional[str]
    docente_id: Optional[int]
    docente: Optional[str]
    creado_en: datetime
    creado_por: Optional[str]
    aprobado_en: Optional[datetime]
    aprobado_por: Optional[str]
    detalles: List[JustificacionDetalleOut]


class JustificacionRechazarIn(Schema):
    observaciones: Optional[str] = None


class DocenteDniLogIn(Schema):
    dni: str
    origen: Optional[str] = "kiosk"


class EstudianteClaseListadoOut(Schema):
    clase_id: int
    fecha: date
    materia: str
    comision: str
    turno: Optional[str]
    horario: Optional[str]
    estado_clase: str
    total_estudiantes: int
    presentes: int
    ausentes: int
    ausentes_justificados: int


class EstudianteClasesResponse(Schema):
    clases: List[EstudianteClaseListadoOut]


class AsistenciaCalendarioEventoIn(Schema):
    nombre: str
    tipo: str
    subtipo: Optional[str] = None
    fecha_desde: date
    fecha_hasta: date
    turno_id: Optional[int] = None
    profesorado_id: Optional[int] = None
    plan_id: Optional[int] = None
    comision_id: Optional[int] = None
    docente_id: Optional[int] = None
    aplica_docentes: bool = True
    aplica_estudiantes: bool = True
    motivo: Optional[str] = None
    activo: bool = True


class AsistenciaCalendarioEventoOut(Schema):
    id: int
    nombre: str
    tipo: str
    subtipo: str
    fecha_desde: date
    fecha_hasta: date
    turno_id: Optional[int]
    turno_nombre: Optional[str]
    profesorado_id: Optional[int]
    profesorado_nombre: Optional[str]
    plan_id: Optional[int]
    plan_resolucion: Optional[str]
    comision_id: Optional[int]
    comision_nombre: Optional[str]
    docente_id: Optional[int]
    docente_nombre: Optional[str]
    aplica_docentes: bool
    aplica_estudiantes: bool
    motivo: Optional[str]
    activo: bool
    creado_en: datetime


class EstudianteAsistenciaItemOut(Schema):
    id: int
    fecha: date
    materia: str
    comision: str
    estado: str
    justificada: bool
    observacion: Optional[str]
