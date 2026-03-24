"""
Vistas clásicas (Django Views) para la generación de reportes y documentos.
Este módulo maneja la lógica de renderizado de PDFs y generación de activos
dinámicos como códigos QR.
"""

import base64
import io
import qrcode
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string

from .models import Preinscripcion


def generar_pdf_preinscripcion(request, pk):
    """
    Genera un comprobante oficial de preinscripción en formato PDF.
    
    Procesamiento:
    1. Recupera los datos del alumno.
    2. Genera un código QR único con los datos del trámite.
    3. Convierte la foto de perfil y el QR a base64 para incrustarlos en el HTML.
    4. Renderiza el HTML usando WeasyPrint para producir el binario PDF.
    """
    preinscripcion = get_object_or_404(Preinscripcion, pk=pk)
    context = {"pre": preinscripcion}

    # --- GENERACIÓN DE CÓDIGO QR PARA VALIDACIÓN ---
    numero_tramite = f"IPES-{preinscripcion.pk:05d}"
    fecha_emision = preinscripcion.fecha_creacion.strftime("%d/%m/%Y")
    qr_data = f"Trámite: {numero_tramite}\nFecha: {fecha_emision}\nDNI: {preinscripcion.dni}"

    qr_img = qrcode.make(qr_data)
    buffer = io.BytesIO()
    qr_img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    context["qr_code_src"] = f"data:image/png;base64,{qr_base64}"

    # --- MANEJO DE FOTO DE PERFIL (Si existe) ---
    if preinscripcion.foto_4x4:
        try:
            with open(preinscripcion.foto_4x4.path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
                context["foto_src"] = f"data:image/jpeg;base64,{encoded_string}"
        except Exception:
            # Si hay error en el sistema de archivos, el PDF se genera sin foto
            context["foto_src"] = None

    # Renderizado de plantilla HTML intermedia
    html_string = render_to_string("core/preinscripcion_pdf.html", context)

    # Preparación de la respuesta HTTP como archivo PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = (
        f'attachment; filename="preinscripcion_{preinscripcion.dni}.pdf"'
    )

    # Importación diferida de WeasyPrint para mejorar el tiempo de arranque del servidor
    from weasyprint import HTML
    
    HTML(
        string=html_string, 
        base_url=request.build_absolute_uri()
    ).write_pdf(response)

    return response
