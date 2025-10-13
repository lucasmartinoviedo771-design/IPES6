from ninja import Schema, Field
from typing import Optional
from datetime import datetime, date

class AlumnoIn(Schema):
    dni: str
    nombres: str
    apellido: str
    cuil: Optional[str] = None
    fecha_nacimiento: Optional[date] = None  # Changed to date
    email: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None

class AlumnoOut(Schema):
    dni: str
    nombres: str = Field(alias="user.first_name")
    apellido: str = Field(alias="user.last_name")
    email: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
    fecha_nacimiento: Optional[date] = None # Changed to date

class CarreraOut(Schema):
    id: int
    nombre: str

class PreinscripcionIn(Schema):
    carrera_id: int
    foto_4x4_dataurl: Optional[str] = None
    alumno: AlumnoIn

class PreinscripcionOut(Schema):
    id: int
    codigo: str
    estado: str
    fecha: datetime = Field(alias="created_at")
    created_at: datetime
    alumno: AlumnoOut
    carrera: CarreraOut
