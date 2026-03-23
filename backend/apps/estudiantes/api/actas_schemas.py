"""Schemas locales para el módulo de actas (distintos de los schemas globales en schemas/)."""

from ninja import Schema, Field


class ActaDocenteLocal(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str
    dni: str | None = None

class ActaEstudianteLocal(Schema):
    numero_orden: int
    permiso_examen: str | None = None
    dni: str
    apellido_nombre: str
    examen_escrito: str | None = None
    examen_oral: str | None = None
    calificacion_definitiva: str
    observaciones: str | None = None

class ActaCreateLocal(Schema):
    tipo: str
    profesorado_id: int
    materia_id: int
    fecha: str
    folio: str
    libro: str | None = None
    observaciones: str | None = None
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)
    estudiantes: list[ActaEstudianteLocal] = Field(default_factory=list)
    total_aprobados: int | None = None
    total_desaprobados: int | None = None
    total_ausentes: int | None = None

class ActaCreateOutLocal(Schema):
    id: int
    codigo: str

class ActaListItem(Schema):
    id: int
    codigo: str
    fecha: str
    materia: str
    libro: str | None = None
    folio: str | None = None
    total_estudiantes: int
    created_at: str
    mesa_id: int | None = None
    esta_cerrada: bool = False

class ActaDetailLocal(Schema):
    id: int
    codigo: str
    codigo: str
    fecha: str
    tipo: str | None = "REG"
    profesorado_id: int | None = None
    materia_id: int | None = None
    plan_id: int | None = None
    profesorado: str
    materia: str
    materia_anio: int | None = None
    plan_resolucion: str | None = None
    libro: str | None = None
    folio: str | None = None
    observaciones: str | None = None
    total_estudiantes: int
    total_aprobados: int
    total_desaprobados: int
    total_ausentes: int
    created_by: str | None = None
    created_at: str | None = None
    mesa_id: int | None = None
    esta_cerrada: bool = False
    estudiantes: list[ActaEstudianteLocal] = Field(default_factory=list)
    docentes: list[ActaDocenteLocal] = Field(default_factory=list)

# Metadata schemas
class ActaMetadataMateria(Schema):
    id: int
    nombre: str
    anio_cursada: int
    plan_id: int
    plan_resolucion: str

class ActaMetadataPlan(Schema):
    id: int
    resolucion: str
    materias: list[ActaMetadataMateria]

class ActaMetadataProfesorado(Schema):
    id: int
    nombre: str
    planes: list[ActaMetadataPlan]

class ActaMetadataDocente(Schema):
    id: int
    nombre: str
    dni: str | None = None

class ActaMetadataOut(Schema):
    profesorados: list[ActaMetadataProfesorado]
    docentes: list[ActaMetadataDocente]
    estudiantes: list[dict] = []
    nota_opciones: list[dict]

# Rebuild
ActaDocenteLocal.model_rebuild()
ActaEstudianteLocal.model_rebuild()
ActaCreateLocal.model_rebuild()
ActaCreateOutLocal.model_rebuild()
ActaListItem.model_rebuild()
ActaDetailLocal.model_rebuild()
