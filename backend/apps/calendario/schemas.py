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

    @staticmethod
    def resolve_dia_display(obj):
        return obj.get_dia_display()

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

    @staticmethod
    def resolve_espacio_nombre(obj):
        return obj.espacio.nombre if hasattr(obj, 'espacio') else ""

    @staticmethod
    def resolve_turno_nombre(obj):
        return obj.turno.nombre if hasattr(obj, 'turno') else ""

class HorarioCatedraDetalleIn(Schema):
    bloque_id: int

class HorarioCatedraDetalleOut(Schema):
    id: int
    horario_catedra_id: int
    bloque_id: int
    bloque_dia: int
    bloque_hora_desde: time
    bloque_hora_hasta: time

    @staticmethod
    def resolve_bloque_dia(obj):
        return obj.bloque.dia

    @staticmethod
    def resolve_bloque_hora_desde(obj):
        return obj.bloque.hora_desde

    @staticmethod
    def resolve_bloque_hora_hasta(obj):
        return obj.bloque.hora_hasta
