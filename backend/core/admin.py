# core/admin.py
from django.contrib import admin

from .models import (
    Correlatividad,
    Docente,
    Documento,
    Estudiante,
    Materia,
    PlanDeEstudio,
    Profesorado,
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
admin.site.register(Documento)

from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff')
    search_fields = ('username', 'first_name', 'last_name', 'email')

