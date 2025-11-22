"""Generación de PDF para la preinscripción con foto embebida."""

from __future__ import annotations

import base64
from datetime import datetime

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

from core.models import Preinscripcion

from .models_uploads import PreinscripcionArchivo


def _build_foto_dataurl(pre: Preinscripcion) -> str | None:
    """Devuelve la foto 4x4 como data URL, si existe."""
    dataurl = getattr(pre, "foto_4x4_dataurl", None)
    if isinstance(dataurl, str) and dataurl.strip():
        return dataurl

    extra = getattr(pre, "datos_extra", None)
    if isinstance(extra, dict):
        alt = extra.get("foto_dataUrl") or extra.get("foto_4x4_dataurl")
        if isinstance(alt, str) and alt.strip():
            return alt

    foto_archivo = (
        PreinscripcionArchivo.objects.filter(preinscripcion_id=pre.id, tipo__iexact="foto4x4")
        .order_by("-creado_en")
        .first()
    )
    if not foto_archivo:
        foto_archivo = (
            PreinscripcionArchivo.objects.filter(preinscripcion_id=pre.id, tipo__icontains="foto")
            .order_by("-creado_en")
            .first()
        )
    if not foto_archivo or not foto_archivo.archivo:
        return None

    mime = (foto_archivo.content_type or "").lower()
    if "png" in mime:
        mimetype = "image/png"
    elif "gif" in mime:
        mimetype = "image/gif"
    else:
        mimetype = "image/jpeg"

    with foto_archivo.archivo.open("rb") as fh:
        encoded = base64.b64encode(fh.read()).decode("ascii")
    return f"data:{mimetype};base64,{encoded}"


def preinscripcion_pdf(request, preinscripcion_id: int | None = None, pk: int | None = None, **kwargs):
    """Genera el PDF de la preinscripción e incrusta la foto del aspirante si existe."""
    if preinscripcion_id is None and "preinscripcion_id" in kwargs:
        preinscripcion_id = kwargs["preinscripcion_id"]
    if pk is None and "pk" in kwargs:
        pk = kwargs["pk"]
    pid = preinscripcion_id or pk

    pre = get_object_or_404(Preinscripcion, pk=pid)
    estudiante = getattr(pre, "alumno", None)
    user = getattr(estudiante, "user", None) if estudiante else None
    carrera = getattr(pre, "carrera", None)

    context = {
        "codigo": getattr(pre, "codigo", pre.pk),
        "fecha": getattr(pre, "created_at", datetime.now()),
        "foto_dataUrl": _build_foto_dataurl(pre),
        "alumno": {
            "apellidos": getattr(user, "last_name", "") if user else "",
            "nombres": getattr(user, "first_name", "") if user else "",
            "dni": getattr(estudiante, "dni", "") if estudiante else "",
            "domicilio": getattr(estudiante, "domicilio", "") if estudiante else "",
            "localidad": "",
            "provincia": "",
            "pais": "",
            "fecha_nac": getattr(estudiante, "fecha_nacimiento", None) if estudiante else None,
        },
        "contacto": {
            "email": getattr(user, "email", "") if user else "",
            "telefono": getattr(estudiante, "telefono", "") if estudiante else "",
        },
        "carrera": getattr(carrera, "nombre", "") if carrera else "",
    }

    html = render_to_string("core/preinscripcion_pdf.html", context)

    from weasyprint import HTML

    pdf = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf()

    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="Preinscripcion_{context["codigo"]}.pdf"'
    return response
