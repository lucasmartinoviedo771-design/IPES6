# backend/core/schemas.py

from datetime import date

from ninja import Schema
from pydantic import EmailStr, field_validator, model_validator


class PreinscripcionSchemaIn(Schema):
    # Obligatorios
    nombres: str
    apellido: str
    cuil: str
    dni: str
    fecha_nacimiento: date
    nacionalidad: str
    estado_civil: str
    localidad_nac: str
    provincia_nac: str
    pais_nac: str
    domicilio: str
    email: EmailStr
    tel_movil: str
    sec_titulo: str
    sec_fecha_egreso: date
    sec_establecimiento: str
    carrera_id: int

    # Opcionales
    tel_fijo: str | None = None
    trabaja: bool | None = False
    empleador: str | None = None
    horario_trabajo: str | None = None
    domicilio_trabajo: str | None = None
    sup1_titulo: str | None = None
    sup1_establecimiento: str | None = None
    sup1_fecha_egreso: date | None = None

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: str):
        solo = "".join(ch for ch in v if ch.isdigit())
        if len(solo) != 8:
            raise ValueError("DNI inválido: debe tener exactamente 8 dígitos, sin puntos ni guiones")
        return solo

    @model_validator(mode="after")
    def validar_superiores(self):
        vals = [self.sup1_titulo, self.sup1_establecimiento, self.sup1_fecha_egreso]
        if any(vals) and not all([self.sup1_titulo, self.sup1_establecimiento]):
            raise ValueError(
                "Si informás estudios superiores, 'sup1_titulo' y 'sup1_establecimiento' son obligatorios."
            )
        return self


class PreinscripcionSchemaOut(Schema):
    id: int
    nombres: str
    apellido: str
    dni: str
    email: EmailStr
    estado: str


class ErrorSchema(Schema):
    message: str


class CarreraListSchema(Schema):
    id: int
    nombre: str
