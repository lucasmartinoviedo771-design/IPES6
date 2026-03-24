import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Needed by WeasyPrint on Windows to avoid GLib probing UWP handlers
os.environ["GIO_USE_VFS"] = "local"
os.environ.setdefault("GIO_USE_VOLUME_MONITOR", "local")

# === Paths ==============================================================
BASE_DIR = Path(__file__).resolve().parent.parent  # .../backend

# === .env ==============================================================
# Colocá el archivo .env en backend/.env (mismo nivel que manage.py)
load_dotenv(BASE_DIR / ".env")

RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
RECAPTCHA_MIN_SCORE = float(os.getenv("RECAPTCHA_MIN_SCORE", "0.3"))
PREINS_RATE_LIMIT_PER_HOUR = int(os.getenv("PREINS_RATE_LIMIT_PER_HOUR", "5"))
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")

# === Entorno ==============================================================
DJANGO_ENV = os.getenv("DJANGO_ENV", "development").lower()
IS_PROD = DJANGO_ENV == "production"


# === Helpers para ENV ===================================================
def env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name)
    if val is None:
        return default
    return str(val).lower() in ("1", "true", "yes", "on")


def env_list(name: str, default=None):
    if default is None:
        default = []
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


# === Seguridad / Debug ==================================================
DEFAULT_DEBUG = not IS_PROD
DEBUG = env_bool("DEBUG", DEFAULT_DEBUG)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if IS_PROD:
        raise RuntimeError(
            "SECRET_KEY no está configurada. "
            "Define la variable de entorno SECRET_KEY con un valor seguro en producción."
        )
    # En desarrollo, forzamos que se defina algo, no dejamos un valor por defecto "famoso"
    raise RuntimeError("SECRET_KEY no definida en el entorno (.env)")

# Rate limiting para login (fall back sensato en desarrollo)
LOGIN_RATE_LIMIT_ATTEMPTS = int(os.getenv("LOGIN_RATE_LIMIT_ATTEMPTS", "5"))
LOGIN_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "300"))

# Hosts permitidos (¡ajusta con tu dominio real!)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", [])  # ej: http://localhost:5173, https://tu-dominio

# Cookies seguras en prod
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# === Apps ===============================================================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "core",
    "apps.carreras",
    "apps.preinscriptions",
    "apps.estudiantes",
    "apps.guias",
    "apps.asistencia",
    "apps.metrics",
]

# Profiling con silk (debe estar protegido siempre)
ENABLE_PROFILING = env_bool("ENABLE_PROFILING", default=DEBUG)
if ENABLE_PROFILING:
    INSTALLED_APPS.append("silk")
    # VULN-001 FIX: Obligar a que el usuario esté autenticado y sea superuser
    SILKY_AUTHENTICATION = True
    SILKY_AUTHORISATION = True

    def check_silk_access(user):
        return user.is_authenticated and user.is_superuser

    SILKY_PERMISSIONS = check_silk_access

# === Middleware =========================================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "core.middleware.AuditRequestMiddleware",
]

# Profiling middleware
if ENABLE_PROFILING:
    MIDDLEWARE.insert(0, "silk.middleware.SilkyMiddleware")

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],  # opcional
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"  # o ASGI si usás Daphne/Uvicorn

# === Base de datos =============================================================
DB_ENGINE = os.getenv("DB_ENGINE", "mysql").lower()

if DB_ENGINE == "sqlite":
    SQLITE_NAME = os.getenv("SQLITE_NAME", "db.sqlite3")
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / SQLITE_NAME,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "ipes6"),
            "USER": os.getenv("DB_USER", "root"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {"charset": "utf8mb4"},
        }
    }


# === Internacionalización ==============================================
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = False

# === Archivos estáticos / media ========================================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # para collectstatic en prod
STATICFILES_DIRS = [BASE_DIR / "static"]  # opcional (para assets locales)

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"  # aquí se guardan las fotos/documentos

# Límite de subida (10 MB de ejemplo)
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# === CORS ===============================================================


# Si necesitás permitir todos los headers/metodos en dev:
try:
    from corsheaders.defaults import default_headers

    CORS_ALLOW_HEADERS = list(default_headers)
except ImportError:
    CORS_ALLOW_HEADERS = [
        "accept",
        "accept-encoding",
        "authorization",
        "content-type",
        "origin",
        "user-agent",
        "x-csrftoken",
        "x-requested-with",
    ]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# --- fin CORS ---

# === CORS (override with FRONTEND_ORIGINS) ==============================
try:
    from corsheaders.defaults import default_headers, default_methods
except Exception:
    default_headers, default_methods = (
        (),
        ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"),
    )

FRONTEND_ORIGINS = env_list(
    "FRONTEND_ORIGINS",
    [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": int(os.getenv("AUTH_PASSWORD_MIN_LENGTH", "8"))},
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# === JWT Cookies ==========================================================
JWT_ACCESS_COOKIE_NAME = "jwt_access_token"
JWT_REFRESH_COOKIE_NAME = "jwt_refresh_token"
JWT_COOKIE_PATH = "/"  # Ruta raíz para evitar conflictos de path
JWT_COOKIE_DOMAIN = os.getenv("JWT_COOKIE_DOMAIN", None)  # Dominio de la cookie (ej: .tu-dominio.com)

# Cookies/seguridad (ajustá para prod)
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# Mantenemos el token CSRF en cookie para que el frontend pueda leerlo
# y enviarlo en el encabezado X-CSRFToken.
CSRF_USE_SESSIONS = False
# CSRF_COOKIE_SECURE = True
# SESSION_COOKIE_SECURE = True

# === Seguridad en producción ============================================
if IS_PROD:
    # Confiar en el header de Cloudflare/Nginx para saber que es HTTPS
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

    # Redirección a HTTPS + HSTS
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Cookies seguras
    # Cookies seguras (solo si usamos SSL)
    # IMPORTANTE: SameSite='None' requiere Secure=True sí o sí.
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # X-Frame, X-Content-Type, etc.
    X_FRAME_OPTIONS = "DENY"
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"

    # SameSite: 'Lax' es más seguro que 'None' y suficiente si están en subdominios
    # o si se usa el proxy de Nginx adecuadamente.
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
else:
    # Desarrollo
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
    RECAPTCHA_MIN_SCORE = 0.3 # En dev permitimos un umbral más bajo para pruebas

