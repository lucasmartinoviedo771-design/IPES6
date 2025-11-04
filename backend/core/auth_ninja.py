from ninja.security.base import AuthBase
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from functools import wraps # Import wraps
from django.conf import settings
from ninja.errors import HttpError # Import HttpError

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
                raise HttpError(401, "Unauthorized")

            user_roles = {name.lower() for name in request.user.groups.values_list("name", flat=True)}
            if request.user.is_superuser or request.user.is_staff:
                user_roles.add("admin") # Consider staff users as admin-equivalent

            required = {role.lower() for role in required_roles}

            if not user_roles.intersection(required):
                raise HttpError(403, "Forbidden")
            return func(request, *args, **kwargs)
        return wrapper
    return decorator
