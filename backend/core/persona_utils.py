"""
Acceso a datos de contacto vía Persona (fuente única de verdad, ver P-1 en
CLAUDE.md). No leer nunca User.email directamente: puede tener datos
históricos sucios.
"""


def get_persona_email(user) -> str | None:
    """Devuelve el email cargado en Persona para este User, o None si no
    tiene perfil asociado o no tiene email cargado."""
    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.persona and estudiante.persona.email:
        return estudiante.persona.email

    profile = getattr(user, "profile", None)
    if profile and profile.persona and profile.persona.email:
        return profile.persona.email

    return None
