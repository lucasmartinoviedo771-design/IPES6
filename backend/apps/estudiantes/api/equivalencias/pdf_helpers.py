"""Helpers de generación de PDF/tablas para equivalencias."""

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, Table, TableStyle

from core.models import Estudiante


def _build_equivalencia_paragraphs_internas(
    destino_nombre: str,
    profesorado_origen: str,
    plan_origen: str,
    ciclo_lectivo: str,
) -> list[str]:
    return [
        (
            "Me dirijo a usted, a fin de solicitar el otorgamiento de equivalencias de las materias aprobadas "
            f"en el profesorado {profesorado_origen} (Plan {plan_origen}), durante el ciclo lectivo {ciclo_lectivo}, "
            f"que considero equivalentes a las correspondientes materias del profesorado {destino_nombre}."
        ),
        "Adjunto la documentación requerida para el análisis correspondiente.",
    ]


def _build_equivalencia_paragraphs_externas(
    destino_nombre: str,
    establecimiento: str,
    localidad: str,
    provincia: str,
    plan_destino: str,
    ciclo_lectivo: str,
) -> list[str]:
    return [
        (
            "Me dirijo a usted, a fin de solicitar el otorgamiento de equivalencias de las materias cursadas y "
            f"aprobadas en el establecimiento {establecimiento}, ubicado en {localidad}, provincia de {provincia}, "
            f"durante el ciclo lectivo {ciclo_lectivo}, para que sean consideradas en el profesorado {destino_nombre} "
            f"(Plan {plan_destino})."
        ),
        "Adjunto la documentación correspondiente para su evaluación.",
    ]


def _build_equivalencias_table(materias: list[dict[str, str]]) -> Table:
    header = ["Nombre del espacio curricular", "Formato", "Año de cursada", "Nota"]
    rows: list[list[str]] = [header]
    total_rows = max(len(materias), 8)
    default_row = {"nombre": "", "formato": "", "anio": "", "nota": ""}
    for idx in range(total_rows):
        data = materias[idx] if idx < len(materias) else default_row
        rows.append(
            [
                data.get("nombre") or "",
                data.get("formato") or "",
                data.get("anio") or "",
                data.get("nota") or "",
            ]
        )

    table = Table(rows, colWidths=[230, 110, 80, 60])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("ALIGN", (0, 1), (0, -1), "LEFT"),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def _placeholder(value: str | None, fallback: str = "____________________") -> str:
    value = (value or "").strip()
    return value if value else fallback


def _build_equivalencia_signature(estudiante: Estudiante) -> Table:
    styles = getSampleStyleSheet()
    value_style = ParagraphStyle(
        "EquivalenciaSignatureValue",
        parent=styles["Normal"],
        fontSize=11,
    )
    nombre = _placeholder(estudiante.user.get_full_name() if estudiante.user_id else estudiante.dni)
    telefono = _placeholder(getattr(estudiante, "telefono", "") or "")
    email = _placeholder(getattr(estudiante.user, "email", "") if estudiante.user_id else "")
    data = [
        ["Firma y aclaración (estudiante)", Paragraph(nombre, value_style)],
        ["DNI", Paragraph(estudiante.dni, value_style)],
        ["Teléfono de contacto", Paragraph(telefono, value_style)],
        ["Correo electrónico", Paragraph(email, value_style)],
    ]
    table = Table(data, colWidths=[220, 260], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table
