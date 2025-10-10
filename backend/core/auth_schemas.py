# backend/core/auth_schemas.py

from ninja import Schema
from typing import Optional, List
from datetime import date

class LoginSchema(Schema):
    username: str # Usaremos el DNI del estudiante como username
    password: str

class UserSchema(Schema):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None

class CarreraEstudianteSchema(Schema):
    nombre: str

class ProfileSchema(Schema):
    # Datos del User
    first_name: str
    last_name: str
    email: Optional[str] = None
    
    # Datos del Estudiante
    legajo: str
    dni: str
    fecha_nacimiento: date
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
    estado_legajo: str
    
    # Relaciones
    carreras: List[CarreraEstudianteSchema]