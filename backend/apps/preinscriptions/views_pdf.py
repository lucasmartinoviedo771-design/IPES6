# apps/preinscriptions/views_pdf.py
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from weasyprint import HTML
from datetime import datetime

from core.models import Preinscripcion  # ajustá al nombre real
# Si tu modelo se llama Preinscripcion y está en otro app, importalo de ahí.

def preinscripcion_pdf(request, preinscripcion_id: int):
    pre = get_object_or_404(Preinscripcion, pk=preinscripcion_id)

    # Armamos un contexto mínimo. Nada de doc_* ni combos.
    context = {
        "codigo": getattr(pre, "codigo", pre.pk),
        "fecha": getattr(pre, "created_at", datetime.now()),
        "alumno": {
            "apellidos": getattr(pre.alumno.user, "last_name", "") if getattr(pre, "alumno_id", None) else "",
            "nombres": getattr(pre.alumno.user, "first_name", "") if getattr(pre, "alumno_id", None) else "",
            "dni":      getattr(pre.alumno, "dni", "") if getattr(pre, "alumno_id", None) else "",
            "domicilio": getattr(pre.alumno, "domicilio", "") if getattr(pre, "alumno_id", None) else "",
            "localidad": "", # Este campo no existe en Estudiante
            "provincia": "", # Este campo no existe en Estudiante
            "pais":      "", # Este campo no existe en Estudiante
            "fecha_nac": getattr(pre.alumno, "fecha_nacimiento", None) if getattr(pre, "alumno_id", None) else None,
        },
        "contacto": {
            "email": getattr(pre.alumno.user, "email", ""),
            "telefono": getattr(pre.alumno, "telefono", ""),
        },
        "carrera": getattr(getattr(pre, "carrera", None), "nombre", "") or "",
    }

    html = render_to_string("core/preinscripcion_pdf.html", context)

    # PDF con WeasyPrint
    pdf = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf()

    resp = HttpResponse(pdf, content_type="application/pdf")
    filename = f"Preinscripcion_{context['codigo']}.pdf"
    resp['Content-Disposition'] = f'inline; filename="{filename}"'
    return resp