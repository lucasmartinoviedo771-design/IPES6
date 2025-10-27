# apps/carreras/urls.py
from django.urls import path
from .views import carreras_json

urlpatterns = [
    path("carreras", carreras_json),  # quedar√° en /api/carreras si lo incluyes bajo prefix 'api/'
]