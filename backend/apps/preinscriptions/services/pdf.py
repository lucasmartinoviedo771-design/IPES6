from django.http import HttpResponse, HttpRequest
from .. import views_pdf

def build_pdf_response(request: HttpRequest, preinscripcion_id: int | None = None, pk: int | None = None, **kwargs) -> HttpResponse:
    """Reusa la vista existente y acepta tanto 'preinscripcion_id' como 'pk'."""
    pid = preinscripcion_id or pk or kwargs.get('preinscripcion_id') or kwargs.get('pk')
    return views_pdf.preinscripcion_pdf(request, pid)
