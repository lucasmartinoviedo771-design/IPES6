# core/admin.py
from django.contrib import admin

from .models import (
    Correlatividad,
    CorrelatividadVersion,
    CorrelatividadVersionDetalle,
    Docente,
    Documento,
    Estudiante,
    EstudianteCarrera,
    Materia,
    PlanDeEstudio,
    Profesorado,
    Preinscripcion,
    Comision,
    Turno,
    StaffAsignacion,
    Bloque,
    HorarioCatedra,
    HorarioCatedraDetalle,
    VentanaHabilitacion,
    PreinscripcionChecklist,
    RequisitoDocumentacionTemplate,
    ProfesoradoRequisitoDocumentacion,
    EquivalenciaCurricular,
    InscripcionMateriaEstudiante,
    PedidoAnalitico,
    MesaExamen,
    InscripcionMesa,
    Regularidad,
    RegularidadFormato,
    RegularidadPlantilla,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    PlanillaRegularidadHistorial,
    ActaExamen,
    ActaExamenDocente,
    ActaExamenEstudiante,
    MessageTopic,
    Conversation,
    ConversationParticipant,
    Message,
    ConversationAudit,
)

# Registros de otros modelos (se mantienen)
admin.site.register(Profesorado)
admin.site.register(PlanDeEstudio)
admin.site.register(Materia)

@admin.register(Docente)
class DocenteAdmin(admin.ModelAdmin):
    list_display = ("dni", "apellido", "nombre", "email")
    search_fields = ("dni", "apellido", "nombre", "email")

admin.site.register(Correlatividad)
admin.site.register(CorrelatividadVersion)
admin.site.register(CorrelatividadVersionDetalle)
admin.site.register(Documento)
admin.site.register(Estudiante)
admin.site.register(EstudianteCarrera)
admin.site.register(Preinscripcion)
admin.site.register(Comision)
admin.site.register(Turno)
admin.site.register(StaffAsignacion)
admin.site.register(Bloque)
admin.site.register(HorarioCatedra)
admin.site.register(HorarioCatedraDetalle)
admin.site.register(VentanaHabilitacion)
admin.site.register(PreinscripcionChecklist)
admin.site.register(RequisitoDocumentacionTemplate)
admin.site.register(ProfesoradoRequisitoDocumentacion)
admin.site.register(EquivalenciaCurricular)
admin.site.register(InscripcionMateriaEstudiante)
admin.site.register(PedidoAnalitico)
admin.site.register(MesaExamen)
admin.site.register(InscripcionMesa)
admin.site.register(Regularidad)
admin.site.register(RegularidadFormato)
admin.site.register(RegularidadPlantilla)
admin.site.register(PlanillaRegularidad)
admin.site.register(PlanillaRegularidadDocente)
admin.site.register(PlanillaRegularidadFila)
admin.site.register(PlanillaRegularidadHistorial)
admin.site.register(ActaExamen)
admin.site.register(ActaExamenDocente)
admin.site.register(ActaExamenEstudiante)
admin.site.register(MessageTopic)
admin.site.register(Conversation)
admin.site.register(ConversationParticipant)
admin.site.register(Message)
admin.site.register(ConversationAudit)

from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'email')

