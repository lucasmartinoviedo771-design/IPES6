# core/admin.py
from django.contrib import admin
from django.utils.safestring import mark_safe
from .models import (
    Profesorado, PlanDeEstudio, Materia, 
    Docente, Correlatividad, Estudiante, Documento
)

# Registros de otros modelos (se mantienen)
admin.site.register(Profesorado)
admin.site.register(PlanDeEstudio)
admin.site.register(Materia)
admin.site.register(Docente)
admin.site.register(Correlatividad)
admin.site.register(Documento)
admin.site.register(Estudiante)