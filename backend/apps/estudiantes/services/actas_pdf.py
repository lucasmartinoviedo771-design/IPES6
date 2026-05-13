import io
from pathlib import Path
from decimal import Decimal
from typing import Any
from xml.sax.saxutils import escape

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak
)

from core.models import (
    ActaExamen,
    ActaExamenEstudiante,
    ActaExamenDocente,
    Estudiante
)

def _number_to_text(n: str) -> str:
    if n in ("AJ", "AI"):
        return "AUSENTE"
    try:
        num = int(float(n))
    except ValueError:
        return n

    unidades = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
    especiales = {10: "DIEZ", 11: "ONCE", 12: "DOCE", 13: "TRECE", 14: "CATORCE", 15: "QUINCE"}
    decenas = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]

    if num < 10:
        return unidades[num]
    if num in especiales:
        return especiales[num]
    if num < 20:
        return f"DIECI{unidades[num-10]}"
    if num == 20:
        return "VEINTE"
    if num < 30:
        return f"VEINTI{unidades[num-20]}"
    
    d = num // 10
    u = num % 10
    if u == 0:
        return decenas[d]
    return f"{decenas[d]} Y {unidades[u]}"

def _display(value: Any, default: str = "-") -> str:
    if value in (None, "", [], {}):
        return default
    return str(value)

def _resolve_logo(
    setting_name: str,
    fallback_names: list[str],
    placeholder: str,
    width: float = 60.0,
):
    base_dir = Path(settings.BASE_DIR)
    candidate_paths: list[Path] = []
    configured = getattr(settings, setting_name, None)
    if configured:
        configured_path = Path(configured)
        if not configured_path.is_absolute():
            configured_path = base_dir / configured_path
        candidate_paths.append(configured_path)

    search_roots = [
        base_dir,
        base_dir / "static",
        base_dir / "static" / "logos",
    ]
    
    for root in search_roots:
        for name in fallback_names:
            candidate_paths.append(Path(root) / name)

    for path_candidate in candidate_paths:
        if not path_candidate.exists():
            continue
        try:
            img = Image(str(path_candidate))
            if img.imageWidth:
                scale = width / float(img.imageWidth)
                img.drawWidth = width
                img.drawHeight = img.imageHeight * scale
            img.hAlign = "CENTER"
            return img
        except Exception:
            continue

    return Paragraph(f"[{placeholder}]", ParagraphStyle("Placeholder", fontSize=7, alignment=TA_CENTER))

def _footer(canvas, doc):
    canvas.saveState()
    footer_style = ParagraphStyle("Footer", fontSize=7, alignment=TA_CENTER)
    p = Paragraph('"Las Islas Malvinas, Georgias y Sándwich del Sur, son y serán Argentinas"', footer_style)
    w, h = p.wrap(doc.width, doc.bottomMargin)
    p.drawOn(canvas, doc.leftMargin, h + 10)
    
    # Side text
    canvas.rotate(90)
    side_text = "Número de Formulario IPES Paulo Freire"
    canvas.setFont("Helvetica", 6)
    canvas.drawCentredString(doc.height / 2, -doc.width - doc.rightMargin + 10, side_text)
    
    canvas.restoreState()

