from django.urls import path
from .views_pdf import preinscripcion_pdf

urlpatterns = [
    path("preinscripciones/<int:pk>/pdf/", preinscripcion_pdf, name="preinscripcion_pdf"),
]
