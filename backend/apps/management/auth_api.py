# backend/core/auth_api.py
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.http import JsonResponse, HttpResponseRedirect
from ninja import Router
from pydantic import BaseModel
from core.authentication.jwt_service import JWTService
import requests
import secrets
from urllib.parse import urlencode

from apps.common.constants import AppErrorCode
from apps.common.error_schemas import ErrorResponse
from apps.common.errors import AppError
from core.auth_ninja import JWTAuth

router = Router(auth=None)  # <- Permitimos acceso público a login, etc.


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

                p = Perfil.objects.filter(persona__dni=ident).select_related("user").first()
                if p and p.user:
                    u = p.user
            except Exception:
                pass
    return u


class UserOut(BaseModel):
    id: int
    dni: str
    name: str
    roles: list[str]
    is_staff: bool
    is_superuser: bool
    must_change_password: bool = False
    must_complete_profile: bool = False
    profesorado_ids: list[int] | None = None


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
    return not bool(datos_extra.get("perfil_actualizado"))


def _serialize_user(user):
    estudiante = getattr(user, "estudiante", None)
    must_change = getattr(estudiante, "must_change_password", False)
    must_complete_profile = _must_complete_profile(user)
    from core.permissions import allowed_profesorados
    allowed = allowed_profesorados(user)
    prof_ids = list(allowed) if allowed is not None else None

    roles = list(user.groups.values_list("name", flat=True))
    # Consistencia con core/auth_ninja.py: solo superusuarios tienen admin implicito.
    if user.is_superuser:
        if "admin" not in roles:
            roles.append("admin")

    return {
        "id": user.id,
        "dni": user.username,
        "name": (user.get_full_name() or user.first_name or user.username),
        "roles": roles,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "must_change_password": bool(must_change),
        "must_complete_profile": bool(must_complete_profile),
        "profesorado_ids": prof_ids,
    }


def _set_access_cookie(response: JsonResponse, access_token: str):
    # Definimos la expiración manualmente ahora que no usamos SimpleJWT para esto
    max_age = 2 * 3600  # 2 horas
    cookie_kwargs = {
        "key": settings.JWT_ACCESS_COOKIE_NAME,
        "value": access_token,
        "max_age": max_age,
        "httponly": True,
        "path": settings.JWT_COOKIE_PATH,
    }
    if settings.JWT_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.JWT_COOKIE_DOMAIN
    if not settings.DEBUG:
        cookie_kwargs["secure"] = settings.SESSION_COOKIE_SECURE
        cookie_kwargs["samesite"] = settings.SESSION_COOKIE_SAMESITE
    response.set_cookie(**cookie_kwargs)


def _set_refresh_cookie(response: JsonResponse, refresh_token: str):
    max_age = 7 * 24 * 3600  # 7 días
    cookie_kwargs = {
        "key": settings.JWT_REFRESH_COOKIE_NAME,
        "value": refresh_token,
        "max_age": max_age,
        "httponly": True,
        "path": settings.JWT_COOKIE_PATH,
    }
    if settings.JWT_COOKIE_DOMAIN:
        cookie_kwargs["domain"] = settings.JWT_COOKIE_DOMAIN
    if not settings.DEBUG:
        cookie_kwargs["secure"] = settings.SESSION_COOKIE_SECURE
        cookie_kwargs["samesite"] = settings.SESSION_COOKIE_SAMESITE
    response.set_cookie(**cookie_kwargs)


def _clear_jwt_cookies(response: JsonResponse):
    domain = getattr(settings, "JWT_COOKIE_DOMAIN", None)
    response.delete_cookie(key=settings.JWT_ACCESS_COOKIE_NAME, path=settings.JWT_COOKIE_PATH, domain=domain)
    response.delete_cookie(key=settings.JWT_REFRESH_COOKIE_NAME, path=settings.JWT_COOKIE_PATH, domain=domain)