def generar_acta_examen_pdf(acta: ActaExamen, filtro_profesorado_id: int = None, es_comisionados: bool = False) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=50, # More space for footer
    )
    styles = getSampleStyleSheet()
    elements: list = []

    # Styles
    institutional_style = ParagraphStyle(
        "InstitutionalLine", parent=styles["Normal"], fontSize=7, alignment=TA_CENTER, leading=8
    )
    institutional_title_style = ParagraphStyle(
        "InstitutionalTitle", parent=styles["Heading2"], fontSize=18, alignment=TA_CENTER, leading=20, fontName="Helvetica-Bold"
    )
    doc_title_style = ParagraphStyle(
        "DocTitle", parent=styles["Heading1"], fontSize=12, alignment=TA_CENTER, spaceAfter=10, fontName="Helvetica-Bold"
    )
    header_label_style = ParagraphStyle(
        "HeaderLabel", parent=styles["Normal"], fontSize=9, fontName="Helvetica-Bold"
    )
    header_value_style = ParagraphStyle(
        "HeaderValue", parent=styles["Normal"], fontSize=9
    )
    table_header_style = ParagraphStyle(
        "TableHeader", parent=styles["Normal"], fontSize=8, alignment=TA_CENTER, fontName="Helvetica-Bold"
    )
    table_body_style = ParagraphStyle(
        "TableBody", parent=styles["Normal"], fontSize=8, alignment=TA_CENTER
    )
    table_body_left_style = ParagraphStyle(
        "TableBodyLeft", parent=styles["Normal"], fontSize=8, alignment=TA_LEFT
    )

    # Logos and Header
    logo_left = _resolve_logo("LOGO_MINISTERIO", ["static/logos/escudo_ministerio_tdf.png"], "MINISTERIO", width=50)
    logo_right = _resolve_logo("LOGO_IPES", ["static/logos/logo_ipes.jpg"], "IPES", width=50)
    
    # Center "Logo" which is actually text in the image
    center_header = [
        Paragraph("IPES", institutional_title_style),
        Paragraph("PAULO FREIRE", ParagraphStyle("SubTitle", fontSize=8, alignment=TA_CENTER, fontName="Helvetica-Bold", leading=10)),
        Spacer(1, 2),
        Paragraph("INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR", institutional_style),
    ]

    header_table = Table(
        [[logo_left, center_header, logo_right]],
        colWidths=[70, 380, 70]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("ACTA DE EXAMEN", doc_title_style))
    elements.append(Spacer(1, 5))

    # General Info Layout
    # Row 1: Profesorado
    elements.append(Paragraph(f"<b>PROFESORADO DE:</b> {escape(acta.profesorado.nombre).upper()}", header_value_style))
    elements.append(Spacer(1, 4))
    
    # Row 2: Acta No, Folio No, Fecha, Hora, Mesa
    fecha_str = acta.fecha.strftime('%d/%m/%Y')
    # We might need to fetch the MesaExamen to get the time/hour
    from core.models import MesaExamen
    mesa = MesaExamen.objects.filter(materia=acta.materia, fecha=acta.fecha, modalidad=acta.tipo).first()
    hora_str = mesa.hora.strftime('%H:%M') if mesa and mesa.hora else "08:00"
    mesa_nro = str(mesa.id) if mesa else "-"

    row2_data = [
        [Paragraph(f"<b>ACTA Nº:</b> {acta.numero}", header_value_style),
         Paragraph(f"<b>FOLIO Nº:</b> {acta.folio or '-'}", header_value_style),
         Paragraph(f"<b>FECHA:</b> {fecha_str}", header_value_style),
         Paragraph(f"<b>HORA:</b> {hora_str}", header_value_style),
         Paragraph(f"<b>MESA:</b> {mesa_nro}", header_value_style)]
    ]
    table_row2 = Table(row2_data, colWidths=[100, 100, 120, 100, 100])
    table_row2.setStyle(TableStyle([('LEFTPADDING', (0,0), (-1,-1), 0)]))
    elements.append(table_row2)
    elements.append(Spacer(1, 4))

    # Row 3: Unidad Curricular, Año, Plan
    row3_data = [
        [Paragraph(f"<b>UNIDAD CURRICULAR:</b> {escape(acta.materia.nombre).upper()}", header_value_style),
         Paragraph(f"<b>{acta.materia.anio_cursada or '-'}º AÑO</b>", header_value_style),
         Paragraph(f"<b>PLAN:</b> {escape(acta.plan.resolucion or '-').upper()}", header_value_style)]
    ]
    table_row3 = Table(row3_data, colWidths=[340, 60, 120])
    table_row3.setStyle(TableStyle([('LEFTPADDING', (0,0), (-1,-1), 0)]))
    elements.append(table_row3)
    elements.append(Spacer(1, 4))

    # Row 4: Profesor Titular
    docentes = acta.docentes.all().order_by("rol", "orden")
    presidente = docentes.filter(rol=ActaExamenDocente.Rol.PRESIDENTE).first()
    presidente_nombre = presidente.nombre if presidente else "-"
    elements.append(Paragraph(f"<b>PROFESOR TITULAR:</b> {escape(presidente_nombre).upper()}", header_value_style))
    elements.append(Spacer(1, 4))

    # Row 5: Vocales
    vocales = docentes.filter(rol__in=[ActaExamenDocente.Rol.VOCAL1, ActaExamenDocente.Rol.VOCAL2])
    vocales_str = " / ".join([v.nombre.upper() for v in vocales]) or "________________________________________________"
    elements.append(Paragraph(f"<b>PROFESORES/AS VOCALES:</b> {escape(vocales_str)}", header_value_style))
    elements.append(Spacer(1, 15))

    # Student filtering
    estudiantes_qs = acta.estudiantes.all().order_by("numero_orden")
    
    final_list = []
    if es_comisionados:
        for ae in estudiantes_qs:
            est = Estudiante.objects.filter(persona__dni=ae.dni).first()
            if est and not est.carreras.filter(id=acta.profesorado_id).exists():
                final_list.append(ae)
    else:
        # Default: All students in the acta (usually they are already filtered by career during creation)
        # But if we want to be strict with the user's request of "one per career":
        for ae in estudiantes_qs:
            est = Estudiante.objects.filter(persona__dni=ae.dni).first()
            if est and est.carreras.filter(id=acta.profesorado_id).exists():
                final_list.append(ae)
            elif not est:
                final_list.append(ae)

    # Students Table
    headers = [
        Paragraph("<b>N°</b>", table_header_style),
        Paragraph("<b>D.N.I.</b>", table_header_style),
        Paragraph("<b>APELLIDO Y NOMBRE DEL ALUMNO</b>", table_header_style),
        Paragraph("<b>EXAMEN ESCRITO</b>", table_header_style),
        Paragraph("<b>EXAMEN ORAL</b>", table_header_style),
        Paragraph("<b>PROMEDIO</b>", table_header_style),
    ]
    table_data = [headers]

    for idx, ae in enumerate(final_list, start=1):
        table_data.append([
            Paragraph(str(idx), table_body_style),
            Paragraph(ae.dni, table_body_style),
            Paragraph(escape(ae.apellido_nombre), table_body_left_style),
            Paragraph(ae.examen_escrito or "-", table_body_style),
            Paragraph(ae.examen_oral or "-", table_body_style),
            Paragraph(ae.calificacion_definitiva, table_body_style),
        ])

    # Fill at least 15 rows to look like a form
    while len(table_data) < 16:
        table_data.append(["", "", "", "", "", ""])

    table_students = Table(table_data, colWidths=[25, 65, 230, 65, 65, 65], repeatRows=1)
    table_students.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(table_students)
    elements.append(Spacer(1, 20))

    # Totals Section
    # Inscriptos, Ausentes, Aprobados, Desaprobados
    totals_data = [
        [Paragraph(f"Total de alumnos inscriptos: <b>{len(final_list)}</b>", header_value_style),
         Paragraph(f"( <b>{_number_to_text(str(len(final_list)))}</b> )", header_value_style),
         Paragraph(f"Total de alumnos ausentes: <b>{acta.total_ausentes}</b>", header_value_style),
         Paragraph(f"( <b>{_number_to_text(str(acta.total_ausentes))}</b> )", header_value_style)],
        
        [Paragraph(f"Total de alumnos aprobados: <b>{acta.total_aprobados}</b>", header_value_style),
         Paragraph(f"( <b>{_number_to_text(str(acta.total_aprobados))}</b> )", header_value_style),
         Paragraph(f"Total de alumnos desaprobados: <b>{acta.total_desaprobados}</b>", header_value_style),
         Paragraph(f"( <b>{_number_to_text(str(acta.total_desaprobados))}</b> )", header_value_style)],
    ]
    table_totals = Table(totals_data, colWidths=[180, 100, 180, 100])
    elements.append(table_totals)
    elements.append(Spacer(1, 20))

    # Observations
    elements.append(Paragraph(f"<b>OBSERVACIONES:</b> {escape(acta.observaciones or '')}", header_value_style))
    elements.append(Spacer(1, 2))
    # Draw horizontal lines for observations if empty
    if not acta.observaciones:
        elements.append(Paragraph("_" * 120, header_value_style))
    elements.append(Spacer(1, 40))

    # Signatures
    vocal1_nom = vocales[0].nombre if len(vocales) > 0 else "____________________"
    vocal2_nom = vocales[1].nombre if len(vocales) > 1 else "____________________"
    
    signatures_data = [
        [Paragraph("____________________", table_body_style),
         Paragraph("____________________", table_body_style),
         Paragraph("____________________", table_body_style)],
        [Paragraph("<b>Vocal</b>", table_body_style),
         Paragraph("<b>Presidente</b>", table_body_style),
         Paragraph("<b>Vocal</b>", table_body_style)],
        [Paragraph(escape(vocal1_nom.upper()), table_body_style),
         Paragraph(escape(presidente_nombre.upper()), table_body_style),
         Paragraph(escape(vocal2_nom.upper()), table_body_style)]
    ]
    table_sigs = Table(signatures_data, colWidths=[170, 170, 170])
    elements.append(table_sigs)

    # Build PDF with footer
    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    buffer.seek(0)
    return buffer.read()
