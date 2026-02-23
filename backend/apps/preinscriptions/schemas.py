from datetime import date, datetime

from ninja import Field, Schema


class EstudianteIn(Schema):
    dni: str
    nombres: str
    apellido: str
    cuil: str | None = None
    fecha_nacimiento: date
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None


class EstudianteOut(Schema):
    dni: str
    nombres: str = Field(alias="user.first_name")
    apellido: str = Field(alias="user.last_name")
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    fecha_nacimiento: date | None = None  # Changed to date


class CarreraOut(Schema):
    id: int
    nombre: str
    es_certificacion_docente: bool | None = None


class PreinscripcionIn(Schema):
    carrera_id: int
    foto_4x4_dataurl: str | None = None
    estudiante: EstudianteIn
    captcha_token: str | None = None
    honeypot: str | None = None

    # Datos personales
    nacionalidad: str | None = None
    estado_civil: str | None = None
    localidad_nac: str | None = None
    provincia_nac: str | None = None
    pais_nac: str | None = None

    # Contacto
    tel_fijo: str | None = None
    emergencia_telefono: str | None = None
    emergencia_parentesco: str | None = None

    # Secundario
    sec_titulo: str | None = None
    sec_establecimiento: str | None = None
    sec_fecha_egreso: date | None = None
    sec_localidad: str | None = None
    sec_provincia: str | None = None
    sec_pais: str | None = None

    # Superiores (opcionales)
    sup1_titulo: str | None = None
    sup1_establecimiento: str | None = None
    sup1_fecha_egreso: date | None = None
    sup1_localidad: str | None = None
    sup1_provincia: str | None = None
    sup1_pais: str | None = None

    # Laborales
    trabaja: bool | None = None
    empleador: str | None = None
    horario_trabajo: str | None = None
    domicilio_trabajo: str | None = None


class EstudianteUpdateIn(Schema):
    dni: str | None = None
    nombres: str | None = None
    apellido: str | None = None
    cuil: str | None = None
    fecha_nacimiento: date | None = None
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None


class PreinscripcionUpdateIn(Schema):
    carrera_id: int | None = None
    estudiante: EstudianteUpdateIn | None = None
    datos_extra: dict | None = None


class PreinscripcionOut(Schema):
    id: int
    codigo: str
    estado: str
    fecha: datetime = Field(alias="created_at")
    created_at: datetime
    activa: bool
    estudiante: EstudianteOut | None = Field(None, alias="alumno")
    carrera: CarreraOut

    @staticmethod
    def resolve_estudiante(obj):
        return getattr(obj, "alumno", None)


class PreinscripcionPaginatedOut(Schema):
    count: int
    results: list[PreinscripcionOut]


class ChecklistIn(Schema):
    # Documentación personal
    dni_legalizado: bool = False
    fotos_4x4: bool = False
    certificado_salud: bool = False
    folios_oficio: int = 0

    # Títulos secundarios (al menos una alternativa)
    titulo_secundario_legalizado: bool = False
    certificado_titulo_en_tramite: bool = False
    analitico_legalizado: bool = False
    certificado_alumno_regular_sec: bool = False

    # Detalles de adeuda (solo si corresponde)
    adeuda_materias: bool = False
    adeuda_materias_detalle: str | None = ""
    escuela_secundaria: str | None = ""

    # Trayecto de certificación docente
    es_certificacion_docente: bool = False
    titulo_terciario_univ: bool = False
    incumbencia: bool = False
    curso_introductorio_aprobado: bool = False


class ChecklistOut(ChecklistIn):
    estado_legajo: str = "PEN"


ChecklistIn.model_rebuild()
ChecklistOut.model_rebuild()

class NuevaCarreraIn(Schema):
    carrera_id: int
    anio: int | None = None


class RequisitoDocumentacionOut(Schema):
    id: int
    codigo: str
    titulo: str
    descripcion: str | None = None
    categoria: str
    categoria_display: str
    obligatorio: bool
    orden: int
    activo: bool
    personalizado: bool


class RequisitoDocumentacionUpdateIn(Schema):
    id: int
    titulo: str | None = None
    descripcion: str | None = None
    obligatorio: bool | None = None
    activo: bool | None = None
    orden: int | None = None
    personalizado: bool | None = None
