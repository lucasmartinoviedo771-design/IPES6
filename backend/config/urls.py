# config/urls.py
from django.contrib import admin
from django.urls import include, path

from apps.preinscriptions.views import serve_media
from core.api_root import api  # ← importa la NinjaAPI

urlpatterns = [
    path("backend-admin/", admin.site.urls),
    path("api/", api.urls),  # ← EXPOne /api/*
    path("", include("apps.preinscriptions.urls")),  # ← tus vistas clásicas (PDF, etc.)
    path("media/<path:path>", serve_media),
]

# Panel de profiling
from django.conf import settings
if getattr(settings, 'ENABLE_PROFILING', False):
    urlpatterns.append(path("silk/", include("silk.urls", namespace="silk")))
