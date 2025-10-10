# config/urls.py
from django.contrib import admin
from django.urls import path, include
from core.api_root import api  # ← importa la NinjaAPI

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),                         # ← EXPOne /api/*
    path("", include("apps.preinscriptions.urls")), # ← tus vistas clásicas (PDF, etc.)
]