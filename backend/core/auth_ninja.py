"""
Módulo de seguridad para Django Ninja.
Provee clases de autenticación basadas en JWT y decoradores para control de acceso basado en roles (RBAC).
"""

from functools import wraps
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja.security.base import AuthBase
from .authentication.jwt_service import JWTService

from apps.common.constants import AppErrorCode
from apps.common.errors import AppError

User = get_user_model()


class JWTAuth(AuthBase):
    """
    Sistema de autenticación por JWT para la API.
    Soporta extracción de tokens desde Cookies (preferido por seguridad HttpOnly)
    y desde el encabezado Authorization (Bearer token).
    """
    openapi_type = "http"
    openapi_scheme = "bearer"
    openapi_bearer_format = "JWT"

    def __call__(self, request):
        """
        Intercepta la petición para validar la identidad del usuario.
        Retorna el objeto User si es válido, de lo contrario None (gatilla 401 en Ninja).
        """
        # Prioridad 1: Sesión ya autenticada (ej: Panel de Admin de Django)
        if getattr(request, "user", None) and request.user.is_authenticated:
            return request.user

        # Prioridad 2: Cookie de acceso (HttpOnly)
        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)

        # Prioridad 3: Header Authorization
        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1]

        if not token:
            return None

        # Validación criptográfica contra la base de datos/secretos
        user = JWTService.get_user_from_token(token)
        if user:
            request.user = user
            return user
        return None


def ensure_roles(required_roles: list[str]):
    """
    Decorador para validar la pertenencia del usuario a roles específicos.
    Acepta una lista de roles (ej: ['admin', 'bedel']).

    Lógica de mapeo:
    Normaliza los nombres de los Grupos de Django (ej: 'Bedel Informática' -> 'bedel')
    para facilitar la validación declarativa en los Routers.
    """
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")

            # Normalización y extracción de roles reales del usuario
            raw_names = {name.lower().strip() for name in request.user.groups.values_list("name", flat=True)}
            user_roles = set(raw_names)

            # Clasificación inteligente basada en prefijos de grupos
            for name in raw_names:
                if name.startswith("bedel"):
                    user_roles.add("bedel")
                if name.startswith("secretaria"):
                    user_roles.add("secretaria")
                if name.startswith("coordinador"):
                    user_roles.add("coordinador")
                if name == "estudiantes" or "estudiante" in name:
                    user_roles.add("estudiante")
                if name == "docentes" or "docente" in name:
                    user_roles.add("docente")

            # Los superusuarios o staff tienen el rol implicito de admin
            if request.user.is_superuser or request.user.is_staff:
                user_roles.add("admin")

            required = {role.lower() for role in required_roles}

            # Intersección de conjuntos para validación eficiente
            if not user_roles.intersection(required):
                raise AppError(
                    403,
                    AppErrorCode.PERMISSION_DENIED,
                    "No tiene permisos para realizar esta acción."
                )
            return func(request, *args, **kwargs)

        return wrapper

    return decorator
