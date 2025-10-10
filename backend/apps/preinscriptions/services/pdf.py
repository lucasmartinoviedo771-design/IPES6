from django.http import HttpResponse, HttpRequest
from .. import views_pdf

def build_pdf_response(request: HttpRequest, preinscripcion_id: int) -> HttpResponse:
    """
    Reusa la vista existente para generar y servir el PDF.
    La vista original 'preinscripcion_pdf' espera 'request' y 'pk'.
    """
    return views_pdf.preinscripcion_pdf(request, pk=preinscripcion_id)