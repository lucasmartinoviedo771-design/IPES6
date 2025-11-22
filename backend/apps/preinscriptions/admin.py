from django.contrib import admin
from .models_uploads import PreinscripcionArchivo

@admin.register(PreinscripcionArchivo)
class PreinscripcionArchivoAdmin(admin.ModelAdmin):
    list_display = ('preinscripcion_id', 'tipo', 'nombre_original', 'tamano', 'creado_en')
    list_filter = ('tipo', 'creado_en')
    search_fields = ('preinscripcion_id', 'nombre_original')
