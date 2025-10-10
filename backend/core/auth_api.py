# backend/core/auth_api.py
from ninja import Router
from pydantic import BaseModel
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from ninja.errors import HttpError

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

class TokenOut(BaseModel):
    access: str
    refresh: str
    user: UserOut

class Error(BaseModel):
    detail: str

@router.post("/login", response={200: TokenOut, 401: Error})
def login(request, payload: LoginIn):
    u = _resolve_user_by_identifier(payload.login)
    username = u.username if u else payload.login
    user = authenticate(request, username=username, password=payload.password)
    if not user:
        return 401, {"detail": "Credenciales inválidas"}
    refresh = RefreshToken.for_user(user)
    user_data = {
        "dni": user.username,
        "name": (user.get_full_name() or user.first_name or user.username),
        "roles": list(user.groups.values_list("name", flat=True)),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
    }
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": user_data,
    }

@router.get("/profile", response={200: UserOut})
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
    }