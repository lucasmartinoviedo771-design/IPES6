from functools import wraps
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja.security.base import AuthBase
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken

from apps.common.constants import AppErrorCode
from apps.common.errors import AppError

User = get_user_model()


class JWTAuth(AuthBase):
    openapi_type = "http"
    openapi_scheme = "bearer"
    openapi_bearer_format = "JWT"

    def __call__(self, request):
        # Permitir sesiones tradicionales si ya hay usuario autenticado
        if getattr(request, "user", None) and request.user.is_authenticated:
            return request.user

        token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)

        if not token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.lower().startswith("bearer "):
                token = auth_header.split(" ", 1)[1]

        if not token:
            return None

        try:
            untyped = UntypedToken(token)
            user_id = untyped.payload.get("user_id")
            if not user_id:
                return None
            user = User.objects.get(pk=user_id)
            request.user = user
            return user
        except (InvalidToken, TokenError, User.DoesNotExist):
            return None


def ensure_roles(required_roles: list[str]):
    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not request.user or not request.user.is_authenticated:
                raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")

            raw_names = {name.lower().strip() for name in request.user.groups.values_list("name", flat=True)}
            user_roles = set(raw_names)
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

            if request.user.is_superuser or request.user.is_staff:
                user_roles.add("admin")

            required = {role.lower() for role in required_roles}

            if not user_roles.intersection(required):
                raise AppError(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos para realizar esta acción.")
            return func(request, *args, **kwargs)

        return wrapper

    return decorator
