from __future__ import annotations

import csv
import io
import re
import unicodedata
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

from django.conf import settings
from django.contrib.auth.models import Group, User
from django.core.files.base import ContentFile
from django.core.management.base import CommandError
from django.db import transaction
from django.db.models import Max
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

from apps.alumnos.carga_notas_api import ALIAS_TO_SITUACION, _situaciones_para_formato
from core.models import (
    Docente,
    EquivalenciaCurricular,
    Estudiante,
    InscripcionMateriaAlumno,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    PlanillaRegularidadHistorial,
    PreinscripcionChecklist,
    Profesorado,
    Regularidad,
    RegularidadPlantilla,
)
from core.permissions import allowed_profesorados, ensure_profesorado_access


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    val = value.strip().lower()
    return val in {"true", "1", "si", "sÃƒÆ’Ã‚Â­", "yes", "verdadero"}


def _parse_date(value: str) -> date | None:
    value = value.strip()
    if not value:
        return None
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise CommandError(f"Fecha con formato no reconocido: '{value}'. Se esperan formatos DD/MM/AAAA o AAAA-MM-DD.")


def _normalize_estado_legajo(value: str) -> str:
    if not value:
        return Estudiante.EstadoLegajo.PENDIENTE
    val = value.upper()
    if val in {"COMPLETO", "COM"}:
        return Estudiante.EstadoLegajo.COMPLETO
    if val in {"INCOMPLETO", "INC"}:
        return Estudiante.EstadoLegajo.INCOMPLETO
    if val in {"PENDIENTE", "PEN"}:
        return Estudiante.EstadoLegajo.PENDIENTE
    return Estudiante.EstadoLegajo.PENDIENTE


def _merge_datos_extra(base: dict | None, **values) -> dict:
    data = dict(base or {})
    for key, value in values.items():
        if value in (None, "", []):
            continue
        data[key] = value
    return data


