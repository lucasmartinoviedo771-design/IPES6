from typing import Literal

from ninja import Schema, Field

# ==========================================
# 6. MATERIAS, PLANES Y HORARIOS
# ==========================================

class Horario(Schema):
    dia: str
    desde: str
    hasta: str

Cuatrimestre = Literal["ANUAL", "1C", "2C"]

class MateriaPlan(Schema):
    id: int
    nombre: str
    anio: int
    cuatrimestre: Cuatrimestre
    horarios: list[Horario] = Field(default_factory=list)
    correlativas_regular: list[int] = Field(default_factory=list)
    correlativas_aprob: list[int] = Field(default_factory=list)
    profesorado: str | None = None
    profesorado_id: int | None = None
    plan_id: int | None = None
    tipo_formacion: str | None = None
    formato: str | None = None
    horas_semana: int | None = None

class HistorialEstudiante(Schema):
    aprobadas: list[int] = Field(default_factory=list)
    regularizadas: list[int] = Field(default_factory=list)
    inscriptas_actuales: list[int] = Field(default_factory=list)