def _client_identifier(request, login: str) -> str:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        # Usamos la última IP para evitar spoofing (coincide con Audit Middleware)
        ips = [ip.strip() for ip in x_forwarded_for.split(",")]
        ip = ips[-1]
    else:
        ip = request.META.get("REMOTE_ADDR") or "unknown"
    
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
        raise AppError(429, AppErrorCode.RATE_LIMITED, "Demasiados intentos fallidos. Intenta nuevamente más tarde.")

    u = _resolve_user_by_identifier(payload.login)
    username = u.username if u else payload.login
    user = authenticate(request, username=username, password=payload.password)
    if not user:
        attempts = cache.get(cache_key, 0) + 1
        cache.set(cache_key, attempts, timeout=window)
        if attempts >= limit:
            raise AppError(429, AppErrorCode.RATE_LIMITED, "Demasiados intentos fallidos. Intenta nuevamente más tarde.")
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Credenciales inválidas.")

    cache.delete(cache_key)
    
    access_token = JWTService.create_access_token(user.id)
    refresh_token = JWTService.create_refresh_token(user.id)

    response_body = {
        "access": access_token,
        "refresh": refresh_token,
        "user": _serialize_user(user),
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)

    return response


@router.get("/profile/", response={200: UserOut, 401: ErrorResponse}, auth=JWTAuth())
def profile(request):
    if not request.user or not request.user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")
    u = request.user
    from core.permissions import allowed_profesorados
    allowed = allowed_profesorados(u)
    prof_ids = list(allowed) if allowed is not None else None

    roles = list(u.groups.values_list("name", flat=True))
    if u.is_superuser:
        if "admin" not in roles:
            roles.append("admin")

    return {
        "id": u.id,
        "dni": getattr(u, "username", ""),
        "name": u.get_full_name() or u.username,
        "roles": roles,
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "must_change_password": bool(getattr(getattr(u, "estudiante", None), "must_change_password", False)), # Error fix here too, was wrong in original
        "must_complete_profile": _must_complete_profile(u),
        "profesorado_ids": prof_ids,
    }


@router.post("/change-password/", response={200: Message, 400: ErrorResponse}, auth=JWTAuth())
def change_password(request, payload: ChangePasswordIn):
    user = request.user
    if not user or not user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")

    if not user.check_password(payload.current_password):
        raise AppError(400, AppErrorCode.AUTHENTICATION_FAILED, "La contraseña actual no es correcta.")

    try:
        validate_password(payload.new_password, user)
    except ValidationError as exc:
        # Unimos los mensajes de error específicos de Django para que el usuario sepa por qué falló
        # (ej: "Es demasiado similar al nombre de usuario")
        error_msg = " ".join(exc.messages)
        raise AppError(
            400,
            AppErrorCode.VALIDATION_ERROR,
            error_msg,
            details=exc.messages,
        )

    user.set_password(payload.new_password)
    user.save(update_fields=["password"])

    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.must_change_password:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    return {"detail": "Contraseña actualizada correctamente."}


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

    payload_decoded = JWTService.decode_token(token_value)
    if not payload_decoded or payload_decoded.get("type") != "refresh":
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Refresh token inválido.")

    user_id = payload_decoded.get("user_id")
    User = get_user_model()
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Usuario no encontrado o inactivo.")

    new_access = JWTService.create_access_token(user.id)
    new_refresh = JWTService.create_refresh_token(user.id)
    
    response_body = {
        "access": new_access,
        "refresh": new_refresh,
        "user": _serialize_user(user),
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, new_access)
    _set_refresh_cookie(response, new_refresh)
    return response


@router.get("/google/login")
@router.get("/google/login/")
def google_login(request):
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "") or ""
    redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "") or ""
    if not client_id or not redirect_uri:
        raise AppError(503, AppErrorCode.AUTHENTICATION_FAILED, "Google OAuth no está configurado.")

    state = secrets.token_urlsafe(32)
    request.session["oauth_state"] = state

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return HttpResponseRedirect(url)


@router.get("/google/callback", response={302: None, 401: ErrorResponse, 403: ErrorResponse})
@router.get("/google/callback/", response={302: None, 401: ErrorResponse, 403: ErrorResponse})
def google_callback(request, code: str | None = None, error: str | None = None, state: str | None = None):
    if error:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, f"Google OAuth error: {error}")
    
    # Validación de CSRF vía State
    saved_state = request.session.pop("oauth_state", None)
    if not state or state != saved_state:
        raise AppError(403, AppErrorCode.AUTHENTICATION_FAILED, "OAuth state mismatch. Posible ataque CSRF detectado.")

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
            f"Tu cuenta de Google ({email}) no esta habilitada en el sistema. Usa tu usuario y contrasena o pedi acceso al administrador.",
        )

    access_token = JWTService.create_access_token(user.id)
    refresh_token = JWTService.create_refresh_token(user.id)
    
    # Redireccionar al frontend
    response = HttpResponseRedirect(settings.FRONTEND_URL + "/auth/callback")
    
    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return response
