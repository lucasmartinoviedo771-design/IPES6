"""
Esquemas centrales de datos para la API IPES6.
Define las estructuras Pydantic (Schema) para transferibilidad de datos,
validaciones de formato y Tipado Estático para NinjaAPI.
"""

from typing import List
from datetime import date
from ninja import Schema
from pydantic import EmailStr, field_validator, model_validator


class PreinscripcionSchemaIn(Schema):
    """
    Datos de entrada para una nueva solicitud de preinscripción.
    Incluye validación estricta de DNI y coherencia de estudios superiores.
    """
    # Identidad y Origen
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
    
    # Contacto
    domicilio: str
    email: EmailStr
    tel_movil: str
    tel_fijo: str | None = None
    
    # Estudios Secundarios
    sec_titulo: str
    sec_fecha_egreso: date
    sec_establecimiento: str
    
    # Preferencia Académica
    carrera_id: int

    # Datos Laborales (Opcionales)
    trabaja: bool | None = False
    empleador: str | None = None
    horario_trabajo: str | None = None
    domicilio_trabajo: str | None = None
    
    # Estudios Superiores (Opcionales)
    sup1_titulo: str | None = None
    sup1_establecimiento: str | None = None
    sup1_fecha_egreso: date | None = None

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: str):
        """Limpia la cadena y valida que consista en exactamente 8 dígitos."""
        solo = "".join(ch for ch in v if ch.isdigit())
        if len(solo) != 8:
            raise ValueError(
                "DNI inválido: debe tener exactamente 8 dígitos, sin puntos ni guiones"
            )
        return solo

    @model_validator(mode="after")
    def validar_superiores(self):
        """Valida que si se inicia la carga de estudios superiores, se completen los campos requeridos."""
        vals = [self.sup1_titulo, self.sup1_establecimiento, self.sup1_fecha_egreso]
        if any(vals) and not all([self.sup1_titulo, self.sup1_establecimiento]):
            raise ValueError(
                "Si informás estudios superiores, 'sup1_titulo' y 'sup1_establecimiento' son obligatorios."
            )
        return self


class PreinscripcionSchemaOut(Schema):
    """Resumen público de una preinscripción para listados."""
    id: int
    nombres: str
    apellido: str
    dni: str
    email: EmailStr
    estado: str


class ErrorSchema(Schema):
    """Estructura estándar para mensajes de error de la API."""
    message: str


class CarreraListSchema(Schema):
    """Estructura simplificada de carrera para selectores del frontend."""
    id: int
    nombre: str


class UserSchema(Schema):
    """Perfil de usuario autenticado con su matriz de roles (grupos)."""
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    groups: List[str] = []


class AsignarRolIn(Schema):
    """Payload para la asignación administrativa de roles y profesorados."""
    user_id: int
    role: str
    profesorado_ids: List[int] = []
    action: str = "assign"
    # Para tutores y bedeles: turno (manana/tarde/vespertino). Requerido para tutores.
    turno: str | None = None


class ForceResetPasswordIn(Schema):
    """Payload para reseteo administrativo forzado de contraseña."""
    username: str
    new_password: str | None = None