def _normalize_header(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = value.replace("\ufeff", "")
    if cleaned.startswith("ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â¿"):
        cleaned = cleaned[3:]
    return cleaned.strip()


def _normalize_label(value: str) -> str:
    return "".join((value or "").split()).lower()


def _normalize_value(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = value.replace("\ufeff", "").strip()
    return cleaned.strip()


class _atomic_rollback:
    """Context manager that wraps a transaction.atomic and forces a rollback."""

    def __enter__(self):
        self._ctx = transaction.atomic()
        self._ctx.__enter__()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        transaction.set_rollback(True)
        return self._ctx.__exit__(exc_type, exc_val, exc_tb)


def _normalize_alias(value: str | None) -> str:
    return (value or "").strip().upper()


FORMATO_SLUG_MAP = {
    "ASI": "asignatura",
    "MOD": "modulo",
    "TAL": "taller",
    "PRA": "taller",
    "LAB": "taller",
    "SEM": "taller",
}


def _format_column_label(value: str | None) -> str:
    if not value:
        return ""
    normalized = value.replace("Ãƒâ€šÃ‚Âº", "").replace("Ãƒâ€šÃ‚Â°", "")
    normalized = re.sub(r"([0-9])\s*C\.?", r"\1C", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def _profesorado_acronym(profesorado: Profesorado) -> str:
    normalized = unicodedata.normalize("NFKD", profesorado.nombre).encode("ascii", "ignore").decode("ascii")
    parts = [segment for segment in normalized.replace("-", " ").split() if segment]
    if not parts:
        return f"P{profesorado.id:02d}"
    acronym = "".join(part[0] for part in parts if part[0].isalpha())
    return (acronym or f"P{profesorado.id:02d}")[:4].upper()


def _planilla_codigo(profesorado: Profesorado, fecha: date, numero: int) -> str:
    acronym = _profesorado_acronym(profesorado)
    return f"PRP{profesorado.id:02d}{acronym}{fecha:%d%m%Y}{numero:03d}"


def _next_planilla_numero(profesorado_id: int, anio: int) -> int:
    ultimo = (
        PlanillaRegularidad.objects.filter(profesorado_id=profesorado_id, anio_academico=anio)
        .aggregate(Max("numero"))
        .get("numero__max")
    )
    return (ultimo or 0) + 1


def _resolve_situacion(raw: str, formato_slug: str) -> str:
    alias_key = _normalize_alias(raw)
    if not alias_key:
        raise ValueError("La situaciÃƒÆ’Ã‚Â³n acadÃƒÆ’Ã‚Â©mica es obligatoria.")

    if alias_key in ALIAS_TO_SITUACION:
        return ALIAS_TO_SITUACION[alias_key]

    allowed_aliases = {_normalize_alias(item.get("alias", "")) for item in _situaciones_para_formato(formato_slug)}
    allowed_codes = {_normalize_alias(item.get("codigo", "")) for item in _situaciones_para_formato(formato_slug)}

    if alias_key in allowed_codes:
        return alias_key

    if alias_key in allowed_aliases:
        mapped = ALIAS_TO_SITUACION.get(alias_key)
        if mapped:
            return mapped

    # Permit already-normalized DB codes (REG, APR, etc.)
    for code in Regularidad.Situacion.values:
        if alias_key == _normalize_alias(code):
            return code

    raise ValueError(f"Situacion academica '{raw}' no es valida para el formato seleccionado.")


def _regularidad_metadata_for_user(user: User) -> dict:
    allowed = allowed_profesorados(user, role_filter={"bedel", "secretaria"})
    profes_qs = Profesorado.objects.filter(activo=True).order_by("nombre")
    if allowed is not None:
        if not allowed:
            return {"profesorados": [], "plantillas": []}
        profes_qs = profes_qs.filter(id__in=allowed)

    profes_qs = profes_qs.prefetch_related("planes__materias")

    profes_data = []
    for profesorado in profes_qs:
        planes_data = []
        for plan in profesorado.planes.all().order_by("anio_inicio"):
            materias_data = []
            for materia in plan.materias.all().order_by("anio_cursada", "nombre"):
                materias_data.append(
                    {
                        "id": materia.id,
                        "nombre": materia.nombre,
                        "anio_cursada": materia.anio_cursada,
                        "formato": materia.formato,
                        "regimen": materia.regimen,
                        "plan_id": plan.id,
                        "plan_resolucion": plan.resolucion,
                    }
                )
            planes_data.append(
                {
                    "id": plan.id,
                    "resolucion": plan.resolucion,
                    "anio_inicio": plan.anio_inicio,
                    "anio_fin": plan.anio_fin,
                    "vigente": plan.vigente,
                    "materias": materias_data,
                }
            )
        profes_data.append(
            {
                "id": profesorado.id,
                "nombre": profesorado.nombre,
                "acronimo": _profesorado_acronym(profesorado),
                "planes": planes_data,
            }
        )

    plantillas = []
    plantillas_qs = RegularidadPlantilla.objects.select_related("formato").order_by("formato__nombre", "dictado")
    for plantilla in plantillas_qs:
        columnas_normalizadas = []
        for columna in plantilla.columnas or []:
            normalizada = dict(columna or {})
            normalizada["label"] = _format_column_label(normalizada.get("label") or normalizada.get("key") or "")
            columnas_normalizadas.append(normalizada)

        plantillas.append(
            {
                "id": plantilla.id,
                "nombre": plantilla.nombre,
                "dictado": plantilla.dictado,
                "descripcion": plantilla.descripcion,
                "columnas": columnas_normalizadas,
                "situaciones": plantilla.situaciones,
                "referencias": plantilla.referencias,
                "formato": {
                    "slug": plantilla.formato.slug,
                    "nombre": plantilla.formato.nombre,
                    "metadata": plantilla.formato.metadata,
                },
            }
        )

    docente_qs = Docente.objects.order_by("apellido", "nombre")
    docentes = [
        {
            "id": docente.id,
            "nombre": f"{docente.apellido}, {docente.nombre}".strip(", "),
            "dni": docente.dni,
        }
        for docente in docente_qs
    ]

    estudiantes = []
    estudiantes_qs = (
        Estudiante.objects.filter(carreras__in=profes_qs)
        .distinct()
        .prefetch_related("carreras", "user")
        .order_by("user__last_name", "user__first_name")
    )
    for estudiante in estudiantes_qs:
        apellido = (estudiante.user.last_name or "").strip()
        nombre = (estudiante.user.first_name or "").strip()
        estudiantes.append(
            {
                "dni": estudiante.dni,
                "apellido_nombre": f"{apellido}, {nombre}".strip(", "),
                "profesorados": list(estudiante.carreras.values_list("id", flat=True)),
            }
        )

    return {
        "profesorados": profes_data,
        "plantillas": plantillas,
        "docentes": docentes,
        "estudiantes": estudiantes,
    }


def _limpiar_datos_fila(raw_datos: dict | None, columnas: list[dict]) -> dict:
    if not raw_datos:
        return {}
    allowed_keys = {col.get("key") for col in columnas if col.get("key")}
    cleaned = {}
    for key, value in raw_datos.items():
        if key not in allowed_keys:
            continue
        val = _normalize_value(str(value))
        if val == "":
            continue
        cleaned[key] = val
    return cleaned


def _decimal_from_string(value: str | None) -> Decimal | None:
    if value in (None, "", []):
        return None
    try:
        return Decimal(str(value).replace(",", ".")).quantize(Decimal("0.1"))
    except (InvalidOperation, ValueError):
        return None


def _extraer_nota_practicos(columnas: list[dict], datos: dict) -> Decimal | None:
    if not datos:
        return None
    for col in columnas:
        key = col.get("key")
        if not key:
            continue
        valor = datos.get(key)
        nota = _decimal_from_string(valor)
        if nota is not None:
            return nota
    return None


def _ensure_required_row_fields(row: dict) -> None:
    missing = []
    for field in (
        "orden",
        "dni",
        "apellido_nombre",
        "nota_final",
        "asistencia",
        "situacion",
    ):
        if row.get(field) in (None, "", []):
            missing.append(field)
    if missing:
        raise ValueError(f"Campos obligatorios faltantes en la fila {row.get('orden')}: {', '.join(missing)}.")


# -------------------------------------------------------------
# FunciÃƒÆ’Ã‚Â³n Principal para la GeneraciÃƒÆ’Ã‚Â³n del PDF
# -------------------------------------------------------------


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

    title_style = ParagraphStyle(
        "PlanillaTitle",
        parent=styles["Heading1"],
        fontSize=14,
        alignment=TA_CENTER,
        spaceAfter=12,
        spaceBefore=6,
    )
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
    section_heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading4"],
        alignment=TA_LEFT,
        fontSize=10,
        leading=12,
        spaceBefore=6,
        spaceAfter=4,
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

    base_dir = Path(settings.BASE_DIR)

    def _display(value: Any, default: str = "-") -> str:
        if value in (None, "", [], {}):
            return default
        return str(value)

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

    def _build_info(label: str, value: Any) -> Paragraph:
        formatted = escape(_display(value))
        if label:
            return Paragraph(f"<b>{label}:</b> {formatted}", info_style)
        return Paragraph(formatted, info_style)

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
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("PLANILLA DE REGULARIDAD Y PROMOCIÃƒÆ’Ã¢â‚¬Å“N", title_style))

    docentes_qs = planilla.docentes.all().order_by("orden", "id")
    docente_principal = docentes_qs.filter(rol="P").first()
    docente_nombre = _display(docente_principal.nombre if docente_principal else "_______________________")

    if isinstance(planilla.fecha, datetime | date):
        fecha_formateada = planilla.fecha.strftime("%d/%m/%Y")
    else:
        fecha_formateada = _display(planilla.fecha)

    info_pairs: list[tuple[str, Any, str, Any]] = [
        ("CODIGO", planilla.codigo, "PROFESORADO DE", planilla.profesorado.nombre),
        (
            "UNIDAD CURRICULAR",
            planilla.materia.nombre,
            "RESOLUCIÃƒÆ’Ã¢â‚¬Å“N NRO",
            planilla.plan_resolucion or planilla.materia.plan_de_estudio.resolucion,
        ),
        (
            "FORMATO",
            planilla.formato.nombre,
            "DICTADO",
            planilla.plantilla.get_dictado_display(),
        ),
        (
            "AÃƒÆ’Ã¢â‚¬ËœO DE CURSADA",
            planilla.materia.anio_cursada or "-",
            "FOLIO NRO",
            planilla.folio or "-",
        ),
        ("PROFESOR/A", docente_nombre, "FECHA", fecha_formateada),
    ]

    for key, value in (planilla.datos_adicionales or {}).items():
        label = key.replace("_", " ").strip().upper()
        info_pairs.append((label, value, "", ""))

    info_data = [
        [_build_info(left_label, left_value), _build_info(right_label, right_value)]
        for left_label, left_value, right_label, right_value in info_pairs
    ]

    info_base_widths = [270.0, 270.0]
    info_total = sum(info_base_widths)
    info_scale = min(1.0, doc.width / info_total)
    info_widths = [w * info_scale for w in info_base_widths]

    info_table = Table(info_data, colWidths=info_widths)
    info_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    elements.append(info_table)
    elements.append(Spacer(1, 12))

    columnas_raw = planilla.plantilla.columnas or []
    columnas_tp = [
        {
            "key": col.get("key"),
            "label": _format_column_label(col.get("label") or col.get("key") or "").upper(),
        }
        for col in columnas_raw
    ]

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
        ("<b>SITUACIÃƒÆ’Ã¢â‚¬Å“N ACADÃƒÆ’Ã¢â‚¬Â°MICA</b>", situacion_idx),
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
        situacion_valor = situacion_labels.get(fila.situacion, fila.situacion)
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
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0e0e0")),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f5f5f5")),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (1, 2), (1, -1), 2),
            ("RIGHTPADDING", (1, 2), (1, -1), 2),
            ("ALIGN", (1, 2), (1, -1), "LEFT"),
        ]
    )

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

    if planilla.observaciones:
        elements.append(Paragraph("Observaciones:", section_heading_style))
        obs_style = ParagraphStyle(
            "ObservacionesTexto",
            parent=styles["BodyText"],
            fontSize=9,
            leading=12,
            alignment=TA_LEFT,
        )
        elements.append(Paragraph(planilla.observaciones.replace("\n", "<br/>"), obs_style))
        elements.append(Spacer(1, 12))

    profesor_docente = docentes_qs.filter(rol="P").first()
    bedel_docente = docentes_qs.filter(rol="B").first()

    if profesor_docente or bedel_docente:
        elements.append(Paragraph("Firmas:", section_heading_style))
        profesor_nombre = _display(profesor_docente.nombre if profesor_docente else "_______________________")
        profesor_dni = _display(profesor_docente.dni if profesor_docente else "-", "-")
        bedel_nombre = _display(bedel_docente.nombre if bedel_docente else "_______________________")
        bedel_dni = _display(bedel_docente.dni if bedel_docente else "-", "-")

        firmas_data = [
            [
                Paragraph(f"<b>Profesor/a:</b> {escape(profesor_nombre)}", info_style),
                Paragraph(f"<b>Bedel:</b> {escape(bedel_nombre)}", info_style),
            ],
            [
                Paragraph(f"<b>DNI:</b> {escape(profesor_dni)}", info_style),
                Paragraph(f"<b>DNI:</b> {escape(bedel_dni)}", info_style),
            ],
            [
                Paragraph("<br/><br/>______________________", info_style),
                Paragraph("<br/><br/>______________________", info_style),
            ],
        ]

        firmas_table = Table(firmas_data, colWidths=[270, 270], hAlign="LEFT")
        firmas_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, 1), "LEFT"),
                    ("ALIGN", (0, 2), (-1, 2), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        elements.append(firmas_table)
        elements.append(Spacer(1, 10))

    referencias = planilla.plantilla.referencias or []
    if referencias:
        elements.append(Paragraph('Referencias de casillero "Situacion Academica":', section_heading_style))
        referencia_style = ParagraphStyle(
            "Referencias",
            parent=styles["BodyText"],
            fontSize=8,
            leading=10,
            alignment=TA_LEFT,
        )
        for referencia in referencias:
            label = referencia.get("label") or referencia.get("codigo") or "-"
            descripcion = referencia.get("descripcion") or ""
            texto = f"<b>{escape(str(label))}:</b> {escape(str(descripcion))}"
            elements.append(Paragraph(texto, referencia_style))
        elements.append(Spacer(1, 8))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def obtener_regularidad_metadata(user: User) -> dict:
    """Devuelve los metadatos necesarios para armar planillas manuales:
    profesorados accesibles, plantillas disponibles y columnas/situaciones.
    """
    return _regularidad_metadata_for_user(user)


def crear_planilla_regularidad(
    *,
    user: User,
    profesorado_id: int,
    materia_id: int,
    plantilla_id: int,
    dictado: str,
    fecha: date,
    folio: str | None = "",
    plan_resolucion: str | None = "",
    observaciones: str = "",
    datos_adicionales: dict | None = None,
    docentes: list[dict] | None = None,
    filas: list[dict] | None = None,
    estado: str = "final",
    dry_run: bool = False,
) -> dict:
    ensure_profesorado_access(user, profesorado_id, role_filter={"bedel", "secretaria"})

    try:
        profesorado = Profesorado.objects.get(pk=profesorado_id)
    except Profesorado.DoesNotExist:
        raise ValueError("El profesorado especificado no existe.") from None

    try:
        materia = Materia.objects.select_related("plan_de_estudio", "plan_de_estudio__profesorado").get(pk=materia_id)
    except Materia.DoesNotExist:
        raise ValueError("La materia especificada no existe.") from None

    if materia.plan_de_estudio.profesorado_id != profesorado.id:
        raise ValueError("La materia seleccionada no pertenece al profesorado elegido.")

    try:
        plantilla = RegularidadPlantilla.objects.select_related("formato").get(pk=plantilla_id)
    except RegularidadPlantilla.DoesNotExist:
        raise ValueError("La plantilla indicada no existe.") from None

    if plantilla.dictado != dictado:
        raise ValueError("El dictado seleccionado no coincide con la plantilla elegida.")

    anio_academico = fecha.year
    numero = _next_planilla_numero(profesorado.id, anio_academico)
    codigo = _planilla_codigo(profesorado, fecha, numero)

    columnas = plantilla.columnas or []
    formato_para_situaciones = materia.formato
    filas = filas or []
    docentes = docentes or []

    if not filas:
        raise ValueError("Debe proporcionar al menos una fila de estudiantes.")

    atomic_ctx = transaction.atomic if not dry_run else _atomic_rollback
    warnings: list[str] = []
    regularidades_registradas = 0

    with atomic_ctx():
        planilla = PlanillaRegularidad.objects.create(
            codigo=codigo,
            numero=numero,
            anio_academico=anio_academico,
            profesorado=profesorado,
            materia=materia,
            plantilla=plantilla,
            formato=plantilla.formato,
            dictado=dictado,
            plan_resolucion=plan_resolucion or materia.plan_de_estudio.resolucion,
            folio=folio or "",
            fecha=fecha,
            observaciones=observaciones or "",
            estado=estado,
            datos_adicionales=datos_adicionales or {},
            created_by=user,
        )

        # Docentes firmantes
        for idx, docente_data in enumerate(docentes, start=1):
            nombre = docente_data.get("nombre", "").strip()
            if not nombre:
                continue
            dni_docente = _normalize_value(docente_data.get("dni"))
            docente_obj = None
            docente_id = docente_data.get("docente_id")
            if docente_id:
                docente_obj = Docente.objects.filter(pk=docente_id).first()
            elif dni_docente:
                docente_obj = Docente.objects.filter(dni=dni_docente).first()

            PlanillaRegularidadDocente.objects.create(
                planilla=planilla,
                docente=docente_obj,
                nombre=nombre,
                dni=dni_docente,
                rol=docente_data.get("rol") or PlanillaRegularidadDocente.Rol.PROFESOR,
                orden=docente_data.get("orden") or idx,
            )

        # Filas de estudiantes
        ordenes_usados = set()
        dnis_usados = set()
        for idx, fila_data in enumerate(filas, start=1):
            orden = fila_data.get("orden") or idx
            fila_data["orden"] = orden
            _ensure_required_row_fields(fila_data)

            if orden in ordenes_usados:
                raise ValueError(f"El nÃƒÆ’Ã‚Âºmero de orden {orden} estÃƒÆ’Ã‚Â¡ duplicado.")
            ordenes_usados.add(orden)

            dni = _normalize_value(fila_data.get("dni"))
            if dni:
                if dni in dnis_usados:
                    raise ValueError(f"El DNI {dni} aparece mÃƒÆ’Ã‚Â¡s de una vez en la planilla.")
                dnis_usados.add(dni)
            estudiante = Estudiante.objects.filter(dni=dni).first() if dni else None

            situacion = _resolve_situacion(fila_data.get("situacion", ""), formato_para_situaciones)
            nota_final_raw = fila_data.get("nota_final")
            nota_final_decimal = None
            if nota_final_raw not in (None, "", []):
                try:
                    nota_final_decimal = Decimal(str(nota_final_raw)).quantize(Decimal("0.1"))
                except (InvalidOperation, ValueError) as e:
                    raise ValueError(
                        f"La nota final de la fila {orden} debe ser un número válido."
                    ) from e
            nota_final_entera = None
            if nota_final_decimal is not None:
                nota_final_entera = int(nota_final_decimal.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

            asistencia_raw = fila_data.get("asistencia")
            if asistencia_raw in (None, "", []):
                asistencia = None
            else:
                asistencia = int(asistencia_raw)
                if asistencia < 0 or asistencia > 100:
                    raise ValueError(f"La asistencia de la fila {orden} debe estar entre 0 y 100.")

            excepcion = fila_data.get("excepcion")
            excepcion_bool = bool(excepcion)
            if isinstance(excepcion, str):
                excepcion_bool = _to_bool(excepcion)

            datos_extra = _limpiar_datos_fila(fila_data.get("datos"), columnas)

            PlanillaRegularidadFila.objects.create(
                planilla=planilla,
                orden=orden,
                estudiante=estudiante,
                dni=dni,
                apellido_nombre=_normalize_value(fila_data.get("apellido_nombre")),
                nota_final=nota_final_decimal,
                asistencia_porcentaje=asistencia,
                situacion=situacion,
                excepcion=excepcion_bool,
                datos=datos_extra,
            )

            if (
                situacion == Regularidad.Situacion.PROMOCIONADO
                and nota_final_entera is not None
                and nota_final_entera < 8
            ):
                raise ValueError(f"La nota final debe ser >= 8 para registrar una promociÃƒÆ’Ã‚Â³n en la fila {orden}.")

            if not estudiante:
                warnings.append(
                    f"[Fila {orden}] Estudiante con DNI {dni} no encontrado. "
                    "Se omitió el registro de regularidad."
                )
                continue

            if materia.nombre.upper().startswith("EDI") and situacion in {
                Regularidad.Situacion.APROBADO,
                Regularidad.Situacion.PROMOCIONADO,
                Regularidad.Situacion.REGULAR,
            }:
                try:
                    checklist = PreinscripcionChecklist.objects.get(preinscripcion__alumno=estudiante)
                    if not checklist.curso_introductorio_aprobado:
                        raise ValueError(
                            f"El estudiante {estudiante.dni} no tiene el curso introductorio aprobado. "
                            f"No se puede registrar la situaciÃƒÆ’Ã‚Â³n '{situacion}' para una materia EDI."
                        )
                except PreinscripcionChecklist.DoesNotExist:
                    raise ValueError(
                        f"El estudiante {estudiante.dni} no posee checklist de preinscripciÃƒÆ’Ã‚Â³n. "
                        f"No se puede registrar la situaciÃƒÆ’Ã‚Â³n '{situacion}' para una materia EDI."
                    ) from None

            nota_tp_decimal = _extraer_nota_practicos(columnas, datos_extra)

            inscripcion = (
                InscripcionMateriaAlumno.objects.filter(estudiante=estudiante, materia=materia, anio=anio_academico)
                .order_by("-anio")
                .first()
            )
            if inscripcion is None:
                inscripcion = (
                    InscripcionMateriaAlumno.objects.filter(estudiante=estudiante, materia=materia)
                    .order_by("-anio")
                    .first()
                )
                if inscripcion is None:
                    warnings.append(
                        f"[Fila {orden}] No se encontró inscripción para {estudiante.dni} en {materia.nombre}. "
                        "Se registró la regularidad sin asociarla a una inscripción."
                    )

            regularidad_defaults = {
                "inscripcion": inscripcion,
                "nota_trabajos_practicos": nota_tp_decimal,
                "nota_final_cursada": nota_final_entera,
                "asistencia_porcentaje": asistencia,
                "excepcion": excepcion_bool,
                "situacion": situacion,
                "observaciones": (fila_data.get("observaciones") or "").strip(),
            }

            Regularidad.objects.update_or_create(
                estudiante=estudiante,
                materia=materia,
                fecha_cierre=fecha,
                defaults=regularidad_defaults,
            )
            regularidades_registradas += 1

        PlanillaRegularidadHistorial.objects.create(
            planilla=planilla,
            accion=PlanillaRegularidadHistorial.Accion.CREACION,
            usuario=user,
            payload={
                "numero": numero,
                "filas": len(filas),
                "docentes": len(docentes),
                "regularidades": regularidades_registradas,
                "warnings": warnings,
            },
        )

        if not dry_run:
            pdf_bytes = _render_planilla_regularidad_pdf(planilla)
            filename = f"{planilla.codigo}.pdf"
            planilla.pdf.save(filename, ContentFile(pdf_bytes), save=True)

        result = {
            "id": planilla.id,
            "codigo": planilla.codigo,
            "numero": planilla.numero,
            "anio_academico": planilla.anio_academico,
            "profesorado_id": planilla.profesorado_id,
            "materia_id": planilla.materia_id,
            "plantilla_id": planilla.plantilla_id,
            "dictado": planilla.dictado,
            "fecha": planilla.fecha.isoformat(),
            "pdf_url": planilla.pdf.url if planilla.pdf and not dry_run else None,
            "warnings": warnings,
            "regularidades_registradas": regularidades_registradas,
        }

    return result


REQUIRED_COLUMNS_ESTUDIANTES = {
    "DNI",
    "apellido",
    "nombre",
    "email",
    "password_plane",
    "must_change_password",
    "is_active",
    "fecha_nacimiento",
    "telÃƒÆ’Ã‚Â©fono",
    "domicilio",
    "estado_legajo",
    "carreras",
    "anio_ingreso",
    "genero",
    "Cuil",
    "rol_extra",
}


def _get_profesorado_from_cache(cache: dict[str, Profesorado], nombre: str) -> Profesorado:
    target = _normalize_label(nombre)
    opciones = []
    for profesorado in Profesorado.objects.all():
        normalizado = _normalize_label(profesorado.nombre)
        opciones.append((normalizado, profesorado.nombre))
        if normalizado == target:
            cache[nombre] = profesorado
            return profesorado
    disponibles = ", ".join(nombre for _, nombre in opciones)
    raise CommandError(f"No se encontrÃƒÆ’Ã‚Â³ el profesorado '{nombre}'. Disponibles: {disponibles}")


def _import_estudiante_record(
    record: dict[str, Any],
    *,
    profesorado: Profesorado,
    alumno_group: Group,
) -> tuple[Estudiante, bool]:
    dni = (record.get("dni") or record.get("DNI") or "").strip()
    if not dni:
        raise ValueError("El DNI es obligatorio.")

    first_name = (record.get("nombre") or record.get("first_name") or "").strip()
    last_name = (record.get("apellido") or record.get("last_name") or "").strip()
    email = (record.get("email") or "").strip()
    password = (record.get("password_plane") or record.get("password") or "").strip()

    raw_is_active = record.get("is_active")
    is_active = True if raw_is_active in (None, "", [], {}) else _to_bool(str(raw_is_active))

    raw_must_change = record.get("must_change_password")
    must_change = True if raw_must_change in (None, "", [], {}) else _to_bool(str(raw_must_change))

    raw_fecha = record.get("fecha_nacimiento") or record.get("fecha_nac")
    if isinstance(raw_fecha, date):
        fecha_nacimiento = raw_fecha
    elif raw_fecha:
        fecha_nacimiento = _parse_date(str(raw_fecha))
    else:
        fecha_nacimiento = None

    telefono = (record.get("telefono") or record.get("telÃƒÆ’Ã‚Â©fono") or "").strip()
    domicilio = (record.get("domicilio") or "").strip()
    estado_legajo = (record.get("estado_legajo") or "").strip().upper()
    anio_ingreso_val = (record.get("anio_ingreso") or "").strip()
    genero = (record.get("genero") or "").strip()
    rol_extra = (record.get("rol_extra") or "").strip()
    observaciones = (record.get("observaciones") or "").strip()
    cuil_valor = (record.get("cuil") or record.get("Cuil") or "").strip()
    cohorte = (record.get("cohorte") or "").strip()
    legajo_valor = (record.get("legajo") or "").strip()

    user, user_created = User.objects.get_or_create(
        username=dni,
        defaults={
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "is_active": is_active,
        },
    )

    updated_user = False
    if not user_created:
        if user.first_name != first_name:
            user.first_name = first_name
            updated_user = True
        if user.last_name != last_name:
            user.last_name = last_name
            updated_user = True
        if email and user.email != email:
            user.email = email
            updated_user = True
        if user.is_active != is_active:
            user.is_active = is_active
            updated_user = True
    if password:
        user.set_password(password)
        updated_user = True
    elif user_created and not password:
        user.set_unusable_password()
        updated_user = True
    if updated_user:
        user.save()

    if alumno_group not in user.groups.all():
        user.groups.add(alumno_group)

    if not anio_ingreso_val:
        raise ValueError("El campo anio_ingreso es obligatorio.")
    try:
        anio_ingreso_int = int(anio_ingreso_val)
    except ValueError as exc:
        raise ValueError(f"anio_ingreso inválido: {anio_ingreso_val}") from exc

    estudiante, student_created = Estudiante.objects.get_or_create(
        dni=dni,
        defaults={
            "user": user,
            "fecha_nacimiento": fecha_nacimiento,
            "telefono": telefono,
            "domicilio": domicilio,
            "estado_legajo": _normalize_estado_legajo(estado_legajo),
            "must_change_password": must_change,
            "legajo": legajo_valor or None,
            "datos_extra": _merge_datos_extra(
                {},
                anio_ingreso=anio_ingreso_val,
                genero=genero,
                rol_extra=rol_extra,
                observaciones=observaciones,
                cuil=cuil_valor,
                cohorte=cohorte,
            ),
        },
    )

    updated_student = False
    if not student_created:
        if estudiante.user_id != user.id:
            estudiante.user = user
            updated_student = True
        if estudiante.fecha_nacimiento != fecha_nacimiento:
            estudiante.fecha_nacimiento = fecha_nacimiento
            updated_student = True
        if estudiante.telefono != telefono:
            estudiante.telefono = telefono
            updated_student = True
        if estudiante.domicilio != domicilio:
            estudiante.domicilio = domicilio
            updated_student = True
        estado_normalizado = _normalize_estado_legajo(estado_legajo)
        if estado_normalizado and estudiante.estado_legajo != estado_normalizado:
            estudiante.estado_legajo = estado_normalizado
            updated_student = True
        if estudiante.must_change_password != must_change:
            estudiante.must_change_password = must_change
            updated_student = True
        if legajo_valor and estudiante.legajo != legajo_valor:
            estudiante.legajo = legajo_valor
            updated_student = True
        merged_extra = _merge_datos_extra(
            estudiante.datos_extra,
            anio_ingreso=anio_ingreso_val,
            genero=genero,
            rol_extra=rol_extra,
            observaciones=observaciones,
            cuil=cuil_valor,
            cohorte=cohorte,
        )
        if merged_extra != (estudiante.datos_extra or {}):
            estudiante.datos_extra = merged_extra
            updated_student = True
        if updated_student:
            estudiante.save()
    else:
        estudiante.save()

    cohorte_asignada = cohorte or str(anio_ingreso_int)
    estudiante.asignar_profesorado(
        profesorado,
        anio_ingreso=anio_ingreso_int,
        cohorte=cohorte_asignada,
    )
    return estudiante, student_created


def process_estudiantes_csv(file_content: str, dry_run: bool = False) -> dict:
    """Procesa datos de estudiantes desde un CSV."""
    processed_count = 0
    skipped_count = 0
    errors: list[str] = []

    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    raw_headers = reader.fieldnames or []
    headers = [_normalize_header(h) for h in raw_headers]
    normalized_headers = {_normalize_label(h) for h in headers}

    missing = {orig for orig in REQUIRED_COLUMNS_ESTUDIANTES if _normalize_label(orig) not in normalized_headers}
    if missing:
        errors.append(f"El CSV no contiene las columnas requeridas: {', '.join(sorted(missing))}")
        return {
            "ok": False,
            "processed": processed_count,
            "skipped": skipped_count,
            "errors": errors,
        }

    alumno_group, _ = Group.objects.get_or_create(name="alumno")
    carreras_cache: dict[str, Profesorado] = {}
    atomic_context = transaction.atomic if not dry_run else _atomic_rollback

    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                normalized_row = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}

                dni = normalized_row.get("DNI", "").strip()
                if not dni:
                    skipped_count += 1
                    errors.append(f"[Fila {idx}] Se omite por no tener DNI.")
                    continue

                carrera_nombre = normalized_row.get("carreras", "").strip()
                if not carrera_nombre:
                    raise ValueError("No se especificÃƒÂ³ la carrera.")

                profesorado = carreras_cache.get(carrera_nombre)
                if profesorado is None:
                    profesorado = _get_profesorado_from_cache(carreras_cache, carrera_nombre)

                record = dict(normalized_row)
                record["dni"] = dni
                _import_estudiante_record(
                    record,
                    profesorado=profesorado,
                    alumno_group=alumno_group,
                )
                processed_count += 1
            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")

    return {
        "ok": not bool(errors),
        "processed": processed_count,
        "skipped": skipped_count,
        "errors": errors,
    }


def crear_estudiante_manual(*, user: User, data: dict[str, Any]) -> dict[str, Any]:
    alumno_group, _ = Group.objects.get_or_create(name="alumno")
    profesorado_id = data.get("profesorado_id")
    if not profesorado_id:
        raise ValueError("Debe indicar el profesorado.")

    try:
        profesorado = Profesorado.objects.get(pk=profesorado_id)
    except Profesorado.DoesNotExist:
        raise ValueError("Profesorado no encontrado.") from None

    record = dict(data)
    record.pop("profesorado_id", None)

    with transaction.atomic():
        estudiante, created = _import_estudiante_record(
            record,
            profesorado=profesorado,
            alumno_group=alumno_group,
        )

    full_name = estudiante.user.get_full_name() if estudiante.user_id else ""
    message = "Estudiante registrado." if created else "Estudiante actualizado."

    return {
        "estudiante_id": estudiante.id,
        "dni": estudiante.dni,
        "nombre": full_name,
        "created": created,
        "message": message,
    }


REQUIRED_COLUMNS_FOLIOS_FINALES = {
    "DNI",
    "Materia",
    "Tipo Mesa",
    "Modalidad Mesa",
    "Fecha Mesa",
    "Folio",
    "Libro",
}


def process_folios_finales_csv(file_content: str, dry_run: bool = False) -> dict:
    processed_count = 0
    skipped_count = 0
    errors = []

    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    raw_headers = reader.fieldnames or []
    headers = [_normalize_header(h) for h in raw_headers]

    missing = REQUIRED_COLUMNS_FOLIOS_FINALES - set(headers)
    if missing:
        errors.append(f"El CSV no contiene las columnas requeridas: {', '.join(sorted(missing))}")
        return {
            "ok": False,
            "processed": processed_count,
            "skipped": skipped_count,
            "errors": errors,
        }

    atomic_context = transaction.atomic if not dry_run else _atomic_rollback

    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                normalized_row = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}

                dni = normalized_row.get("DNI", "").strip()
                if not dni:
                    skipped_count += 1
                    errors.append(f"[Fila {idx}] Se omite por no tener DNI.")
                    continue

                materia_nombre = normalized_row.get("Materia", "").strip()
                tipo_mesa_str = normalized_row.get("Tipo Mesa", "").strip()
                modalidad_mesa_str = normalized_row.get("Modalidad Mesa", "").strip()
                fecha_mesa_str = normalized_row.get("Fecha Mesa", "").strip()
                folio = normalized_row.get("Folio", "").strip()
                libro = normalized_row.get("Libro", "").strip()

                if (
                    not materia_nombre
                    or not tipo_mesa_str
                    or not modalidad_mesa_str
                    or not fecha_mesa_str
                    or not folio
                    or not libro
                ):
                    raise ValueError(
                        "Materia, Tipo Mesa, Modalidad Mesa, Fecha Mesa, Folio y Libro son campos requeridos."
                    )

                estudiante = Estudiante.objects.filter(dni=dni).first()
                if not estudiante:
                    raise ValueError(f"Estudiante con DNI {dni} no encontrado.")

                materia = Materia.objects.filter(nombre=materia_nombre).first()
                if not materia:
                    raise ValueError(f"Materia '{materia_nombre}' no encontrada.")

                try:
                    fecha_mesa = _parse_date(fecha_mesa_str)
                except CommandError as e:
                    raise ValueError(f"Fecha Mesa: {e}") from e

                mesa_examen = MesaExamen.objects.filter(
                    materia=materia,
                    tipo=tipo_mesa_str,
                    modalidad=modalidad_mesa_str,
                    fecha=fecha_mesa,
                ).first()
                if not mesa_examen:
                    raise ValueError(
                        f"Mesa de examen para {materia.nombre} ({tipo_mesa_str}, {modalidad_mesa_str}) "
                        f"en {fecha_mesa_str} no encontrada."
                    )

                inscripcion_mesa = InscripcionMesa.objects.filter(
                    estudiante=estudiante,
                    mesa=mesa_examen,
                ).first()

                if not inscripcion_mesa:
                    raise ValueError(
                        f"Inscripción a mesa de examen para {estudiante.dni} en {materia.nombre} "
                        f"({fecha_mesa_str}) no encontrada."
                    )

                inscripcion_mesa.folio = folio
                inscripcion_mesa.libro = libro
                inscripcion_mesa.save()
                processed_count += 1

            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")

    return {
        "ok": not bool(errors),
        "processed": processed_count,
        "skipped": skipped_count,
        "errors": errors,
    }


