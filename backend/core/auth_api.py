# backend/core/auth_api.py
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect
from ninja import Router
from pydantic import BaseModel
from rest_framework_simplejwt.tokens import RefreshToken
import requests
from urllib.parse import urlencode

from apps.common.constants import AppErrorCode
from apps.common.error_schemas import ErrorResponse
from apps.common.errors import AppError
from .auth_ninja import JWTAuth

router = Router()  # <- IMPORTANTE


class LoginIn(BaseModel):
    login: str
    password: str


def _resolve_user_by_identifier(ident: str):
    User = get_user_model()
    ident = (ident or "").strip()
    u = User.objects.filter(email__iexact=ident).first() or User.objects.filter(username__iexact=ident).first()
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
    must_complete_profile: bool = False


class TokenOut(BaseModel):
    access: str
    refresh: str
    user: UserOut


class Message(BaseModel):
    detail: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


class RefreshIn(BaseModel):
    refresh: str | None = None


def _must_complete_profile(user) -> bool:
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return False
    datos_extra = getattr(estudiante, "datos_extra", {}) or {}
    return not bool(datos_extra.get("perfil_actualizado"))


def _serialize_user(user):
    estudiante = getattr(user, "estudiante", None)
    must_change = getattr(estudiante, "must_change_password", False)
    must_complete_profile = _must_complete_profile(user)
    return {
        "dni": user.username,
        "name": (user.get_full_name() or user.first_name or user.username),
        "roles": list(user.groups.values_list("name", flat=True)),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "must_change_password": bool(must_change),
        "must_complete_profile": bool(must_complete_profile),
    }


def _set_access_cookie(response: JsonResponse, access_token: str):
    access_token_lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    cookie_kwargs = {
        "key": settings.JWT_ACCESS_COOKIE_NAME,
        "value": access_token,
        "max_age": int(access_token_lifetime.total_seconds()),
        "httponly": True,
        "path": settings.JWT_COOKIE_PATH,
    }
    if not settings.DEBUG:
        cookie_kwargs["secure"] = settings.SESSION_COOKIE_SECURE
        cookie_kwargs["samesite"] = settings.SESSION_COOKIE_SAMESITE
    response.set_cookie(**cookie_kwargs)


def _set_refresh_cookie(response: JsonResponse, refresh_token: str):
    refresh_token_lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    cookie_kwargs = {
        "key": settings.JWT_REFRESH_COOKIE_NAME,
        "value": refresh_token,
        "max_age": int(refresh_token_lifetime.total_seconds()),
        "httponly": True,
        "path": settings.JWT_COOKIE_PATH,
    }
    if not settings.DEBUG:
        cookie_kwargs["secure"] = settings.SESSION_COOKIE_SECURE
        cookie_kwargs["samesite"] = settings.SESSION_COOKIE_SAMESITE
    response.set_cookie(**cookie_kwargs)


def _clear_jwt_cookies(response: JsonResponse):
    response.delete_cookie(key=settings.JWT_ACCESS_COOKIE_NAME, path=settings.JWT_COOKIE_PATH)
    response.delete_cookie(key=settings.JWT_REFRESH_COOKIE_NAME, path=settings.JWT_COOKIE_PATH)


def _client_identifier(request, login: str) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR", "") or "unknown"
    login_id = (login or "").strip().lower() or "anonymous"
    return f"auth:login:{ip}:{login_id}"


def _rate_limit_exceeded(cache_key: str) -> bool:
    limit = getattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 5)
    attempts = cache.get(cache_key)
    return attempts is not None and attempts >= limit


@router.post("/login/", response={200: TokenOut, 401: ErrorResponse, 429: ErrorResponse})
def login(request, payload: LoginIn):
    cache_key = _client_identifier(request, payload.login)
    window = getattr(settings, "LOGIN_RATE_LIMIT_WINDOW_SECONDS", 300)
    limit = getattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 5)

    if _rate_limit_exceeded(cache_key):
        raise AppError(429, AppErrorCode.RATE_LIMITED, "Demasiados intentos fallidos. Intenta nuevamente mÃ¡s tarde.")

    u = _resolve_user_by_identifier(payload.login)
    print(f"DEBUG: payload.login: {payload.login}")
    print(f"DEBUG: Resolved user (u): {u}")
    username = u.username if u else payload.login
    print(f"DEBUG: Username for authenticate: {username}")
    user = authenticate(request, username=username, password=payload.password)
    print(f"DEBUG: Result of authenticate: {user}")
    if not user:
        attempts = cache.get(cache_key, 0) + 1
        cache.set(cache_key, attempts, timeout=window)
        if attempts >= limit:
            raise AppError(429, AppErrorCode.RATE_LIMITED, "Demasiados intentos fallidos. Intenta nuevamente mÃ¡s tarde.")
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Credenciales invÃ¡lidas.")

    cache.delete(cache_key)
    refresh = RefreshToken.for_user(user)

    response_body = {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": _serialize_user(user),
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, str(refresh.access_token))
    _set_refresh_cookie(response, str(refresh))

    return response


