from datetime import date
from ninja import Schema

class DocenteIn(Schema):
    nombre: str
    apellido: str
    dni: str
    email: str | None = None
    telefono: str | None = None
    cuil: str | None = None
    fecha_nacimiento: date | None = None

class DocenteOut(Schema):
    id: int
    nombre: str
    apellido: str
    dni: str
    email: str | None = None
    telefono: str | None = None
    cuil: str | None = None
    fecha_nacimiento: date | None = None
    usuario: str | None = None
    temp_password: str | None = None

class DocenteRoleAssignIn(Schema):
    role: str
    profesorados: list[int] | None = None

class DocenteRoleAssignOut(Schema):
    success: bool
    user_id: int
    username: str
    role: str
    profesorados: list[int] | None = None
    temp_password: str | None = None
