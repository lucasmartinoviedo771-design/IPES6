# backend/core/views.py
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.shortcuts import get_object_or_404
from weasyprint import HTML
import base64
import qrcode
import io # Para manejar la imagen en memoria
from .models import Preinscripcion

def generar_pdf_preinscripcion(request, pk):
    preinscripcion = get_object_or_404(Preinscripcion, pk=pk)
    
    context = {'pre': preinscripcion}

    # --- LÓGICA PARA GENERAR EL QR ---
    numero_tramite = f"IPES-{preinscripcion.pk:05d}"
    fecha_emision = preinscripcion.fecha_creacion.strftime("%d/%m/%Y")
    qr_data = f"Trámite: {numero_tramite}\nFecha: {fecha_emision}\nDNI: {preinscripcion.dni}"
    
    qr_img = qrcode.make(qr_data)
    buffer = io.BytesIO()
    qr_img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    context['qr_code_src'] = f"data:image/png;base64,{qr_base64}"
    # --- FIN DE LA LÓGICA DEL QR ---

    if preinscripcion.foto_4x4:
        try:
            with open(preinscripcion.foto_4x4.path, "rb") as image_file:
                encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
                context['foto_src'] = f"data:image/jpeg;base64,{encoded_string}"
        except Exception:
            context['foto_src'] = None
            
    html_string = render_to_string('core/preinscripcion_pdf.html', context)
    
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="preinscripcion_{preinscripcion.dni}.pdf"'
    
    HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
    
    return response