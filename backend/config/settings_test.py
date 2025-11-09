from .settings import *

# === Testing overrides ======================================================
# Use SQLite so the test suite does not require a MySQL server.
DATABASES["default"] = {
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": BASE_DIR / "db_test.sqlite3",
}

# Fast password hashing for tests.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Ensure deterministic caching during tests.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "ipes6-test-cache",
    }
}

# Keep emails in-memory.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Store generated media files in a disposable directory.
MEDIA_ROOT = BASE_DIR / "tmp" / "test_media"
