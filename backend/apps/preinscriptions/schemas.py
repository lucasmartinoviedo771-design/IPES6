"""
Esquemas de validación (Pydantic/Ninja) para el módulo de Preinscripciones.
Define las estructuras de datos de entrada y salida para la API, asegurando 
la integridad de los datos de aspirantes y requisitos de documentación.
"""

from datetime import date, datetime
from ninja import Field, Schema


class EstudianteIn(Schema):
    """Datos básicos de identidad del aspirante para el alta inicial."""
    dni: str
    nombres: str
    apellido: str
    cuil: str | None = None
    fecha_nacimiento: date
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None


class EstudianteOut(Schema):
    """Estructura de salida para datos del estudiante en listados."""
    dni: str
    nombres: str = Field(alias="nombre")
    apellido: str
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    fecha_nacimiento: date | None = None


class CarreraOut(Schema):
    """Información simplificada de la carrera solicitada."""
    id: int
    nombre: str
    es_certificacion_docente: bool | None = None


class PreinscripcionIn(Schema):
    """
    Payload principal para el formulario público de preinscripción.
    Contiene datos personales, de contacto, académicos y laborales.
    """
    carrera_id: int
    foto_4x4_dataurl: str | None = None
    estudiante: EstudianteIn
    captcha_token: str | None = None
    honeypot: str | None = None  # Trampa para bots (debe ser None)

    # Datos personales y de nacimiento
    nacionalidad: str | None = None
    estado_civil: str | None = None
    genero: str | None = None
    localidad_nac: str | None = None
    provincia_nac: str | None = None
    pais_nac: str | None = None

    # Contacto y Emergencia
    tel_fijo: str | None = None
    emergencia_telefono: str | None = None
    emergencia_parentesco: str | None = None

    # Antecedentes de Educación Secundaria
    sec_titulo: str | None = None
    sec_establecimiento: str | None = None
    sec_fecha_egreso: date | None = None
    sec_localidad: str | None = None
    sec_provincia: str | None = None
    sec_pais: str | None = None

    # Estudios Superiores (opcionales)
    sup1_titulo: str | None = None
    sup1_establecimiento: str | None = None
    sup1_fecha_egreso: date | None = None
    sup1_localidad: str | None = None
    sup1_provincia: str | None = None
    sup1_pais: str | None = None

    # Situación Laboral
    trabaja: bool | None = None
    empleador: str | None = None
    horario_trabajo: str | None = None
    domicilio_trabajo: str | None = None

    # Accesibilidad / datos sensibles
    cud_informado: bool | None = None
    condicion_salud_informada: bool | None = None
    condicion_salud_detalle: str | None = None
    consentimiento_datos: bool | None = None


class EstudianteUpdateIn(Schema):
    """Campos permitidos para la actualización parcial del perfil del estudiante."""
    dni: str | None = None
    nombres: str | None = None
    apellido: str | None = None
    cuil: str | None = None
    fecha_nacimiento: date | None = None
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    genero: str | None = None


class ChecklistIn(Schema):
    """
    Lista de validación documental utilizada por Bedeles (Backoffice).
    Indica si el aspirante ha presentado la documentación física obligatoria.
    """
    # Requisitos físicos estándar
    dni_legalizado: bool = False
    fotos_4x4: bool = False
    certificado_salud: bool = False
    folios_oficio: bool = False

    # Acreditación de Nivel Medio
    titulo_secundario_legalizado: bool = False
    certificado_titulo_en_tramite: bool = False
    analitico_legalizado: bool = False
    certificado_alumno_regular_sec: bool = False

    # Gestión de adeudos
    adeuda_materias: bool = False
    adeuda_materias_detalle: str | None = ""
    escuela_secundaria: str | None = ""

    # Casos especiales: Certificación Docente / Art. 7mo
    es_certificacion_docente: bool = False
    titulo_terciario_univ: bool = False
    incumbencia: bool = False
    curso_introductorio_aprobado: bool = False
    articulo_7: bool = False


class ChecklistOut(ChecklistIn):
    """Estado administrativo del legajo derivado del checklist."""
    estado_legajo: str = "PEN"


# Sincronización de dependencias circulares internas si existieran
ChecklistIn.model_rebuild()
ChecklistOut.model_rebuild()


class PreinscripcionUpdateIn(Schema):
    """Payload para la edición administrativa de una solicitud existente."""
    carrera_id: int | None = None
    estudiante: EstudianteUpdateIn | None = None
    datos_extra: dict | None = None
    checklist: ChecklistIn | None = None


class PreinscripcionOut(Schema):
    """Detalle completo de una preinscripción para consumo del frontend gestor."""
    id: int
    codigo: str
    estado: str
    fecha: datetime = Field(alias="created_at")
    created_at: datetime | None = None
    activa: bool
    estudiante: EstudianteOut | None = Field(None, alias="alumno")
    carrera: CarreraOut

    @staticmethod
    def resolve_estudiante(obj):
        """Resuelve el alias 'alumno' a nuestro campo 'estudiante'."""
        return getattr(obj, "alumno", None)


class PreinscripcionPaginatedOut(Schema):
    """Esquema de respuesta paginada estándar."""
    count: int
    results: list[PreinscripcionOut]


class NuevaCarreraIn(Schema):
    """Datos para inscribir a un aspirante en una oferta académica adicional."""
    carrera_id: int
    anio: int | None = None


class RequisitoDocumentacionOut(Schema):
    """Detalle de un requisito documental (ej: 'Título Secundario')."""
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
    """Datos para la personalización de un requisito por carrera."""
    id: int
    titulo: str | None = None
    descripcion: str | None = None
    obligatorio: bool | None = None
    activo: bool | None = None
    orden: int | None = None
    personalizado: bool | None = None
