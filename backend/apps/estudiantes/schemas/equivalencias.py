from datetime import date
from typing import Literal

from ninja import Schema, Field

from apps.estudiantes.schemas.materias import Cuatrimestre, Horario
from apps.estudiantes.schemas.inscripciones import ComisionResumen

# ==========================================
# 10. EQUIVALENCIAS Y TRÁMITES
# ==========================================

class EquivalenciaItem(Schema):
    materia_id: int
    materia_nombre: str
    plan_id: int | None = None
    profesorado_id: int | None = None
    profesorado: str
    cuatrimestre: Cuatrimestre
    horarios: list[Horario] = Field(default_factory=list)
    comisiones: list[ComisionResumen] = Field(default_factory=list)

class PedidoAnaliticoIn(Schema):
    motivo: Literal["equivalencia", "beca", "control", "otro"]
    motivo_otro: str | None = None
    dni: str | None = None
    cohorte: int | None = None
    profesorado_id: int | None = None
    plan_id: int | None = None

class PedidoAnaliticoOut(Schema):
    message: str

class PedidoAnaliticoItem(Schema):
    id: int
    dni: str
    apellido_nombre: str
    profesorado: str | None
    anio_cursada: int | None = None
    cohorte: int | None
    fecha_solicitud: str
    motivo: str
    motivo_otro: str | None = None
    estado: str = "PEND"

class PedidoEquivalenciaMateriaIn(Schema):
    nombre: str = Field(..., min_length=1)
    formato: str | None = None
    anio_cursada: str | None = None
    nota: str | None = None

class PedidoEquivalenciaSaveIn(Schema):
    tipo: Literal["ANEXO_A", "ANEXO_B"]
    ciclo_lectivo: str | None = None
    profesorado_destino_id: int | None = None
    profesorado_destino_nombre: str | None = None
    plan_destino_id: int | None = None
    plan_destino_resolucion: str | None = None
    profesorado_origen_nombre: str | None = None
    plan_origen_resolucion: str | None = None
    establecimiento_origen: str | None = None
    establecimiento_localidad: str | None = None
    establecimiento_provincia: str | None = None
    materias: list[PedidoEquivalenciaMateriaIn] = Field(default_factory=list)

class PedidoEquivalenciaMateriaOut(Schema):
    id: int
    nombre: str
    formato: str | None = None
    anio_cursada: str | None = None
    nota: str | None = None
    resultado: Literal["pendiente", "otorgada", "rechazada"] | None = None
    observaciones: str | None = None

class PedidoEquivalenciaTimeline(Schema):
    formulario_descargado_en: str | None = None
    inscripcion_verificada_en: str | None = None
    documentacion_registrada_en: str | None = None
    evaluacion_registrada_en: str | None = None
    titulos_registrado_en: str | None = None
    notificado_en: str | None = None

class PedidoEquivalenciaOut(Schema):
    id: int
    tipo: Literal["ANEXO_A", "ANEXO_B"]
    estado: Literal["draft", "final"]
    estado_display: str
    workflow_estado: Literal["draft", "pending_docs", "review", "titulos", "notified"]
    workflow_estado_display: str
    ciclo_lectivo: str | None = None
    profesorado_destino_id: int | None = None
    profesorado_destino_nombre: str | None = None
    plan_destino_id: int | None = None
    plan_destino_resolucion: str | None = None
    profesorado_origen_nombre: str | None = None
    plan_origen_resolucion: str | None = None
    establecimiento_origen: str | None = None
    establecimiento_localidad: str | None = None
    establecimiento_provincia: str | None = None
    ventana_id: int
    ventana_label: str
    created_at: str
    updated_at: str
    bloqueado_en: str | None = None
    puede_editar: bool = False
    estudiante_dni: str
    estudiante_nombre: str | None = None
    requiere_tutoria: bool = False
    documentacion_presentada: bool = False
    documentacion_detalle: str | None = None
    documentacion_cantidad: int | None = None
    documentacion_registrada_en: str | None = None
    evaluacion_observaciones: str | None = None
    evaluacion_registrada_en: str | None = None
    resultado_final: Literal["pendiente", "otorgada", "denegada", "mixta"]
    titulos_documento_tipo: Literal["ninguno", "nota", "disposicion", "ambos"]
    titulos_nota_numero: str | None = None
    titulos_nota_fecha: str | None = None
    titulos_disposicion_numero: str | None = None
    titulos_disposicion_fecha: str | None = None
    titulos_observaciones: str | None = None
    titulos_registrado_en: str | None = None
    materias: list[PedidoEquivalenciaMateriaOut] = Field(default_factory=list)
    timeline: PedidoEquivalenciaTimeline | None = None

PedidoEquivalenciaOut.model_rebuild()


class PedidoEquivalenciaDocumentacionIn(Schema):
    presentada: bool
    cantidad: int | None = None
    detalle: str | None = None

class PedidoEquivalenciaEvaluacionMateriaIn(Schema):
    id: int
    resultado: Literal["otorgada", "rechazada"]
    observaciones: str | None = None

class PedidoEquivalenciaEvaluacionIn(Schema):
    materias: list[PedidoEquivalenciaEvaluacionMateriaIn]
    observaciones: str | None = None

class PedidoEquivalenciaTitulosIn(Schema):
    nota_numero: str | None = None
    nota_fecha: str | None = None
    disposicion_numero: str | None = None
    disposicion_fecha: str | None = None
    observaciones: str | None = None

class PedidoEquivalenciaNotificarIn(Schema):
    mensaje: str | None = None

class EquivalenciaDisposicionDetalleIn(Schema):
    materia_id: int
    nota: str

class EquivalenciaDisposicionDetalleOut(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    nota: str

class EquivalenciaDisposicionCreateIn(Schema):
    dni: str
    profesorado_id: int
    plan_id: int
    numero_disposicion: str
    fecha_disposicion: date
    observaciones: str | None = None
    detalles: list[EquivalenciaDisposicionDetalleIn] = Field(default_factory=list)

class EquivalenciaDisposicionOut(Schema):
    id: int
    origen: Literal["primera_carga", "secretaria"]
    estudiante_dni: str
    estudiante_nombre: str
    numero_disposicion: str
    fecha_disposicion: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    observaciones: str | None = None
    creado_por: str | None = None
    creado_en: str
    detalles: list[EquivalenciaDisposicionDetalleOut] = Field(default_factory=list)

EquivalenciaDisposicionOut.model_rebuild()


class EquivalenciaMateriaPendiente(Schema):
    id: int
    nombre: str
    anio: int
    plan_id: int
