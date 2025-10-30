# backend/core/auth_api.py
from ninja import Router
from .auth_ninja import JWTAuth
from pydantic import BaseModel
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from ninja.errors import HttpError

from django.http import HttpResponse, JsonResponse

router = Router()  # <— IMPORTANTE

class LoginIn(BaseModel):
    login: str
    password: str

def _resolve_user_by_identifier(ident: str):
    User = get_user_model()
    ident = (ident or "").strip()
    u = User.objects.filter(email__iexact=ident).first() or \
        User.objects.filter(username__iexact=ident).first()
    if not u and ident.isdigit():
        u = User.objects.filter(username__iexact=ident).first()
        if not u:
            try:
                from apps.personas.models import Perfil
                p = Perfil.objects.filter(dni=ident).select_related("user").first()
                if p and p.user:
                    u = p.user
            except Exception:
                pass
    return u

class UserOut(BaseModel):
    dni: str
    name: str
    roles: list[str]
    is_staff: bool
    is_superuser: bool
    must_change_password: bool = False

class TokenOut(BaseModel):
    access: str
    refresh: str
    user: UserOut

class Error(BaseModel):
    detail: str


class Message(BaseModel):
    detail: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


def _client_identifier(request, login: str) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "") or "unknown"
    login_id = (login or "").strip().lower() or "anonymous"
    return f"auth:login:{ip}:{login_id}"


def _rate_limit_exceeded(cache_key: str) -> bool:
    limit = getattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 5)
    attempts = cache.get(cache_key)
    return attempts is not None and attempts >= limit

@router.post("/login")
def login(request, payload: LoginIn):
    cache_key = _client_identifier(request, payload.login)
    window = getattr(settings, "LOGIN_RATE_LIMIT_WINDOW_SECONDS", 300)
    limit = getattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 5)

    if _rate_limit_exceeded(cache_key):
        return 429, {"detail": "Demasiados intentos fallidos. Intenta nuevamente mas tarde."}

    u = _resolve_user_by_identifier(payload.login)
    username = u.username if u else payload.login
    user = authenticate(request, username=username, password=payload.password)
    if not user:
        attempts = cache.get(cache_key, 0) + 1
        cache.set(cache_key, attempts, timeout=window)
        if attempts >= limit:
            return 429, {"detail": "Demasiados intentos fallidos. Intenta nuevamente mas tarde."}
        return 401, {"detail": "Credenciales invalidas"}

    cache.delete(cache_key)
    refresh = RefreshToken.for_user(user)

    # Prepare user data for response
    estudiante = getattr(user, "estudiante", None)
    must_change = getattr(estudiante, "must_change_password", False)
    user_data = {
        "dni": user.username,
        "name": (user.get_full_name() or user.first_name or user.username),
        "roles": list(user.groups.values_list("name", flat=True)),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "must_change_password": bool(must_change),
    }

    # Create JSON response body
    response_body = {
        "refresh": str(refresh),
        "user": user_data,
    }
    response = JsonResponse(response_body)

    access_token_lifetime = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME']
    cookie_kwargs = {
        'key': settings.JWT_ACCESS_COOKIE_NAME,
        'value': str(refresh.access_token),
        'max_age': int(access_token_lifetime.total_seconds()),
        'httponly': True,
        'path': settings.JWT_COOKIE_PATH,
    }

    if not settings.DEBUG:
        cookie_kwargs['secure'] = settings.SESSION_COOKIE_SECURE
        cookie_kwargs['samesite'] = settings.SESSION_COOKIE_SAMESITE

    response.set_cookie(**cookie_kwargs)

    return response

@router.get("/profile", response={200: UserOut}, auth=JWTAuth())
def profile(request):
    if not request.user or not request.user.is_authenticated:
        raise HttpError(401, "Unauthorized")
    u = request.user
    return {
        "dni": getattr(u, "username", ""),
        "name": u.get_full_name() or u.username,
        "roles": ["admin"] if u.is_staff else list(u.groups.values_list("name", flat=True)),
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "must_change_password": bool(getattr(getattr(u, "estudiante", None), "must_change_password", False)),
    }


@router.post("/change-password", response={200: Message, 400: Error}, auth=JWTAuth())
def change_password(request, payload: ChangePasswordIn):
    user = request.user
    if not user or not user.is_authenticated:
        raise HttpError(401, "Unauthorized")

    if not user.check_password(payload.current_password):
        return 400, {"detail": "La contraseña actual no es correcta."}

    try:
        validate_password(payload.new_password, user)
    except ValidationError as exc:
        return 400, {"detail": "; ".join(exc.messages)}

    user.set_password(payload.new_password)
    user.save(update_fields=["password"])

    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.must_change_password:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    return {"detail": "Contraseña actualizada correctamente."}

@router.post("/logout")
def logout(request):
    response = JsonResponse({"detail": "Sesión cerrada correctamente."})
    response.delete_cookie(key=settings.JWT_ACCESS_COOKIE_NAME, path=settings.JWT_COOKIE_PATH)
    return response
