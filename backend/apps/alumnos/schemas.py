from ninja import Schema
from typing import Optional, List, Literal

class InscripcionCarreraIn(Schema):
    carrera_id: int

class InscripcionCarreraOut(Schema):
    message: str

class InscripcionMateriaIn(Schema):
    materia_id: int

class InscripcionMateriaOut(Schema):
    message: str

class CambioComisionIn(Schema):
    comision_actual_id: int
    comision_nueva_id: int

class CambioComisionOut(Schema):
    message: str

class PedidoAnaliticoOut(Schema):
    message: str

class MesaExamenIn(Schema):
    materia_id: int
    tipo_examen: str # parcial, final, libre, extraordinaria

class MesaExamenOut(Schema):
    message: str

class InscripcionMesaIn(Schema):
    mesa_id: int
    dni: Optional[str] = None

class InscripcionMesaOut(Schema):
    message: str

# Regularidad (importación por planilla)
class RegularidadRowIn(Schema):
    dni: str
    nombre: Optional[str] = None
    nota_final: Optional[int] = None
    situacion: str  # texto tal como en planilla (REGULAR, LIBRE-AT, etc.)

class RegularidadImportIn(Schema):
    materia_id: int
    fecha: str  # YYYY-MM-DD
    formato: Literal['ASIG', 'MOD', 'TAL']
    filas: List[RegularidadRowIn]

class RegularidadItemOut(Schema):
    dni: str
    nombre: Optional[str]
    materia_id: int
    fecha: str
    nota_final: Optional[int]
    situacion: str

# Nuevos schemas para materias-plan e historial
class Horario(Schema):
    dia: str
    desde: str
    hasta: str

Cuatrimestre = Literal['ANUAL','1C','2C']

class MateriaPlan(Schema):
    id: int
    nombre: str
    anio: int
    cuatrimestre: Cuatrimestre
    horarios: List[Horario] = []
    correlativas_regular: List[int] = []
    correlativas_aprob: List[int] = []
    profesorado: Optional[str] = None

class HistorialAlumno(Schema):
    aprobadas: List[int] = []
    regularizadas: List[int] = []
    inscriptas_actuales: List[int] = []

class EquivalenciaItem(Schema):
    materia_id: int
    materia_nombre: str
    profesorado: str
    horarios: List[Horario] = []

class PedidoAnaliticoIn(Schema):
    motivo: Literal['equivalencia','beca','control','otro']
    motivo_otro: Optional[str] = None
    dni: Optional[str] = None  # para que bedel/secretaría/admin soliciten por alumno
    cohorte: Optional[int] = None

class PedidoAnaliticoOut(Schema):
    message: str

class PedidoAnaliticoItem(Schema):
    dni: str
    apellido_nombre: str
    profesorado: Optional[str]
    anio_cursada: Optional[int] = None  # placeholder
    cohorte: Optional[int]
    fecha_solicitud: str  # ISO
    motivo: str
    motivo_otro: Optional[str] = None
