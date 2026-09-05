# backend/core/auth_api.py
import secrets
from urllib.parse import urlencode

import requests
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.http import HttpResponseRedirect, JsonResponse
from ninja import Router
from pydantic import BaseModel

from apps.common.audit import log_action, log_action_from_request
from apps.common.constants import AppErrorCode
from apps.common.error_schemas import ErrorResponse
from apps.common.errors import AppError
from core.auth_ninja import JWTAuth
from core.authentication.jwt_service import JWTService
from core.client_ip import get_client_ip
from core.models import AuditLog
from core.persona_utils import get_persona_email

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


class RoleAssignmentOut(BaseModel):
    role: str
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    turno: str | None = None


class UserOut(BaseModel):
    id: int
    dni: str
    name: str
    roles: list[str]
    capabilities: list[str] = []
    is_staff: bool
    is_superuser: bool
    must_change_password: bool = False
    must_complete_profile: bool = False
    profesorado_ids: list[int] | None = None
    role_assignments: list[RoleAssignmentOut] = []
    is_impersonated: bool = False
    original_admin_name: str | None = None


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


class PasswordResetRequestIn(BaseModel):
    login: str


class PasswordResetConfirmIn(BaseModel):
    token: str
    new_password: str


def _must_complete_profile(user) -> bool:
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return False

    # Si es docente o parte del equipo de gestión, no bloqueamos el login
    # exigiendo que complete el perfil de estudiante primero.
    management_roles = {
        "admin",
        "secretaria",
        "bedel",
        "docente",
        "coordinador",
        "tutor",
        "jefes",
        "jefa_aaee",
        "equivalencias",
        "titulos",
        "rectorado",
        "attp",
    }
    user_roles = {g.name.lower().strip() for g in user.groups.all()}
    if user.is_staff or user.is_superuser or user_roles.intersection(management_roles):
        return False

    return not bool(getattr(estudiante, "perfil_actualizado", False))


def _get_role_assignments(user):
    assignments = []
    # 1. Staff assignments
    try:
        from core.models.horarios import StaffAsignacion

        staff_qs = StaffAsignacion.objects.filter(user=user).select_related("profesorado")
        for sa in staff_qs:
            prof_name = sa.profesorado.nombre if sa.profesorado else "Todos"
            assignments.append(
                {
                    "role": sa.rol,
                    "profesorado_id": sa.profesorado_id,
                    "profesorado_nombre": prof_name,
                    "turno": sa.turno,
                }
            )
    except Exception:
        pass

    # 2. Student careers
    try:
        estudiante = getattr(user, "estudiante", None)
        if estudiante:
            for carrera in estudiante.carreras.filter(activo=True):
                assignments.append(
                    {
                        "role": "estudiante",
                        "profesorado_id": carrera.id,
                        "profesorado_nombre": carrera.nombre,
                        "turno": None,
                    }
                )
    except Exception:
        pass

    # 3. Django groups not yet covered by StaffAsignacion (ej: bedel_secretaria asignado directo)
    covered_roles = {a["role"] for a in assignments}
    try:
        for group in user.groups.all():
            role_name = group.name.lower().strip()
            if role_name not in covered_roles:
                assignments.append(
                    {
                        "role": role_name,
                        "profesorado_id": None,
                        "profesorado_nombre": None,
                        "turno": None,
                    }
                )
                covered_roles.add(role_name)
    except Exception:
        pass

    return assignments


