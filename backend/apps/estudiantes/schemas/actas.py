from datetime import date
from typing import Literal

from ninja import Schema, Field

# ==========================================
# 3. GESTIÓN DE ACTAS (DOCENTES/ADMIN)
# ==========================================

class ActaDocenteIn(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str
    dni: str | None = None

class ActaEstudianteIn(Schema):
    numero_orden: int
    permiso_examen: str | None = None
    dni: str
    apellido_nombre: str
    examen_escrito: str | None = None
    examen_oral: str | None = None
    calificacion_definitiva: str
    observaciones: str | None = None

class ActaCreateIn(Schema):
    tipo: str
    profesorado_id: int
    materia_id: int
    fecha: date
    folio: str
    libro: str | None = None
    observaciones: str | None = None
    docentes: list[ActaDocenteIn] = Field(default_factory=list)
    estudiantes: list[ActaEstudianteIn] = Field(default_factory=list)
    total_aprobados: int | None = None
    total_desaprobados: int | None = None
    total_ausentes: int | None = None

ActaCreateIn.model_rebuild()


class ActaCreateOut(Schema):
    id: int
    codigo: str

# --- Metadata de Actas ---
class ActaMetadataMateria(Schema):
    id: int
    nombre: str
    anio_cursada: int | None = None
    plan_id: int
    plan_resolucion: str

class ActaMetadataPlan(Schema):
    id: int
    resolucion: str
    materias: list[ActaMetadataMateria] = Field(default_factory=list)

class ActaMetadataProfesorado(Schema):
    id: int
    nombre: str
    planes: list[ActaMetadataPlan] = Field(default_factory=list)

class ActaMetadataDocente(Schema):
    id: int
    nombre: str
    dni: str | None = None

class ActaMetadataOut(Schema):
    profesorados: list[ActaMetadataProfesorado] = Field(default_factory=list)
    docentes: list[ActaMetadataDocente] = Field(default_factory=list)
    nota_opciones: list[dict[str, str]] = Field(default_factory=list)

ActaMetadataOut.model_rebuild()


# --- Actas Orales ---
class OralTopicSchema(Schema):
    tema: str
    score: str | None = None

class ActaOralSchema(Schema):
    acta_numero: str | None = None
    folio_numero: str | None = None
    fecha: date | None = None
    curso: str | None = None
    nota_final: str | None = None
    observaciones: str | None = None
    temas_estudiante: list[OralTopicSchema] = Field(default_factory=list)
    temas_docente: list[OralTopicSchema] = Field(default_factory=list)

class ActaOralListItemSchema(ActaOralSchema):
    inscripcion_id: int
    estudiante: str
    dni: str
