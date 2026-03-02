with open("core/auth_api.py", "r") as f:
    content = f.read()

import re

new_func = """def _must_complete_profile(user) -> bool:
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return False
        
    # Si es docente o parte del equipo de gestión, no bloqueamos el login
    # exigiendo que complete el perfil de estudiante primero.
    management_roles = {
        "admin", "secretaria", "bedel", "docente", 
        "coordinador", "tutor", "jefes", "jefa_aaee", 
        "equivalencias", "titulos"
    }
    user_roles = {g.name.lower().strip() for g in user.groups.all()}
    if user.is_staff or user.is_superuser or user_roles.intersection(management_roles):
        return False

    datos_extra = getattr(estudiante, "datos_extra", {}) or {}
    return not bool(datos_extra.get("perfil_actualizado"))"""

content = re.sub(
    r'def _must_complete_profile\(user\) -> bool:[\s\S]*?return not bool\(datos_extra\.get\("perfil_actualizado"\)\)',
    new_func,
    content
)

with open("core/auth_api.py", "w") as f:
    f.write(content)