@router.get("/profile/", response={200: UserOut, 401: ErrorResponse}, auth=JWTAuth())
def profile(request):
    if not request.user or not request.user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")
    u = request.user
    return {
        "dni": getattr(u, "username", ""),
        "name": u.get_full_name() or u.username,
        "roles": ["admin"] if u.is_staff else list(u.groups.values_list("name", flat=True)),
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "must_change_password": bool(getattr(getattr(u, "estudiante", None), "must_change_password", False)),
        "must_complete_profile": _must_complete_profile(u),
    }


@router.post("/change-password/", response={200: Message, 400: ErrorResponse}, auth=JWTAuth())
def change_password(request, payload: ChangePasswordIn):
    user = request.user
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")

    if not user.check_password(payload.current_password):
        raise AppError(400, AppErrorCode.AUTHENTICATION_FAILED, "La contraseÃ±a actual no es correcta.")

    try:
        validate_password(payload.new_password, user)
    except ValidationError as exc:
        raise AppError(
            400,
            AppErrorCode.VALIDATION_ERROR,
            "La nueva contraseÃ±a no cumple los requisitos.",
            details=exc.messages,
        )

    user.set_password(payload.new_password)
    user.save(update_fields=["password"])

    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.must_change_password:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    return {"detail": "ContraseÃ±a actualizada correctamente."}


@router.post("/logout/")
def logout(request):
    response = JsonResponse({"detail": "Sesión cerrada correctamente."})
    _clear_jwt_cookies(response)
    return response


@router.post("/refresh/", response={200: TokenOut, 401: ErrorResponse})
def refresh_token(request, payload: RefreshIn | None = None):
    token_value = None
    if payload and payload.refresh:
        token_value = payload.refresh.strip()
    if not token_value:
        token_value = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
    if not token_value:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Refresh token inválido.")

    try:
        incoming = RefreshToken(token_value)
    except Exception:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Refresh token inválido.")

    user_id = incoming.get("user_id")
    User = get_user_model()
    user = User.objects.filter(id=user_id).first()
    if not user:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Usuario no encontrado.")

    new_refresh = RefreshToken.for_user(user)
    response_body = {
        "access": str(new_refresh.access_token),
        "refresh": str(new_refresh),
        "user": _serialize_user(user),
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, str(new_refresh.access_token))
    _set_refresh_cookie(response, str(new_refresh))
    return response


@router.get("/google/login")
@router.get("/google/login/")
def google_login(request):
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or ""
    redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "") or ""
    if not client_id or not redirect_uri:
        raise AppError(503, AppErrorCode.AUTHENTICATION_FAILED, "Google OAuth no está configurado.")

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "include_granted_scopes": "true",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return HttpResponseRedirect(url)


@router.get("/google/callback", response={302: None, 401: ErrorResponse, 403: ErrorResponse})
@router.get("/google/callback/", response={302: None, 401: ErrorResponse, 403: ErrorResponse})
def google_callback(request, code: str | None = None, error: str | None = None):
    if error:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, f"Google OAuth error: {error}")
    if not code:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Codigo de autorizacion faltante.")

    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or ""
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "") or ""
    redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "") or ""
    if not client_id or not client_secret or not redirect_uri:
        raise AppError(503, AppErrorCode.AUTHENTICATION_FAILED, "Google OAuth no esta configurado.")

    try:
        token_resp = requests.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
            timeout=10,
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
    except Exception:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "No se pudo validar el codigo de Google.")

    if not access_token:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Token de Google invalido.")

    try:
        userinfo_resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
        userinfo = userinfo_resp.json()
    except Exception:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "No se pudo obtener el perfil de Google.")

    email = (userinfo.get("email") or "").strip().lower()
    if not email:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Google no devolvio un email.")

    User = get_user_model()
    user = User.objects.filter(email__iexact=email).first()
    if not user:
        raise AppError(
            403,
            AppErrorCode.AUTHENTICATION_FAILED,
            "Tu cuenta de Google no esta habilitada en el sistema. Usa tu usuario y contrasena o pedi acceso al administrador.",
        )

    refresh = RefreshToken.for_user(user)
    # response_body = {
    #     "access": str(refresh.access_token),
    #     # "refresh": str(refresh),
    #     "user": _serialize_user(user),
    # }
    # response = JsonResponse(response_body)
    
    # Redireccionar al frontend
    response = HttpResponseRedirect(settings.FRONTEND_URL + "/auth/callback")
    
    _set_access_cookie(response, str(refresh.access_token))
    _set_refresh_cookie(response, str(refresh))
    return response
