from ninja import Schema
from datetime import time

class TurnoIn(Schema):
    nombre: str

class TurnoOut(Schema):
    id: int
    nombre: str

class BloqueIn(Schema):
    turno_id: int
    dia: int
    hora_desde: time
    hora_hasta: time
    es_recreo: bool = False

class BloqueOut(Schema):
    id: int
    turno_id: int
    dia: int
    hora_desde: time
    hora_hasta: time
    es_recreo: bool
    dia_display: str
    turno_nombre: str

class HorarioCatedraIn(Schema):
    espacio_id: int
    turno_id: int
    anio_cursada: int
    cuatrimestre: str | None = None

class HorarioCatedraOut(Schema):
    id: int
    espacio_id: int
    turno_id: int
    anio_cursada: int
    cuatrimestre: str | None
    espacio_nombre: str
    turno_nombre: str

class HorarioCatedraDetalleIn(Schema):
    bloque_id: int

class HorarioCatedraDetalleOut(Schema):
    id: int
    horario_catedra_id: int
    bloque_id: int
    bloque_dia: int
    bloque_hora_desde: time
    bloque_hora_hasta: time