REQUIRED_COLUMNS_EQUIVALENCIAS = {
    "Codigo Equivalencia",
    "Nombre Equivalencia",
    "Materia",
    "AÃƒÆ’Ã‚Â±o Cursada",
    "Plan de Estudio Resolucion",
}


def process_equivalencias_csv(file_content: str, dry_run: bool = False) -> dict:
    processed_count = 0
    skipped_count = 0
    errors = []

    f = io.StringIO(file_content)
    reader = csv.DictReader(f, delimiter=";")
    raw_headers = reader.fieldnames or []
    headers = [_normalize_header(h) for h in raw_headers]

    missing = REQUIRED_COLUMNS_EQUIVALENCIAS - set(headers)
    if missing:
        errors.append(f"El CSV no contiene las columnas requeridas: {', '.join(sorted(missing))}")
        return {
            "ok": False,
            "processed": processed_count,
            "skipped": skipped_count,
            "errors": errors,
        }

    atomic_context = transaction.atomic if not dry_run else _atomic_rollback



    with atomic_context():
        for idx, raw_row in enumerate(reader, start=2):
            try:
                normalized_row = {_normalize_header(k): _normalize_value(v) for k, v in raw_row.items()}

                codigo_equivalencia = normalized_row.get("Codigo Equivalencia", "").strip()
                nombre_equivalencia = normalized_row.get("Nombre Equivalencia", "").strip()
                materia_nombre = normalized_row.get("Materia", "").strip()
                anio_cursada_str = normalized_row.get("AÃƒÆ’Ã‚Â±o Cursada", "").strip()
                plan_resolucion = normalized_row.get("Plan de Estudio Resolucion", "").strip()

                if not codigo_equivalencia or not materia_nombre or not anio_cursada_str or not plan_resolucion:
                    raise ValueError(
                        "Codigo Equivalencia, Materia, Año Cursada y Plan de Estudio Resolucion son campos requeridos."
                    )
                try:
                    anio_cursada = int(anio_cursada_str)
                except ValueError as e:
                    raise ValueError(f"Año Cursada '{anio_cursada_str}' no es un número válido.") from e

                plan_de_estudio = PlanDeEstudio.objects.filter(resolucion=plan_resolucion).first()
                if not plan_de_estudio:
                    raise ValueError(f"Plan de Estudio con resoluciÃƒÆ’Ã‚Â³n '{plan_resolucion}' no encontrado.")

                materia = Materia.objects.filter(
                    nombre=materia_nombre,
                    anio_cursada=anio_cursada,
                    plan_de_estudio=plan_de_estudio,
                ).first()
                if not materia:
                    raise ValueError(
                        f"Materia '{materia_nombre}' ({anio_cursada}° año, Plan {plan_resolucion}) no encontrada."
                    )

                equivalencia, created = EquivalenciaCurricular.objects.get_or_create(
                    codigo=codigo_equivalencia,
                    defaults={"nombre": nombre_equivalencia or codigo_equivalencia},
                )
                if nombre_equivalencia and equivalencia.nombre != nombre_equivalencia:
                    equivalencia.nombre = nombre_equivalencia
                    equivalencia.save()

                equivalencia.materias.add(materia)
                processed_count += 1

            except Exception as e:
                skipped_count += 1
                errors.append(f"[Fila {idx}] Error: {e}")

    return {
        "ok": not bool(errors),
        "processed": processed_count,
        "skipped": skipped_count,
        "errors": errors,
    }
