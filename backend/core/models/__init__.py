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
from .estudiantes import Estudiante, EstudianteCarrera
from .horarios import (
    Bloque,
    Comision,
    HorarioCatedra,
    HorarioCatedraDetalle,
    StaffAsignacion,
    Turno,
    VentanaHabilitacion,
)
from .preinscripciones import (
    PreinscripcionChecklist,
    Preinscripcion,
    ProfesoradoRequisitoDocumentacion,
    RequisitoDocumentacionTemplate,
)
from .inscripciones import EquivalenciaCurricular, InscripcionMateriaEstudiante
from .curso_intro import CursoIntroductorioCohorte, CursoIntroductorioRegistro
from .pedidos import (
    EquivalenciaDisposicion,
    EquivalenciaDisposicionDetalle,
    PedidoAnalitico,
    PedidoEquivalencia,
    PedidoEquivalenciaMateria,
)
from .mesas import InscripcionMesa, MesaActaOral, MesaExamen
from .regularidades import (
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    PlanillaRegularidadHistorial,
    Regularidad,
    RegularidadFormato,
    RegularidadPlanillaLock,
    RegularidadPlantilla,
)
from .actas import ActaExamen, ActaExamenDocente, ActaExamenEstudiante
from .mensajeria import (
    Conversation,
    ConversationAudit,
    ConversationParticipant,
    Message,
    MessageTopic,
    validate_pdf_attachment,
)
from .auditoria import AuditLog, SystemLog
from . import signals  # noqa: F401 — conecta las señales

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
