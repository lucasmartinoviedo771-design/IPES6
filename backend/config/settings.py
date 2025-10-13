import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# === Paths ==============================================================
BASE_DIR = Path(__file__).resolve().parent.parent  # .../backend

# === .env ==============================================================
# ColocÃ¡ el archivo .env en backend/.env (mismo nivel que manage.py)
load_dotenv(BASE_DIR / ".env")

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
SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-change-me")
DEBUG = env_bool("DEBUG", True)

DJANGO_ENV = os.getenv("DJANGO_ENV", "development").lower()
IS_PROD = DJANGO_ENV == "production"

# Hosts permitidos (Â¡ajusta con tu dominio real!)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", ["localhost", "127.0.0.1", "[::1]"])
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", [])  # ej: http://localhost:5173, https://tu-dominio

# Cookies seguras en prod
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# === Apps ===============================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'core',
    'apps.carreras',
    'apps.preinscriptions',
    'apps.alumnos',
]

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
]

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

WSGI_APPLICATION = "config.wsgi.application"  # o ASGI si usÃ¡s Daphne/Uvicorn

# === Base de datos (MySQL) =============================================
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


# === InternacionalizaciÃ³n ==============================================
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = False

# === Archivos estÃ¡ticos / media ========================================
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"          # para collectstatic en prod
STATICFILES_DIRS = [BASE_DIR / "static"]        # opcional (para assets locales)

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"                 # aquÃ­ se guardan las fotos/documentos

# LÃ­mite de subida (10 MB de ejemplo)
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024

# === CORS ===============================================================
CORS_ALLOW_ALL_ORIGINS = True

# Si necesitÃ¡s permitir todos los headers/metodos en dev:
CORS_ALLOW_HEADERS = list(default_headers) if "default_headers" in globals() else [
    "accept", "accept-encoding", "authorization", "content-type", "origin",
    "user-agent", "x-csrftoken", "x-requested-with"
]
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

# --- fin CORS ---

# === CORS (override with FRONTEND_ORIGINS) ==============================
try:
    from corsheaders.defaults import default_headers, default_methods
except Exception:
    default_headers, default_methods = (), ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")

FRONTEND_ORIGINS = env_list(
    "FRONTEND_ORIGINS",
    [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
)

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS
CORS_ALLOW_HEADERS = list(default_headers)
CORS_ALLOW_METHODS = list(default_methods)

# === Logging (mÃ­nimo Ãºtil) =============================================
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "apps": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

# === Django 5 defaults ==================================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DRF + SimpleJWT
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",  # Bearer JWT
        "rest_framework.authentication.SessionAuthentication",         # Para admin / sesiÃ³n
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",  # AjustÃ¡ a gusto a nivel vista
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=2),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "ALGORITHM": "HS256",
    # por defecto usa settings.SECRET_KEY como SIGNING_KEY (suficiente)
    "AUTH_HEADER_TYPES": ("Bearer",),  # <â€” importante para "Authorization: Bearer <token>"
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# CORS / CSRF (dev)
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# try:
#     from corsheaders.defaults import default_headers, default_methods
# except Exception:
#     default_headers, default_methods = (), ("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")

# FRONTEND_ORIGINS = env_list(
#     "FRONTEND_ORIGINS",
#     [
#         "http://127.0.0.1:5173",
#         "http://localhost:5173",
#     ],
# )

# CORS_ALLOW_ALL_ORIGINS = False
# CORS_ALLOW_CREDENTIALS = True
# CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
# CSRF_TRUSTED_ORIGINS = FRONTEND_ORIGINS
# CORS_ALLOW_HEADERS = list(default_headers)
# CORS_ALLOW_METHODS = list(default_methods)

# Cookies/seguridad (ajustÃ¡ para prod)
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# CSRF_COOKIE_SECURE = True
# SESSION_COOKIE_SECURE = True

# === Seguridad en producciÃ³n ============================================
if IS_PROD:
    # RedirecciÃ³n a HTTPS + HSTS
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000  # 1 aÃ±o
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Cookies seguras
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # X-Frame, X-Content-Type, etc.
    X_FRAME_OPTIONS = "DENY"
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"

    # SameSite: si front y back son dominios distintos y usÃ¡s cookies cross-site, usa 'None'
    # SESSION_COOKIE_SAMESITE = "None"
    # CSRF_COOKIE_SAMESITE = "None"
else:
    # Desarrollo
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
