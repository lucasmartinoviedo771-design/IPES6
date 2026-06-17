from . import signals  # noqa: F401 — conecta las señales
from .actas import ActaExamen, ActaExamenDocente, ActaExamenEstudiante
from .auditoria import AuditLog, SystemLog
from .base import Docente, Persona, UserProfile
from .carreras import (
    Correlatividad,
    CorrelatividadVersion,
    CorrelatividadVersionDetalle,
    CorrelatividadVersionQuerySet,
    Documento,
    Materia,
    PlanDeEstudio,
    Profesorado,
)
from .curso_intro import CursoIntroductorioCohorte, CursoIntroductorioRegistro
from .estudiantes import Estudiante, EstudianteCarrera, ProrrogaTituloSecundario, ResidenciaCondicional
from .horarios import (
    Bloque,
    Comision,
    HorarioCatedra,
    HorarioCatedraDetalle,
    StaffAsignacion,
    Turno,
    VentanaHabilitacion,
)
from .inscripciones import EquivalenciaCurricular, InscripcionMateriaEstudiante, InscripcionMateriaMovimiento
from .mensajeria import (
    Conversation,
    ConversationAudit,
    ConversationParticipant,
    Message,
    MessageTopic,
    validate_pdf_attachment,
)
from .mesas import InscripcionMesa, MesaActaOral, MesaExamen, SolicitudMesa
from .pedidos import (
    EquivalenciaDisposicion,
    EquivalenciaDisposicionDetalle,
    PedidoAnalitico,
    PedidoEquivalencia,
    PedidoEquivalenciaMateria,
)
from .preinscripciones import (
    Preinscripcion,
    PreinscripcionChecklist,
    ProfesoradoRequisitoDocumentacion,
    RequisitoDocumentacionTemplate,
)
from .regularidades import (
    PlanillaCursada,  # noqa: F401
    PlanillaCursadaFila,  # noqa: F401
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    PlanillaRegularidadHistorial,
    Regularidad,
    RegularidadFormato,
    RegularidadPlanillaLock,
    RegularidadPlantilla,
)

__all__ = [
    # base
    "Persona",
    "Docente",
    "UserProfile",
    # carreras
    "Profesorado",
    "PlanDeEstudio",
    "Materia",
    "Correlatividad",
    "CorrelatividadVersionQuerySet",
    "CorrelatividadVersion",
    "CorrelatividadVersionDetalle",
    "Documento",
    # estudiantes
    "Estudiante",
    "EstudianteCarrera",
    "ProrrogaTituloSecundario",
    "ResidenciaCondicional",
    # horarios
    "Turno",
    "Bloque",
    "HorarioCatedra",
    "HorarioCatedraDetalle",
    "Comision",
    "StaffAsignacion",
    "VentanaHabilitacion",
    # preinscripciones
    "Preinscripcion",
    "PreinscripcionChecklist",
    "RequisitoDocumentacionTemplate",
    "ProfesoradoRequisitoDocumentacion",
    # inscripciones
    "InscripcionMateriaEstudiante",
    "InscripcionMateriaMovimiento",
    "EquivalenciaCurricular",
    # curso_intro
    "CursoIntroductorioCohorte",
    "CursoIntroductorioRegistro",
    # pedidos
    "PedidoAnalitico",
    "PedidoEquivalencia",
    "PedidoEquivalenciaMateria",
    "EquivalenciaDisposicion",
    "EquivalenciaDisposicionDetalle",
    # mesas
    "MesaExamen",
    "InscripcionMesa",
    "MesaActaOral",
    "SolicitudMesa",
    # regularidades
    "Regularidad",
    "RegularidadFormato",
    "RegularidadPlantilla",
    "PlanillaRegularidad",
    "PlanillaRegularidadDocente",
    "PlanillaRegularidadFila",
    "PlanillaRegularidadHistorial",
    "RegularidadPlanillaLock",
    # actas
    "ActaExamen",
    "ActaExamenDocente",
    "ActaExamenEstudiante",
    # mensajeria
    "validate_pdf_attachment",
    "MessageTopic",
    "Conversation",
    "ConversationParticipant",
    "Message",
    "ConversationAudit",
    # auditoria
    "AuditLog",
    "SystemLog",
]
