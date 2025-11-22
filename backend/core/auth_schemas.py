# backend/core/auth_schemas.py

from datetime import date

from ninja import Schema


class LoginSchema(Schema):
    username: str  # Usaremos el DNI del estudiante como username
    password: str


class UserSchema(Schema):
    id: int
    first_name: str
    last_name: str
    email: str | None = None


class CarreraEstudianteSchema(Schema):
    nombre: str


class ProfileSchema(Schema):
    # Datos del User
    first_name: str
    last_name: str
    email: str | None = None

    # Datos del Estudiante
    legajo: str
    dni: str
    fecha_nacimiento: date
    telefono: str | None = None
    domicilio: str | None = None
    estado_legajo: str

    # Relaciones
    carreras: list[CarreraEstudianteSchema]