def _serialize_user(user):
    estudiante = getattr(user, "estudiante", None)
    profile = getattr(user, "profile", None)
    must_change = getattr(estudiante, "must_change_password", False) or getattr(profile, "must_change_password", False)
    must_complete_profile = _must_complete_profile(user)
    from core.permissions import CAPABILITIES, allowed_profesorados, can

    allowed = allowed_profesorados(user)
    prof_ids = list(allowed) if allowed is not None else None

    roles = list(user.groups.values_list("name", flat=True))
    # Consistencia con core/auth_ninja.py: solo superusuarios tienen admin implicito.
    if user.is_superuser:
        if "admin" not in roles:
            roles.append("admin")
    if hasattr(user, "estudiante") and "estudiante" not in roles:
        roles.append("estudiante")
    if hasattr(user, "docente") and "docente" not in roles:
        roles.append("docente")

    capabilities = [cap for cap in CAPABILITIES if can(user, cap)]

    persona = getattr(estudiante, "persona", None) or getattr(profile, "persona", None)
    name = (
        f"{persona.nombre} {persona.apellido}".strip()
        if persona
        else (user.get_full_name() or user.first_name or user.username)
    )

    return {
        "id": user.id,
        "dni": user.username,
        "name": name,
        "roles": roles,
        "capabilities": capabilities,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "must_change_password": bool(must_change),
        "must_complete_profile": bool(must_complete_profile),
        "profesorado_ids": prof_ids,
        "role_assignments": _get_role_assignments(user),
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
    ip = get_client_ip(request) or "unknown"

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
        # Log intento fallido
        log_action_from_request(
            request,
            user=u,
            accion=AuditLog.Accion.LOGIN,
            tipo_accion=AuditLog.TipoAccion.AUTH,
            detalle_accion=f"Intento de inicio de sesión fallido para {payload.login[:50]}",
            entidad="User",
            entidad_id=u.id if u else None,
            resultado=AuditLog.Resultado.ERROR,
            metadata={"login_ingresado": payload.login[:50]},
        )
        if attempts >= limit:
            raise AppError(
                429, AppErrorCode.RATE_LIMITED, "Demasiados intentos fallidos. Intenta nuevamente más tarde."
            )
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Credenciales inválidas.")

    cache.delete(cache_key)

    # Log login exitoso
    log_action_from_request(
        request,
        user=user,
        accion=AuditLog.Accion.LOGIN,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion=f"Inicio de sesión exitoso: {user.username}",
        entidad="User",
        entidad_id=user.id,
        resultado=AuditLog.Resultado.OK,
    )

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
    from core.permissions import CAPABILITIES, allowed_profesorados, can

    allowed = allowed_profesorados(u)
    prof_ids = list(allowed) if allowed is not None else None

    roles = list(u.groups.values_list("name", flat=True))
    if u.is_superuser:
        if "admin" not in roles:
            roles.append("admin")
    if hasattr(u, "estudiante") and "estudiante" not in roles:
        roles.append("estudiante")
    if hasattr(u, "docente") and "docente" not in roles:
        roles.append("docente")

    # Leemos la cabecera X-Active-Role para filtrar capacidades según el contexto activo
    active_role = request.headers.get("X-Active-Role")
    capabilities = [cap for cap in CAPABILITIES if can(u, cap, active_role)]

    estudiante = getattr(u, "estudiante", None)
    profile = getattr(u, "profile", None)
    persona = getattr(estudiante, "persona", None) or getattr(profile, "persona", None)
    name = f"{persona.nombre} {persona.apellido}".strip() if persona else (u.get_full_name() or u.username)

    jwt_payload = getattr(request, "jwt_payload", {}) or {}
    original_admin_id = jwt_payload.get("original_admin_id")
    is_impersonated = False
    original_admin_name = None

    if original_admin_id:
        User = get_user_model()
        admin_user = User.objects.filter(id=original_admin_id).first()
        if admin_user:
            is_impersonated = True
            admin_persona = getattr(getattr(admin_user, "profile", None), "persona", None)
            original_admin_name = (
                f"{admin_persona.nombre} {admin_persona.apellido}".strip()
                if admin_persona
                else (admin_user.get_full_name() or admin_user.username)
            )

    return {
        "id": u.id,
        "dni": getattr(u, "username", ""),
        "name": name,
        "roles": roles,
        "capabilities": capabilities,
        "is_staff": u.is_staff,
        "is_superuser": u.is_superuser,
        "must_change_password": bool(
            getattr(estudiante, "must_change_password", False) or getattr(profile, "must_change_password", False)
        ),
        "must_complete_profile": _must_complete_profile(u),
        "profesorado_ids": prof_ids,
        "role_assignments": _get_role_assignments(u),
        "is_impersonated": is_impersonated,
        "original_admin_name": original_admin_name,
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

    log_action_from_request(
        request,
        user=user,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion="Cambio de contraseña",
        entidad="User",
        entidad_id=user.id,
        resultado=AuditLog.Resultado.OK,
    )

    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.must_change_password:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    profile = getattr(user, "profile", None)
    if profile and profile.must_change_password:
        profile.must_change_password = False
        profile.save(update_fields=["must_change_password"])

    return {"detail": "Contraseña actualizada correctamente."}


@router.post("/password-reset/request/", response={200: Message})
def password_reset_request(request, payload: PasswordResetRequestIn):
    """
    Pide el envío de un link de recuperación. Responde siempre el mismo
    mensaje genérico, exista o no el usuario y tenga o no email cargado en
    Persona: no hay que revelar esa información a quien llama.
    """
    generic_msg = {"detail": "Si el usuario existe, se envió un email con instrucciones."}

    cache_key = f"auth:password-reset:{get_client_ip(request) or 'unknown'}:{(payload.login or '').strip().lower()}"
    limit = getattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 5)
    window = getattr(settings, "LOGIN_RATE_LIMIT_WINDOW_SECONDS", 300)
    attempts = cache.get(cache_key, 0)
    if attempts >= limit:
        return generic_msg
    cache.set(cache_key, attempts + 1, timeout=window)

    user = _resolve_user_by_identifier(payload.login)
    if not user or not user.is_active:
        return generic_msg

    email = get_persona_email(user)
    if not email:
        return generic_msg

    token = JWTService.create_password_reset_token(user)
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    minutes = getattr(settings, "PASSWORD_RESET_TIMEOUT_MINUTES", 30)

    send_mail(
        subject="IPES - Recuperación de contraseña",
        message=(
            f"Recibimos un pedido de recuperación de contraseña para tu cuenta.\n\n"
            f"Para definir una nueva, entrá a este link (válido por {minutes} minutos):\n"
            f"{reset_url}\n\n"
            f"Si no pediste esto, ignorá este mensaje: tu contraseña actual sigue funcionando."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )

    log_action_from_request(
        request,
        user=user,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion="Pedido de recuperación de contraseña",
        entidad="User",
        entidad_id=user.id,
        resultado=AuditLog.Resultado.OK,
    )

    return generic_msg


@router.post("/password-reset/confirm/", response={200: Message, 400: ErrorResponse})
def password_reset_confirm(request, payload: PasswordResetConfirmIn):
    payload_data = JWTService.decode_token(payload.token)
    if not payload_data or payload_data.get("type") != "password_reset":
        raise AppError(400, AppErrorCode.AUTHENTICATION_FAILED, "El link de recuperación es inválido o expiró.")

    User = get_user_model()
    try:
        user = User.objects.get(pk=payload_data.get("user_id"), is_active=True)
    except User.DoesNotExist:
        raise AppError(400, AppErrorCode.AUTHENTICATION_FAILED, "El link de recuperación es inválido o expiró.")

    # Si la contraseña ya cambió desde que se generó el token (con este link
    # ya usado, o por otra vía), el fragmento no coincide más: el link es de
    # un solo uso, sin necesitar una tabla de tokens consumidos.
    if user.password[-16:] != payload_data.get("pwd_fragment"):
        raise AppError(400, AppErrorCode.AUTHENTICATION_FAILED, "El link de recuperación es inválido o expiró.")

    try:
        validate_password(payload.new_password, user)
    except ValidationError as exc:
        error_msg = " ".join(exc.messages)
        raise AppError(400, AppErrorCode.VALIDATION_ERROR, error_msg, details=exc.messages)

    user.set_password(payload.new_password)
    user.save(update_fields=["password"])

    log_action_from_request(
        request,
        user=user,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion="Contraseña restablecida vía link de recuperación",
        entidad="User",
        entidad_id=user.id,
        resultado=AuditLog.Resultado.OK,
    )

    estudiante = getattr(user, "estudiante", None)
    if estudiante and estudiante.must_change_password:
        estudiante.must_change_password = False
        estudiante.save(update_fields=["must_change_password"])

    profile = getattr(user, "profile", None)
    if profile and profile.must_change_password:
        profile.must_change_password = False
        profile.save(update_fields=["must_change_password"])

    return {"detail": "Contraseña restablecida correctamente. Ya podés iniciar sesión."}


@router.post("/logout/")
def logout(request):
    if getattr(request, "user", None) and request.user.is_authenticated:
        log_action_from_request(
            request,
            user=request.user,
            accion=AuditLog.Accion.LOGOUT,
            tipo_accion=AuditLog.TipoAccion.AUTH,
            detalle_accion=f"Cierre de sesión: {request.user.username}",
            entidad="User",
            entidad_id=request.user.id,
            resultado=AuditLog.Resultado.OK,
        )
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
    original_admin_id = payload_decoded.get("original_admin_id")
    User = get_user_model()
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        raise AppError(401, AppErrorCode.AUTHENTICATION_FAILED, "Usuario no encontrado o inactivo.")

    new_access = JWTService.create_access_token(user.id, original_admin_id=original_admin_id)
    new_refresh = JWTService.create_refresh_token(user.id, original_admin_id=original_admin_id)

    serialized = _serialize_user(user)
    if original_admin_id:
        serialized["is_impersonated"] = True
        admin_user = User.objects.filter(id=original_admin_id, is_active=True).first()
        if admin_user:
            admin_persona = getattr(getattr(admin_user, "profile", None), "persona", None)
            serialized["original_admin_name"] = (
                f"{admin_persona.nombre} {admin_persona.apellido}".strip()
                if admin_persona
                else (admin_user.get_full_name() or admin_user.username)
            )

    response_body = {
        "access": new_access,
        "refresh": new_refresh,
        "user": serialized,
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

    log_action_from_request(
        request,
        user=user,
        accion=AuditLog.Accion.LOGIN,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion=f"Inicio de sesión exitoso vía Google OAuth: {email}",
        entidad="User",
        entidad_id=user.id,
        resultado=AuditLog.Resultado.OK,
        metadata={"email": email, "provider": "google"},
    )

    access_token = JWTService.create_access_token(user.id)
    refresh_token = JWTService.create_refresh_token(user.id)

    # Redireccionar al frontend
    response = HttpResponseRedirect(settings.FRONTEND_URL + "/auth/callback")

    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return response


class ImpersonateIn(BaseModel):
    dni: str


@router.post(
    "/impersonate/",
    response={200: TokenOut, 400: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse},
    auth=JWTAuth(),
)
def impersonate_user(request, payload: ImpersonateIn):
    """
    Permite a un Administrador simular la identidad de un estudiante o docente.
    Exclusivo para usuarios con rol admin o is_superuser.
    """
    admin_user = request.user
    if not admin_user or not admin_user.is_authenticated:
        raise AppError(401, AppErrorCode.AUTHENTICATION_REQUIRED, "No autenticado.")

    # Validar que sea superuser o admin
    roles = list(admin_user.groups.values_list("name", flat=True))
    if not (admin_user.is_superuser or "admin" in roles):
        raise AppError(403, AppErrorCode.PERMISSION_DENIED, "Solo los administradores pueden simular usuarios.")

    target_dni = payload.dni.strip()
    if not target_dni:
        raise AppError(400, AppErrorCode.VALIDATION_ERROR, "El DNI es obligatorio.")

    target_user = _resolve_user_by_identifier(target_dni)
    if not target_user:
        # Intentar buscar por persona DNI si aún no tiene user directo
        from core.models import Persona

        persona = Persona.objects.filter(dni=target_dni).first()
        if persona:
            # Buscar perfil estudiante o docente
            est = getattr(persona, "estudiante_perfil", None)
            doc = getattr(persona, "docente_perfil", None)
            if est and est.user:
                target_user = est.user
            elif doc:
                from apps.docentes.services.docente_service import DocenteService

                target_user, _, _ = DocenteService.ensure_user_for_docente(doc)
                DocenteService.ensure_docente_group(target_user)

    if not target_user:
        raise AppError(404, AppErrorCode.NOT_FOUND, f"No se encontró ningún usuario con DNI {target_dni}.")

    # Generar tokens con original_admin_id
    access_token = JWTService.create_access_token(target_user.id, original_admin_id=admin_user.id)
    refresh_token = JWTService.create_refresh_token(target_user.id, original_admin_id=admin_user.id)

    log_action_from_request(
        request,
        user=admin_user,
        accion=AuditLog.Accion.LOGIN,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion=f"Admin {admin_user.username} inició simulación de usuario: {target_user.username}",
        entidad="User",
        entidad_id=target_user.id,
        resultado=AuditLog.Resultado.OK,
        metadata={"impersonated_user_id": target_user.id, "impersonated_dni": target_user.username},
    )

    serialized = _serialize_user(target_user)
    serialized["is_impersonated"] = True
    admin_persona = getattr(getattr(admin_user, "profile", None), "persona", None)
    serialized["original_admin_name"] = (
        f"{admin_persona.nombre} {admin_persona.apellido}".strip()
        if admin_persona
        else (admin_user.get_full_name() or admin_user.username)
    )

    response_body = {
        "access": access_token,
        "refresh": refresh_token,
        "user": serialized,
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return response


@router.post(
    "/stop-impersonate/",
    response={200: TokenOut, 400: ErrorResponse, 401: ErrorResponse, 404: ErrorResponse},
    auth=JWTAuth(),
)
def stop_impersonate(request):
    """
    Finaliza la simulación y restaura la sesión del Administrador original.
    """
    jwt_payload = getattr(request, "jwt_payload", {}) or {}
    original_admin_id = jwt_payload.get("original_admin_id")

    if not original_admin_id:
        raise AppError(400, AppErrorCode.VALIDATION_ERROR, "No te encuentras en una sesión de simulación activa.")

    User = get_user_model()
    admin_user = User.objects.filter(id=original_admin_id, is_active=True).first()
    if not admin_user:
        raise AppError(404, AppErrorCode.NOT_FOUND, "No se encontró el usuario administrador original.")

    # Generar tokens limpios para el admin
    access_token = JWTService.create_access_token(admin_user.id)
    refresh_token = JWTService.create_refresh_token(admin_user.id)

    log_action_from_request(
        request,
        user=admin_user,
        accion=AuditLog.Accion.LOGOUT,
        tipo_accion=AuditLog.TipoAccion.AUTH,
        detalle_accion=f"Admin {admin_user.username} finalizó simulación de usuario.",
        entidad="User",
        entidad_id=admin_user.id,
        resultado=AuditLog.Resultado.OK,
    )

    response_body = {
        "access": access_token,
        "refresh": refresh_token,
        "user": _serialize_user(admin_user),
    }
    response = JsonResponse(response_body)
    _set_access_cookie(response, access_token)
    _set_refresh_cookie(response, refresh_token)
    return response
