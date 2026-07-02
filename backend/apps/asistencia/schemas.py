from datetime import date, datetime
from typing import List, Optional

from ninja import Schema


class DocenteInfoOut(Schema):
    nombre: str
    dni: str


class DocenteClaseOut(Schema):
    id: int
    fecha: str
    comision_id: int
    materia: str
    materia_id: int
    comision: str
    turno: str
    horario: str | None
    aula: str | None
    puede_marcar: bool
    editable_staff: bool
    ya_registrada: bool
    registrada_en: str | None
    ventana_inicio: str | None
    ventana_fin: str | None
    umbral_tarde: str | None
    plan_id: int | None
    plan_resolucion: str | None
    profesorado_id: int | None
    profesorado_nombre: str | None


class DocenteHistorialOut(Schema):
    fecha: str
    turno: str
    estado: str
    observacion: str | None


class DocenteMisAsistenciasOut(Schema):
    id: int
    fecha: str
    espacio_curricular: str
    comision: str
    horario: str
    turno: str
    estado: str
    categoria: str
    observacion: str | None


class DocenteClasesResponse(Schema):
    docente: DocenteInfoOut
    clases: list[DocenteClaseOut]
    historial: list[DocenteHistorialOut]


class DocenteMarcarPresenteIn(Schema):
    dni: str
    observaciones: str | None = None
    via: str = "docente"  # docente | staff
    propagar_turno: bool = False


class DocenteMarcarPresenteOut(Schema):
    clase_id: int
    estado: str
    registrada_en: str
    categoria: str
    alerta: bool
    alerta_tipo: str | None
    alerta_motivo: str | None
    mensaje: str | None
    turno: str | None


class IniciarPinResponse(Schema):
    pin: str


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
    fecha: str
    descripcion: str
    actual: bool = False


class ClaseEstudianteDetalleOut(Schema):
    clase_id: int
    comision: str
    fecha: str
    horario: str | None
    materia: str
    docentes: list[str]
    docente_presente: bool
    docente_ausente: bool = False
    docente_categoria_asistencia: str | None = None
    estudiantes: list[EstudianteResumenOut]
    otras_clases: list[ClaseNavegacionOut] = []
    pin_asistencia: str | None = None


class RegistrarAsistenciaEstudiantesIn(Schema):
    presentes: list[int]
    tardes: list[int] = []  # IDs de estudiantes
    observaciones: str | None = None


class RegistrarAsistenciaPinIn(Schema):
    pin: str
    latitud: float | None = None
    longitud: float | None = None


class JustificacionCreateIn(Schema):
    tipo: str  # estudiante | docente
    motivo: str
    vigencia_desde: str
    vigencia_hasta: str
    origen: str = "posterior"
    comision_id: int
    estudiante_id: int | None = None
    docente_id: int | None = None
    observaciones: str | None = None
    archivo_url: str | None = None


class JustificacionOut(Schema):
    id: int
    estado: str


class JustificacionDetalleOut(Schema):
    id: int
    clase_id: int
    fecha: str
    comision_id: int | None
    comision: str | None
    materia: str | None
    estudiante_id: int | None = None
    estudiante: str | None = None
    docente_id: int | None = None
    docente: str | None = None
    aplica_automaticamente: bool


class JustificacionListItemOut(Schema):
    id: int
    tipo: str
    estado: str
    origen: str
    motivo: str
    vigencia_desde: str
    vigencia_hasta: str
    comision_id: int | None
    comision: str | None
    materia: str | None
    profesorado_id: int | None
    profesorado: str | None
    estudiante_id: int | None = None
    estudiante: str | None = None
    docente_id: int | None = None
    docente: str | None = None
    creado_en: str
    aprobado_en: str | None


class JustificacionDetailOut(Schema):
    id: int
    tipo: str
    estado: str
    origen: str
    motivo: str
    observaciones: str | None
    archivo_url: str | None
    vigencia_desde: str
    vigencia_hasta: str
    comision_id: int | None
    comision: str | None
    materia: str | None
    profesorado_id: int | None
    profesorado: str | None
    estudiante_id: int | None
    estudiante: str | None
    docente_id: int | None
    docente: str | None
    creado_en: str
    creado_por: str | None
    aprobado_en: str | None
    aprobado_por: str | None
    detalles: list[JustificacionDetalleOut]


class JustificacionRechazarIn(Schema):
    observaciones: str | None = None


class DocenteDniLogIn(Schema):
    dni: str
    origen: str | None = "kiosk"
    app_version: str | None = None


class EstudianteClaseListadoOut(Schema):
    clase_id: int
    fecha: str
    materia: str
    comision: str
    turno: str | None
    horario: str | None
    estado_clase: str
    total_estudiantes: int
    presentes: int
    ausentes: int
    ausentes_justificados: int


class EstudianteClasesResponse(Schema):
    clases: list[EstudianteClaseListadoOut]


class AsistenciaCalendarioEventoIn(Schema):
    nombre: str
    tipo: str
    subtipo: str | None = None
    fecha_desde: date
    fecha_hasta: date
    turno_id: int | None = None
    profesorado_id: int | None = None
    plan_id: int | None = None
    comision_id: int | None = None
    docente_id: int | None = None
    aplica_docentes: bool = True
    aplica_estudiantes: bool = True
    motivo: str | None = None
    activo: bool = True


class AsistenciaCalendarioEventoOut(Schema):
    id: int
    nombre: str
    tipo: str
    subtipo: str
    fecha_desde: str
    fecha_hasta: str
    turno_id: int | None
    turno_nombre: str | None
    profesorado_id: int | None
    profesorado_nombre: str | None
    plan_id: int | None
    plan_resolucion: str | None
    comision_id: int | None
    comision_nombre: str | None
    docente_id: int | None
    docente_nombre: str | None
    aplica_docentes: bool
    aplica_estudiantes: bool
    motivo: str | None
    activo: bool
    creado_en: str


class EstudianteAsistenciaItemOut(Schema):
    id: int
    fecha: str
    materia: str
    comision: str
    estado: str
    justificada: bool
    observacion: str | None
