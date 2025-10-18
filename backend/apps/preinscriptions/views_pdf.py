# apps/preinscriptions/views_pdf.py
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from weasyprint import HTML
from datetime import datetime

from core.models import Preinscripcion  # ajustá al nombre real
# Si tu modelo se llama Preinscripcion y está en otro app, importalo de ahí.

def preinscripcion_pdf(request, preinscripcion_id: int = None, pk: int = None, **kwargs):
    """Genera el PDF de preinscripción.

    Acepta tanto `preinscripcion_id` como `pk` para compatibilidad con rutas
    antiguas (preinscripciones/<int:pk>/pdf/).
    """
    # Aceptar cualquiera de los nombres, incluso si vienen en kwargs
    if preinscripcion_id is None and 'preinscripcion_id' in kwargs:
        preinscripcion_id = kwargs['preinscripcion_id']
    if pk is None and 'pk' in kwargs:
        pk = kwargs['pk']
    pid = preinscripcion_id or pk
    pre = get_object_or_404(Preinscripcion, pk=pid)

    # Acceso seguro a objetos anidados
    estudiante = getattr(pre, 'alumno', None)
    user = getattr(estudiante, 'user', None) if estudiante else None
    carrera = getattr(pre, 'carrera', None)

    context = {
        "codigo": getattr(pre, "codigo", pre.pk),
        "fecha": getattr(pre, "created_at", datetime.now()),
        "foto_dataUrl": pre.foto_4x4_dataurl,
        "alumno": {
            "apellidos": getattr(user, "last_name", "") if user else "",
            "nombres": getattr(user, "first_name", "") if user else "",
            "dni": getattr(estudiante, "dni", "") if estudiante else "",
            "domicilio": getattr(estudiante, "domicilio", "") if estudiante else "",
            "localidad": "",  # Campo no existe en Estudiante
            "provincia": "",  # Campo no existe en Estudiante
            "pais": "",       # Campo no existe en Estudiante
            "fecha_nac": getattr(estudiante, "fecha_nacimiento", None) if estudiante else None,
        },
        "contacto": {
            "email": getattr(user, "email", "") if user else "",
            "telefono": getattr(estudiante, "telefono", "") if estudiante else "",
        },
        "carrera": getattr(carrera, "nombre", "") if carrera else "",
    }

    html = render_to_string("core/preinscripcion_pdf.html", context)

    # PDF con WeasyPrint
    pdf = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf()

    resp = HttpResponse(pdf, content_type="application/pdf")
    filename = f"Preinscripcion_{context['codigo']}.pdf"
    resp['Content-Disposition'] = f'inline; filename="{filename}"'
    return resp
