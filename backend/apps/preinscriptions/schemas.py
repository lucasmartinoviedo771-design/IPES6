from ninja import Schema, Field
from typing import Optional
from datetime import datetime, date

class AlumnoIn(Schema):
    dni: str
    nombres: str
    apellido: str
    cuil: Optional[str] = None
    fecha_nacimiento: date
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

    # Datos personales
    nacionalidad: Optional[str] = None
    estado_civil: Optional[str] = None
    localidad_nac: Optional[str] = None
    provincia_nac: Optional[str] = None
    pais_nac: Optional[str] = None

    # Contacto
    tel_fijo: Optional[str] = None
    emergencia_telefono: Optional[str] = None
    emergencia_parentesco: Optional[str] = None

    # Secundario
    sec_titulo: Optional[str] = None
    sec_establecimiento: Optional[str] = None
    sec_fecha_egreso: Optional[date] = None
    sec_localidad: Optional[str] = None
    sec_provincia: Optional[str] = None
    sec_pais: Optional[str] = None

    # Superiores (opcionales)
    sup1_titulo: Optional[str] = None
    sup1_establecimiento: Optional[str] = None
    sup1_fecha_egreso: Optional[date] = None

    # Laborales
    trabaja: Optional[bool] = None
    empleador: Optional[str] = None
    horario_trabajo: Optional[str] = None
    domicilio_trabajo: Optional[str] = None

class PreinscripcionUpdateIn(Schema):
    carrera_id: Optional[int] = None
    alumno: Optional[AlumnoIn] = None
    datos_extra: Optional[dict] = None


class PreinscripcionOut(Schema):
    id: int
    codigo: str
    estado: str
    fecha: datetime = Field(alias="created_at")
    created_at: datetime
    activa: bool
    alumno: AlumnoOut
    carrera: CarreraOut
