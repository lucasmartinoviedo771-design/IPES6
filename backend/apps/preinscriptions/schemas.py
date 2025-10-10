from ninja import Schema
from typing import Optional

class AlumnoIn(Schema):
    dni: str
    nombres: str
    apellido: str
    cuil: Optional[str] = None
    fecha_nacimiento: Optional[str] = None  # YYYY-MM-DD
    email: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None

class PreinscripcionIn(Schema):
    carrera_id: int
    foto_4x4_dataurl: Optional[str] = None
    alumno: AlumnoIn

class PreinscripcionOut(Schema):
    id: int
    codigo: str
    estado: str
