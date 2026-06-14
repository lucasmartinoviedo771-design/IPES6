from django.db.models.signals import post_save
from django.dispatch import receiver

from .base import Persona


@receiver(post_save, sender=Persona)
def sync_user_from_persona(sender, instance, **kwargs):
    """
    Sincroniza el username en el modelo User cuando cambia el DNI de la Persona.
    """
    user = None
    # 1. Intentar por UserProfile (Administrativos/Docentes con login)
    if hasattr(instance, "user_profile"):
        user = instance.user_profile.user
    # 2. Intentar por Estudiante (Alumnos)
    elif hasattr(instance, "estudiante_perfil"):
        user = instance.estudiante_perfil.user

    if user:
        # Sincronizamos SOLO username (DNI), necesario para login.
        # first_name/last_name/email se dejan INTACTOS a propósito: la fuente de verdad
        # es Persona (decisión P-1). No agregar sincronización de esos campos acá.
        # Sincronizar Username (DNI)
        if user.username != instance.dni:
            user.username = instance.dni
            user.save(update_fields=["username"])

from .preinscripciones import PreinscripcionChecklist
from .estudiantes import Estudiante

@receiver(post_save, sender=PreinscripcionChecklist)
def sync_estudiante_from_checklist(sender, instance, **kwargs):
    """
    Sincroniza los flags de documentación al modelo Estudiante 
    cuando se actualiza el checklist de una preinscripción.
    """
    estudiante = instance.preinscripcion.alumno
    fields_to_sync = [
        "dni_legalizado", "fotos_4x4", "certificado_salud", "folios_oficio",
        "titulo_secundario_legalizado", "certificado_titulo_en_tramite",
        "analitico_legalizado", "articulo_7", "adeuda_materias",
        "adeuda_materias_detalle", "escuela_secundaria", 
        "certificado_alumno_regular_sec", "es_certificacion_docente", 
        "titulo_terciario_univ", "incumbencia", "curso_introductorio_aprobado"
    ]
    
    updated = False
    for field in fields_to_sync:
        if hasattr(estudiante, field):
            val_cl = getattr(instance, field)
            val_est = getattr(estudiante, field)
            if val_cl != val_est:
                setattr(estudiante, field, val_cl)
                updated = True
            
    if updated:
        # Usamos una bandera para evitar recursión infinita
        estudiante._syncing_from_cl = True
        estudiante.save()

@receiver(post_save, sender=Estudiante)
def sync_checklists_from_estudiante(sender, instance, **kwargs):
    """
    Sincroniza los flags de documentación desde el legajo oficial (Estudiante)
    hacia todas sus preinscripciones activas.
    """
    if getattr(instance, '_syncing_from_cl', False):
        return
        
    checklists = PreinscripcionChecklist.objects.filter(
        preinscripcion__alumno=instance, 
        preinscripcion__activa=True
    )
    
    fields_to_sync = [
        "dni_legalizado", "fotos_4x4", "certificado_salud", "folios_oficio",
        "titulo_secundario_legalizado", "certificado_titulo_en_tramite",
        "analitico_legalizado", "articulo_7", "adeuda_materias",
        "adeuda_materias_detalle", "escuela_secundaria", 
        "certificado_alumno_regular_sec", "es_certificacion_docente", 
        "titulo_terciario_univ", "incumbencia", "curso_introductorio_aprobado"
    ]
    
    for cl in checklists:
        updated_cl = False
        for field in fields_to_sync:
            if hasattr(cl, field):
                val_est = getattr(instance, field)
                val_cl = getattr(cl, field)
                if val_est != val_cl:
                    setattr(cl, field, val_est)
                    updated_cl = True
        if updated_cl:
            cl.save()
