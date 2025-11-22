from django.urls import path

from .services.pdf import build_pdf_response

urlpatterns = [
    path(
        "preinscripciones/<int:preinscripcion_id>/pdf/",
        build_pdf_response,
        name="preinscripcion_pdf",
    ),
    # Compatibilidad con rutas antiguas que usan 'pk'
    path("preinscripciones/<int:pk>/pdf/", build_pdf_response),
]
