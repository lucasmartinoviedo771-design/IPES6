from ninja import Router, Schema
from django.http import HttpRequest
from core.auth_ninja import JWTAuth
import os
from django.conf import settings

router = Router(tags=["Guias"])

class GuiaUsuarioSchema(Schema):
    rol: str
    manual: str

class ErrorSchema(Schema):
    message: str

@router.get("/guia-usuario", response={200: GuiaUsuarioSchema, 404: ErrorSchema}, auth=JWTAuth())
def guia_usuario(request: HttpRequest):
    """
    Devuelve la guía de usuario correspondiente al rol de la persona logueada.
    """
    user = request.auth
    roles = [g.name for g in user.groups.all()]
    
    # Usamos el primer rol que encontremos. Se puede mejorar esta lógica si es necesario.
    # Damos prioridad a roles más específicos si existen.
    role_priority = ['admin', 'secretaria', 'bedel', 'coordinador', 'tutor', 'jefes', 'jefa_aaee', 'alumno']
    user_role = next((r for r in role_priority if r in roles), None)

    if not user_role:
        if user.is_superuser:
            user_role = 'admin'
        else:
            return 404, {"message": "No se pudo determinar un rol para el usuario."}

    manual_filename = f"manual_{user_role}.txt"
    manual_path = os.path.join(settings.BASE_DIR, '..', 'docs', 'manuales', manual_filename)

    try:
        with open(manual_path, 'r', encoding='utf-8') as f:
            manual_content = f.read()
    except FileNotFoundError:
        return 404, {"message": f"No se encontró un manual para el rol '{user_role}'."}
    except Exception as e:
        return 404, {"message": f"Error al leer el manual: {str(e)}"}

    return 200, {"rol": user_role, "manual": manual_content}
