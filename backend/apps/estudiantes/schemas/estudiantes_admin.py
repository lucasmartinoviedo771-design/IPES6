from typing import Any

from ninja import Schema, Field

from apps.estudiantes.schemas.regularidad import RegularidadEstudianteOut

# ==========================================
# 11. ESTUDIANTES (ADMINISTRACIÓN)
# ==========================================

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
    aprobada: bool = False
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
    articulo_7: bool | None = None

class CarreraStatus(Schema):
    profesorado_id: int
    nombre: str
    estado_academico: str
    estado_academico_display: str
    condicion: str

class EstudianteAdminListItem(Schema):
    dni: str
    apellido: str
    nombre: str
    email: str | None = None
    telefono: str | None = None
    estado_legajo: str
    estado_legajo_display: str
    carreras: list[str] = Field(default_factory=list)
    carreras_detalle: list[CarreraStatus] = Field(default_factory=list)
    legajo: str | None = None
    anio_ingreso: int | None = None
    activo: bool = True

class EstudianteAdminListResponse(Schema):
    total: int
    items: list[EstudianteAdminListItem] = Field(default_factory=list)

class EstudianteDocumentacionListItem(Schema):
    dni: str
    apellido: str
    nombre: str
    condicion_administrativa: str
    curso_introductorio_aprobado: bool
    libreta_entregada: bool
    dni_legalizado: bool
    fotos_4x4: bool
    certificado_salud: bool
    folios_oficio: int
    titulo_secundario_ok: bool
    articulo_7: bool

class EstudianteDocumentacionListResponse(Schema):
    total: int
    items: list[EstudianteDocumentacionListItem] = Field(default_factory=list)

class EstudianteDocumentacionUpdateIn(Schema):
    curso_introductorio_aprobado: bool | None = None
    libreta_entregada: bool | None = None
    dni_legalizado: bool | None = None
    fotos_4x4: bool | None = None
    certificado_salud: bool | None = None
    folios_oficio: int | None = None
    titulo_secundario_ok: bool | None = None
    articulo_7: bool | None = None

class EstudianteDocumentacionBulkUpdateItem(Schema):
    dni: str
    changes: EstudianteDocumentacionUpdateIn

class EstudianteDocumentacionBulkUpdateIn(Schema):
    updates: list[EstudianteDocumentacionBulkUpdateItem]

class EstudianteAdminDetail(Schema):
    dni: str
    apellido: str
    nombre: str
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    fecha_nacimiento: str | None = None
    lugar_nacimiento: str | None = None
    genero: str | None = None
    estado_legajo: str
    estado_legajo_display: str
    must_change_password: bool
    activo: bool = True
    carreras: list[str] = Field(default_factory=list)
    carreras_detalle: list[CarreraStatus] = Field(default_factory=list)
    legajo: str | None = None
    datos_extra: dict[str, Any] = Field(default_factory=dict)
    documentacion: EstudianteAdminDocumentacion | None = None
    condicion_calculada: str | None = None
    curso_introductorio_aprobado: bool | None = None
    libreta_entregada: bool | None = None
    autorizado_rendir: bool = False
    autorizado_rendir_observacion: str | None = None
    materias_autorizadas: list[int] = Field(default_factory=list)
    regularidades: list[RegularidadResumen] = Field(default_factory=list)

EstudianteAdminDetail.model_rebuild()


class CarreraUpdateIn(Schema):
    profesorado_id: int
    estado_academico: str | None = None

class EstudianteAdminUpdateIn(Schema):
    dni: str | None = None
    apellido: str | None = None
    nombre: str | None = None
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    estado_legajo: str | None = Field(default=None, pattern="^(COM|INC|PEN)$", description="COM, INC o PEN")
    must_change_password: bool | None = None
    activo: bool | None = None
    fecha_nacimiento: str | None = None
    lugar_nacimiento: str | None = None
    documentacion: EstudianteAdminDocumentacion | None = None
    anio_ingreso: str | None = None
    genero: str | None = None
    rol_extra: str | None = None
    observaciones: str | None = None
    cuil: str | None = None
    curso_introductorio_aprobado: bool | None = None
    libreta_entregada: bool | None = None
    # Datos personales adicionales
    nacionalidad: str | None = None
    estado_civil: str | None = None
    localidad_nac: str | None = None
    provincia_nac: str | None = None
    pais_nac: str | None = None
    # Emergencia
    emergencia_telefono: str | None = None
    emergencia_parentesco: str | None = None
    # Secundario
    sec_titulo: str | None = None
    sec_establecimiento: str | None = None
    sec_fecha_egreso: str | None = None
    sec_localidad: str | None = None
    sec_provincia: str | None = None
    sec_pais: str | None = None
    # Superiores
    sup1_titulo: str | None = None
    sup1_establecimiento: str | None = None
    sup1_fecha_egreso: str | None = None
    sup1_localidad: str | None = None
    sup1_provincia: str | None = None
    sup1_pais: str | None = None
    # Accesibilidad
    cud_informado: bool | None = None
    condicion_salud_informada: bool | None = None
    condicion_salud_detalle: str | None = None
    # Laborales
    trabaja: bool | None = None
    empleador: str | None = None
    horario_trabajo: str | None = None
    domicilio_trabajo: str | None = None
    # Updates for specific careers
    carreras_update: list[CarreraUpdateIn] | None = None



class AutorizarRendirIn(Schema):
    autorizado: bool
    observacion: str | None = None
    materias_autorizadas: list[int] = Field(default_factory=list)
