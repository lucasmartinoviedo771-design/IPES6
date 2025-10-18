# config/urls.py
from django.contrib import admin
from django.urls import path, include
from core.api_root import api  # ← importa la NinjaAPI
from django.conf import settings
from django.conf.urls.static import static
from apps.preinscriptions.views import serve_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),                         # ← EXPOne /api/*
    path("", include("apps.preinscriptions.urls")), # ← tus vistas clásicas (PDF, etc.)
    path('media/<path:path>', serve_media),
]

# if settings.DEBUG:
#     urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)