from django.contrib import admin

from .models import (
    AsistenciaAlumno,
    AsistenciaDocente,
    ClaseProgramada,
    CursoAlumnoSnapshot,
    CursoHorarioSnapshot,
    DocenteMarcacionLog,
    Justificacion,
    JustificacionDetalle,
    CalendarioAsistenciaEvento,
)


@admin.register(CursoHorarioSnapshot)
class CursoHorarioSnapshotAdmin(admin.ModelAdmin):
    list_display = ("comision", "dia_semana", "hora_inicio", "hora_fin", "sincronizado_en")
    list_filter = ("dia_semana",)
    search_fields = ("comision__nombre", "comision__codigo")


@admin.register(CursoAlumnoSnapshot)
class CursoAlumnoSnapshotAdmin(admin.ModelAdmin):
    list_display = ("comision", "dni", "apellido", "nombre", "activo", "sincronizado_en")
    list_filter = ("activo",)
    search_fields = ("dni", "apellido", "nombre", "comision__nombre")


@admin.register(ClaseProgramada)
class ClaseProgramadaAdmin(admin.ModelAdmin):
    list_display = ("comision", "fecha", "estado", "docente_nombre")
    list_filter = ("estado", "fecha")
    search_fields = ("comision__nombre", "docente_nombre", "docente_dni")
    date_hierarchy = "fecha"


@admin.register(AsistenciaAlumno)
class AsistenciaAlumnoAdmin(admin.ModelAdmin):
    list_display = ("clase", "estudiante", "estado", "registrado_via", "registrado_en")
    list_filter = ("estado", "registrado_via")
    search_fields = ("estudiante__dni", "estudiante__user__first_name", "estudiante__user__last_name")


@admin.register(AsistenciaDocente)
class AsistenciaDocenteAdmin(admin.ModelAdmin):
    list_display = (
        "clase",
        "docente",
        "estado",
        "marcacion_categoria",
        "alerta",
        "registrado_via",
        "registrado_en",
    )
    list_filter = ("estado", "registrado_via", "marcacion_categoria", "alerta")
    search_fields = ("docente__dni", "docente__apellido", "docente__nombre")
    autocomplete_fields = ("docente", "clase", "justificacion", "registrado_por")


@admin.register(Justificacion)
class JustificacionAdmin(admin.ModelAdmin):
    list_display = ("motivo", "tipo", "estado", "vigencia_desde", "vigencia_hasta", "creado_en")
    list_filter = ("tipo", "estado", "origen")
    date_hierarchy = "creado_en"
    search_fields = ("motivo", "observaciones")


@admin.register(JustificacionDetalle)
class JustificacionDetalleAdmin(admin.ModelAdmin):
    list_display = ("justificacion", "clase", "estudiante", "docente", "aplica_automaticamente")
    list_filter = ("aplica_automaticamente",)
    search_fields = ("justificacion__motivo", "clase__comision__nombre")


@admin.register(DocenteMarcacionLog)
class DocenteMarcacionLogAdmin(admin.ModelAdmin):
    list_display = ("dni", "resultado", "alerta", "registrado_en", "detalle")
    list_filter = ("resultado", "alerta")
    search_fields = ("dni", "detalle")
    autocomplete_fields = ("docente", "clase")


@admin.register(CalendarioAsistenciaEvento)
class CalendarioAsistenciaEventoAdmin(admin.ModelAdmin):
    list_display = (
        "nombre",
        "tipo",
        "subtipo",
        "fecha_desde",
        "fecha_hasta",
        "turno",
        "profesorado",
        "plan",
        "comision",
        "docente",
        "activo",
    )
    list_filter = ("tipo", "subtipo", "activo", "turno", "profesorado")
    search_fields = ("nombre", "motivo", "docente__apellido", "docente__dni", "comision__codigo")
    date_hierarchy = "fecha_desde"
