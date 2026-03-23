from django.db.models.signals import post_save
from django.dispatch import receiver

from .base import Persona


@receiver(post_save, sender=Persona)
def sync_user_from_persona(sender, instance, **kwargs):
    """
    Sincroniza los datos en el modelo User cuando cambia la Persona.
    Incluye Nombre, Apellido y DNI (como username).
    """
    user = None
    # 1. Intentar por UserProfile (Administrativos/Docentes con login)
    if hasattr(instance, "user_profile"):
        user = instance.user_profile.user
    # 2. Intentar por Estudiante (Alumnos)
    elif hasattr(instance, "estudiante_perfil"):
        user = instance.estudiante_perfil.user

    if user:
        update_fields = []

        # Sincronizar Username (DNI)
        if user.username != instance.dni:
            user.username = instance.dni
            update_fields.append("username")

        # Sincronizar Nombre
        if user.first_name != instance.nombre:
            user.first_name = instance.nombre
            update_fields.append("first_name")

        # Sincronizar Apellido
        if user.last_name != instance.apellido:
            user.last_name = instance.apellido
            update_fields.append("last_name")

        if update_fields:
            user.save(update_fields=update_fields)
