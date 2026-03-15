from __future__ import annotations
import io
from pathlib import Path
from decimal import Decimal
from typing import Any
from xml.sax.saxutils import escape

from django.conf import settings
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from core.models import (
    PlanillaRegularidad,
    Regularidad,
)

def _render_planilla_regularidad_pdf(planilla: PlanillaRegularidad) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()
    elements: list = []

    institutional_style = ParagraphStyle(
        "InstitutionalLine",
        parent=styles["Normal"],
        fontSize=9,
        alignment=TA_CENTER,
        leading=11,
        spaceAfter=0,
    )
    institutional_title_style = ParagraphStyle(
        "InstitutionalTitle",
        parent=styles["Heading2"],
        fontSize=12,
        alignment=TA_CENTER,
        leading=13,
        spaceAfter=2,
    )
    info_style = ParagraphStyle(
        "InfoCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        spaceAfter=2,
        alignment=TA_LEFT,
    )
    header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=9,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    placeholder_style = ParagraphStyle(
        "LogoPlaceholder",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#666666"),
    )
    body_left_style = ParagraphStyle(
        "TableBodyLeft",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        alignment=TA_LEFT,
    )
    body_center_style = ParagraphStyle(
        "TableBodyCenter",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        alignment=TA_CENTER,
    )
    doc_center_style = ParagraphStyle(
        "DocCenter", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER, spaceAfter=2
    )

    base_dir = Path(settings.BASE_DIR)

    def _display(value: Any, default: str = "-") -> str:
        if value in (None, "", [], {}):
            return default
        s = str(value)
        try:
            if "Ã" in s:
                try:
                    s = s.encode('latin1').decode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass
                try:
                    s = s.encode('utf-8').decode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass
        except:
            pass
        s = s.replace("Ãƒâ€šÃ‚Â°", "º").replace("Ãƒâ€šÃ‚Âº", "º")
        return s

    def _format_decimal_value(value: Decimal | None) -> str:
        if value is None:
            return "-"
        try:
            quantized = value.quantize(Decimal("0.1"))
        except Exception:
            return _display(value)
        text_value = format(quantized.normalize(), "f")
        if "." in text_value:
            text_value = text_value.rstrip("0").rstrip(".")
        return text_value or "0"

    def _resolve_logo(
        setting_name: str,
        fallback_names: list[str],
        placeholder: str,
        width: float = 60.0,
    ):
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
            base_dir / "docs",
        ]
        media_root = getattr(settings, "MEDIA_ROOT", "")
        if media_root:
            search_roots.append(Path(media_root))

        for root in search_roots:
            for name in fallback_names:
                candidate_paths.append(Path(root) / name)

        seen: set[Path] = set()
        for path_candidate in candidate_paths:
            if path_candidate in seen:
                continue
            seen.add(path_candidate)
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

        return Paragraph(f"[{placeholder}]", placeholder_style)

    logo_ministerio = _resolve_logo(
        "PRIMERA_CARGA_PDF_LOGO_MINISTERIO",
        [
            "static/logos/escudo_ministerio_tdf.png",
            "media/escudo_ministerio_tdf.png",
            "logo_ministerio.png",
            "logo_ministerio.jpg",
            "ministerio.png",
            "ministerio.jpg",
        ],
        "MINISTERIO",
    )
    logo_ipes = _resolve_logo(
        "PRIMERA_CARGA_PDF_LOGO_IPES",
        [
            "static/logos/logo_ipes.png",
            "media/logo_ipes.png",
            "logo_ipes.png",
            "logo_ipes.jpg",
            "ipes.png",
            "ipes.jpg",
        ],
        "IPES",
    )

    institutional_column: list[Any] = [
        Paragraph("IPES PAULO FREIRE", institutional_title_style),
        Paragraph("INSTITUTO PROVINCIAL DE EDUCACION SUPERIOR", institutional_style),
    ]

    header_base_widths = [70.0, 400.0, 70.0]
    header_total = sum(header_base_widths)
    header_scale = min(1.0, doc.width / header_total)
    header_widths = [w * header_scale for w in header_base_widths]

    header_table = Table(
        [[logo_ministerio, institutional_column, logo_ipes]],
        colWidths=header_widths,
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("ALIGN", (2, 0), (2, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    elements.append(header_table)
    doc_title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=10,
        fontName="Helvetica-Bold"
    )

    header_value_style = ParagraphStyle(
        "HeaderValue", parent=styles["Normal"], fontSize=8
    )

    color_header = colors.HexColor("#d9e2f3")
    color_promocion = colors.HexColor("#c6e0b4")
    color_regular = colors.HexColor("#ffff00")
    color_aprobado = colors.HexColor("#ed7d31")
    color_desaprobado = colors.HexColor("#ff0000")
    color_libre_i = colors.HexColor("#5b9bd5")

    def get_situacion_color(codigo):
        c = (codigo or "").upper()
        if "PRO" in c: return color_promocion
        if "REGULAR" in c or c == "REG": return color_regular
        if "APR" in c: return color_aprobado
        if "LBI" in c or "LIBRE-I" in c: return color_libre_i
        if "LAT" in c or "LIBRE-AT" in c: return color_libre_i
        if "DPA" in c or "DTP" in c or "DESAPROBADO" in c: return color_desaprobado
        return None

    elements.append(Paragraph("PLANILLA DE REGULARIDAD Y PROMOCIÓN", doc_title_style))

    docentes_qs = planilla.docentes.all().order_by("orden", "id")
    profesores_qs = docentes_qs.filter(rol="profesor")
    bedel_docente = docentes_qs.filter(rol="bedel").first()
    
    if profesores_qs.exists():
        docente_nombre = " / ".join([p.nombre for p in profesores_qs])
    else:
        docente_nombre = "_______________________"

    data_gen = [
        [Paragraph(f"<b>PROFESORADO DE:</b> {escape(planilla.profesorado.nombre)}", header_value_style), ""],
        [
            Paragraph(f"<b>UNIDAD CURRICULAR:</b> {escape(planilla.materia.nombre)}", header_value_style),
            Paragraph(f"<b>AÑO:</b> {planilla.materia.anio_cursada or '-'}°", header_value_style)
        ],
        [
            Paragraph(f"<b>FORMATO:</b> {escape(planilla.formato.nombre)}", header_value_style),
            Paragraph(f"<b>RESOLUCIÓN Nº:</b> {escape(planilla.plan_resolucion or planilla.materia.plan_de_estudio.resolucion)}", header_value_style)
        ],
        [
            Paragraph(f"<b>FOLIO Nº:</b> {planilla.folio or '-'}", header_value_style),
            Paragraph(f"<b>DICTADO:</b> {planilla.plantilla.get_dictado_display() if planilla.plantilla else planilla.dictado}", header_value_style)
        ],
        [
            Paragraph(f"<b>PROFESOR/A:</b> {escape(docente_nombre)}", header_value_style),
            Paragraph(f"<b>FECHA:</b> {planilla.fecha.strftime('%d/%m/%Y')}", header_value_style)
        ]
    ]

    table_gen = Table(data_gen, colWidths=[380, 160])
    table_gen.setStyle(TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (0, 0), color_header),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    
    elements.append(table_gen)
    elements.append(Spacer(1, 15))

    columnas_raw = planilla.plantilla.columnas or []
    columnas_tp = [col for col in columnas_raw]

    base_cols = 3
    tp_count = len(columnas_tp)
    nota_final_idx = base_cols + tp_count
    asistencia_idx = nota_final_idx + 1
    excepcion_idx = asistencia_idx + 1
    situacion_idx = excepcion_idx + 1
    total_cols = situacion_idx + 1

    headers_row1: list[Any] = [
        Paragraph("<b>N</b>", header_style),
        Paragraph("<b>ALUMNOS</b>", header_style),
        Paragraph("<b>DNI</b>", header_style),
    ]
    headers_row2: list[Any] = ["", "", ""]

    single_row_columns: list[int] = []
    group_ranges: list[tuple[int, int]] = []

    def _column_group(col: dict) -> str | None:
        group = col.get("group") or col.get("group_label")
        if group:
            return str(group)
        label_norm = (col.get("label") or "").strip().lower()
        if "parcial" in label_norm:
            return "NOTA PARCIAL"
        if "tp" in label_norm or "trabajo" in label_norm:
            return "NOTA TP"
        return None

    current_group: str | None = None
    current_start: int | None = None

    for idx, columna in enumerate(columnas_tp):
        label = columna.get("label") or columna.get("key") or ""
        label_display = escape(label.upper())
        group_label = _column_group(columna)
        group_label = group_label.upper() if group_label else None
        col_index = base_cols + idx

        if group_label:
            if current_group != group_label:
                if current_group is not None and current_start is not None:
                    group_ranges.append((current_start, col_index - 1))
                current_group = group_label
                current_start = col_index
                headers_row1.append(Paragraph(f"<b>{group_label}</b>", header_style))
            else:
                headers_row1.append("")
            headers_row2.append(Paragraph(f"<b>{label_display}</b>", header_style))
        else:
            if current_group is not None and current_start is not None:
                group_ranges.append((current_start, col_index - 1))
            current_group = None
            current_start = None
            headers_row1.append(Paragraph(f"<b>{label_display}</b>", header_style))
            headers_row2.append("")
            single_row_columns.append(col_index)

    if current_group is not None and current_start is not None:
        group_ranges.append((current_start, base_cols + tp_count - 1))

    constant_headers = [
        ("<b>FINAL</b>", nota_final_idx),
        ("<b>%</b>", asistencia_idx),
        ("<b>EXC.</b>", excepcion_idx),
        ("<b>SITUACION ACADEMICA</b>", situacion_idx),
    ]
    for title, _ in constant_headers:
        headers_row1.append(Paragraph(title, header_style))
        headers_row2.append("")

    table_rows: list[list[Any]] = [headers_row1, headers_row2]

    filas_qs = planilla.filas.all().order_by("orden", "id")
    situacion_labels = dict(Regularidad.Situacion.choices)

    def _cell(value: Any, style: ParagraphStyle, default: str = "-") -> Paragraph:
        return Paragraph(escape(_display(value, default)), style)

    for fila in filas_qs:
        row: list[Any] = [""] * total_cols
        row[0] = _cell(fila.orden, body_center_style, "")
        row[1] = _cell(fila.apellido_nombre, body_left_style, "-")
        row[2] = _cell(fila.dni, body_center_style, "-")

        datos = fila.datos or {}
        for idx, columna in enumerate(columnas_tp):
            key = columna.get("key")
            row[base_cols + idx] = _cell(datos.get(key), body_center_style, "-")

        row[nota_final_idx] = _cell(_format_decimal_value(fila.nota_final), body_center_style, "-")
        asistencia_val = "-"
        if fila.asistencia_porcentaje not in (None, ""):
            asistencia_val = f"{_display(fila.asistencia_porcentaje)}%"
        row[asistencia_idx] = _cell(asistencia_val, body_center_style, "-")
        row[excepcion_idx] = _cell("SI" if fila.excepcion else "NO", body_center_style, "NO")
        situacion_raw = fila.situacion
        if situacion_raw == "AUJ":
            situacion_valor = "JUS"
        else:
            situacion_valor = situacion_labels.get(situacion_raw, situacion_raw)
        row[situacion_idx] = _cell(situacion_valor, body_left_style, "-")
        table_rows.append(row)

    base_widths = [24.0, 190.0, 60.0]
    if tp_count == 0:
        dynamic_widths: list[float] = []
    elif tp_count <= 2:
        dynamic_widths = [36.0] * tp_count
    else:
        dynamic_widths = [max(26.0, 84.0 / tp_count)] * tp_count

    final_widths = [48.0, 36.0, 45.0, 102.0]
    col_widths = base_widths + dynamic_widths + final_widths
    total_width = sum(col_widths)
    available_width = doc.width
    if total_width > available_width:
        scale = available_width / total_width
        col_widths = [w * scale for w in col_widths]

    table = Table(table_rows, repeatRows=2, colWidths=col_widths)
    table_style = TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("BACKGROUND", (0, 0), (-1, 1), color_header),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]
    )

    for i, fila in enumerate(filas_qs, start=2):
        situacion_color = get_situacion_color(fila.situacion)
        if situacion_color:
            table_style.add("BACKGROUND", (situacion_idx, i), (situacion_idx, i), situacion_color)
            
    table_style.add("ALIGN", (1, 2), (1, -1), "LEFT")
    table_style.add("ALIGN", (situacion_idx, 2), (situacion_idx, -1), "LEFT")
    table_style.add("SPAN", (0, 0), (0, 1))
    table_style.add("SPAN", (1, 0), (1, 1))
    table_style.add("SPAN", (2, 0), (2, 1))

    for col_index in single_row_columns:
        table_style.add("SPAN", (col_index, 0), (col_index, 1))

    for start, end in group_ranges:
        if start is not None and end is not None and end >= start:
            table_style.add("SPAN", (start, 0), (end, 0))

    table_style.add("SPAN", (nota_final_idx, 0), (nota_final_idx, 1))
    table_style.add("SPAN", (asistencia_idx, 0), (asistencia_idx, 1))
    table_style.add("SPAN", (excepcion_idx, 0), (excepcion_idx, 1))
    table_style.add("SPAN", (situacion_idx, 0), (situacion_idx, 1))

    table.setStyle(table_style)
    elements.append(table)
    elements.append(Spacer(1, 14))

    obs_data = [[Paragraph("<b>OBSERVACIONES:</b>", header_value_style)], [Paragraph(escape(planilla.observaciones or ""), body_left_style)]]
    obs_table = Table(obs_data, colWidths=[doc.width])
    obs_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (0, 0), colors.white),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 20),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(obs_table)
    elements.append(Spacer(1, 20))

    firmas_table_rows = []
    if profesores_qs.exists():
        for p in profesores_qs:
            firmas_table_rows.append([
                Paragraph(f"<b>Profesor/a: {escape(p.nombre)}</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
                Paragraph(f"<b>DNI: {escape(p.dni or '_______________________')}</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
            ])
    else:
        firmas_table_rows.append([
            Paragraph("<b>Profesor/a: _______________________</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
            Paragraph("<b>DNI: _______________________</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
        ])
    
    b_nom = bedel_docente.nombre if bedel_docente else "_______________________"
    b_dni = bedel_docente.dni if bedel_docente else "_______________________"
    firmas_table_rows.append([
        Paragraph(f"<b>Bedel: {escape(b_nom)}</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
        Paragraph(f"<b>DNI: {escape(b_dni)}</b>", ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)),
    ])
    
    firmas_table = Table(firmas_table_rows, colWidths=[350, 150])
    firmas_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(firmas_table)
    elements.append(Spacer(1, 25))

    referencias = planilla.plantilla.referencias or []
    if referencias:
        elements.append(Paragraph('REFERENCIAS DE CASILLERO "SITUACIÓN ACADÉMICA"', doc_center_style))
        ref_header = [Paragraph("<b>VALOR</b>", header_style), Paragraph("<b>DESCRIPCIÓN</b>", header_style)]
        ref_data = [ref_header]
        for ref in referencias:
            cod = ref.get("codigo") or ref.get("label") or "-"
            desc = ref.get("descripcion") or ""
            ref_data.append([Paragraph(f"<b>{escape(str(cod))}</b>", header_style), Paragraph(escape(str(desc)), body_left_style)])
            
        ref_table = Table(ref_data, colWidths=[80, 460])
        ref_style = TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), color_header),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
        for idx, ref in enumerate(referencias, start=1):
            color = get_situacion_color(ref.get("codigo"))
            if color:
                ref_style.add('BACKGROUND', (0, idx), (0, idx), color)
        ref_table.setStyle(ref_style)
        elements.append(ref_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
