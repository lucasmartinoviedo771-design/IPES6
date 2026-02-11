from __future__ import annotations

import csv
import io
import re
import math
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

from apps.estudiantes.api.notas_utils import ALIAS_TO_SITUACION, situaciones_para_formato as _situaciones_para_formato
from core.models import (
    Docente,
    EquivalenciaCurricular,
    Estudiante,
    InscripcionMateriaEstudiante,
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
    User,
)
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada
from core.permissions import allowed_profesorados, ensure_profesorado_access


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    val = value.strip().lower()
    return val in {"true", "1", "si", "sí", "yes", "verdadero"}


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
    if cleaned.startswith("ï»¿"):
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
    # Normalizar ordinales a caracter común o quitar si ensucia
    # User shows "TP 1C" in screenshot.
    # El label en DB es "TP 1° C."
    # La funcion actual lo deja como "TP 1 C." -> "TP 1C" por el regex de abajo.
    normalized = value.replace("º", "°")
    # Compactar 1° C. a 1°C
    normalized = re.sub(r"([0-9])°?\s*C\.?", r"\1°C", normalized)
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
        raise ValueError("La situación académica es obligatoria.")

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


def _regularidad_metadata_for_user(user: User, include_all: bool = False) -> dict:
    from django.core.cache import cache
    
    # Generar una clave de caché única por usuario/permisos
    allowed = allowed_profesorados(user, role_filter={"bedel", "secretaria"})
    cache_key = f"reg_metadata_u{user.id}_a{include_all}"
    if allowed is not None:
        allowed_str = "-".join(map(str, sorted(list(allowed))))
        cache_key += f"_p{allowed_str}"
    
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    # Solo si el usuario explicita include_all y es autoridad, permitimos ver todos
    if include_all:
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if es_autoridad or user.is_superuser:
            allowed = None # Deshabilitar filtro por ID
            
    profes_qs = Profesorado.objects.filter(activo=True).order_by("nombre")
    if allowed is not None:
        if not allowed:
            return {"profesorados": [], "plantillas": []}
        profes_qs = profes_qs.filter(id__in=allowed)

    # Optimizamos la consulta con Prefetch para traer todo ordenado de una sola vez
    from django.db.models import Prefetch
    
    # Solo traemos los campos necesarios (.only) para reducir el ancho de banda
    materias_prefetch = Materia.objects.all().only(
        "id", "plan_de_estudio_id", "nombre", "anio_cursada", "formato", "regimen"
    ).order_by("anio_cursada", "nombre")
    
    planes_prefetch = PlanDeEstudio.objects.all().only(
        "id", "profesorado_id", "resolucion", "anio_inicio", "anio_fin", "vigente"
    ).prefetch_related(
        Prefetch("materias", queryset=materias_prefetch)
    ).order_by("anio_inicio")
    
    profes_qs = (
        profes_qs.prefetch_related(
            Prefetch("planes", queryset=planes_prefetch)
        )
    )

    profes_data = []
    for profesorado in profes_qs:
        planes_data = []
        # Importante: usar .all() sin .order_by() para aprovechar el prefetch configurado arriba
        for plan in profesorado.planes.all():
            materias_data = []
            # Mapeo manual para evitar get_regimen_display() en el bucle
            REGIMEN_MAP = {"ANU": "ANUAL", "PCU": "1C", "SCU": "2C"}
            for materia in plan.materias.all():
                materias_data.append(
                    {
                        "id": materia.id,
                        "nombre": materia.nombre,
                        "anio_cursada": materia.anio_cursada,
                        "formato": materia.formato,
                        "dictado": REGIMEN_MAP.get(materia.regimen, "ANUAL"),
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

    docentes = obtener_docentes_metadata()
    estudiantes = obtener_estudiantes_metadata()

    result = {
        "profesorados": profes_data, 
        "plantillas": plantillas,
        "docentes": docentes,
        "estudiantes": estudiantes,
    }
    
    # Guardamos en caché por 1 hora (3600 segundos)
    # Importante: Solo guardamos si hay datos
    from django.core.cache import cache
    if profes_data:
        cache.set(cache_key, result, 3600)
    
    return result

def obtener_docentes_metadata():
    docente_qs = Docente.objects.order_by("apellido", "nombre")
    docentes = [
        {
            "id": docente.id,
            "nombre": f"{docente.apellido}, {docente.nombre}".strip(", "),
            "dni": docente.dni,
        }
        for docente in docente_qs
    ]
    return docentes

def obtener_estudiantes_metadata():
    # Traemos todos los estudiantes para el autocompletado
    # Optimizamos con prefetch de carreras (profesorados)
    estudiantes_qs = Estudiante.objects.all().select_related("user").prefetch_related("carreras").order_by("user__last_name", "user__first_name")
    
    data = []
    for est in estudiantes_qs:
        data.append({
            "dni": est.dni,
            "apellido_nombre": f"{est.user.last_name}, {est.user.first_name}".strip(", "),
            # OPTIMIZACION CRITICA: Usar .all() para aprovechar el prefetch_related.
            # .values_list() dispara una query nueva por cada alumno (N+1).
            "profesorados": [c.id for c in est.carreras.all()]
        })
    return data

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
        # "dni", # DNI is now optional (auto-generated if missing)
        "apellido_nombre",
        "situacion",
    ):
        if row.get(field) in (None, "", []):
            missing.append(field)
    
    # nota_final y asistencia pueden ser None (cuando es '---')
    for field in ("nota_final", "asistencia"):
        if row.get(field) == "" or row.get(field) == []:
            missing.append(field)
            
    if missing:
        raise ValueError(f"Campos obligatorios faltantes en la fila {row.get('orden')}: {', '.join(missing)}.")


# -------------------------------------------------------------
# Función Principal para la Generación del PDF
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
        s = str(value)
        # Limpieza agresiva de mojibake UTF-8
        try:
            # Detectar si es una cadena que parece estar mal codificada
            # Ej: 'PROMOCIÃƒÆ’Ã¢â‚¬Å“N'
            if "Ã" in s:
                # Intentar varios pasos de decodificación si es necesario
                # Probar con latin1 -> utf-8, luego utf-8 -> utf-8 (para doble encoding)
                try:
                    s = s.encode('latin1').decode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass # Fallback to original if it fails
                try:
                    s = s.encode('utf-8').decode('utf-8')
                except (UnicodeEncodeError, UnicodeDecodeError):
                    pass # Fallback to original if it fails
        except:
            pass
        # Reemplazos finales de emergencia
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
    # --- Estilos y Colores ---
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

    doc_center_style = ParagraphStyle(
        "DocCenter", parent=styles["Normal"], fontSize=10, alignment=TA_CENTER, spaceAfter=2
    )

    color_header = colors.HexColor("#d9e2f3")  # Azul claro
    color_promocion = colors.HexColor("#c6e0b4") # Verde claro (Módulos)
    color_regular = colors.HexColor("#ffff00")   # Amarillo
    color_aprobado = colors.HexColor("#ed7d31")  # Naranja (Aprobación directa)
    color_desaprobado = colors.HexColor("#ff0000") # Rojo
    color_libre_i = colors.HexColor("#5b9bd5")    # Azul/Cyan
    # color_libre_at ya no se usa distinto

    def get_situacion_color(codigo):
        c = (codigo or "").upper()
        if "PRO" in c: return color_promocion
        if "REGULAR" in c or c == "REG": return color_regular
        if "APR" in c: return color_aprobado
        if "LBI" in c or "LIBRE-I" in c: return color_libre_i
        if "LAT" in c or "LIBRE-AT" in c: return color_libre_i # Mismo color
        if "DPA" in c or "DTP" in c or "DESAPROBADO" in c: return color_desaprobado
        return None

    # Título principal
    elements.append(Paragraph("PLANILLA DE REGULARIDAD Y PROMOCIÓN", doc_title_style))

    # Firmantes
    docentes_qs = planilla.docentes.all().order_by("orden", "id")
    profesores_qs = docentes_qs.filter(rol="profesor")
    bedel_docente = docentes_qs.filter(rol="bedel").first()
    
    if profesores_qs.exists():
        docente_nombre = " / ".join([p.nombre for p in profesores_qs])
    else:
        docente_nombre = "_______________________"

    # Datos Generales (Tabla Azul)
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

    # --- TABLA DE ALUMNOS ---

    columnas_raw = planilla.plantilla.columnas or []
    columnas_tp = [
        col
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
        # print(f"DEBUG: Checking group for col {col.get('key')}: group={group}")
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

    # Colorear columna de Situación
    for i, fila in enumerate(filas_qs, start=2): # +2 por las cabeceras
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

    # Bloque de Observaciones (enmarcado)
    obs_data = [[Paragraph("<b>OBSERVACIONES:</b>", header_value_style)], [Paragraph(escape(planilla.observaciones or ""), body_left_style)]]
    obs_table = Table(obs_data, colWidths=[doc.width])
    obs_table.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
        ('BACKGROUND', (0, 0), (0, 0), colors.white),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 1), (-1, 1), 20), # Espacio para observaciones manuales si está vacío
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    elements.append(obs_table)
    elements.append(Spacer(1, 20))

    # Firmas al final
    firmantes_data = []
    
    # Profesores (Todos)
    if profesores_qs.exists():
        for p in profesores_qs:
            p_nom = p.nombre
            p_dni = p.dni or "_______________________"
            firmantes_data.append([
                f"Profesor/a: {p_nom}",
                "",
                f"DNI: {p_dni}"
            ])
    else:
        # Placeholder si no hay nadie
        firmantes_data.append([
            "Profesor/a: _______________________",
            "",
            "DNI: _______________________"
        ])
    
    # Bedel
    b_nom = bedel_docente.nombre if bedel_docente else "_______________________"
    b_dni = bedel_docente.dni if bedel_docente else "_______________________"
    firmantes_data.append([
        f"Bedel: {b_nom}",
        "",
        f"DNI: {b_dni}"
    ])
    
    # Convertir a párrafos sin líneas punteadas
    firma_style = ParagraphStyle("Firma", parent=styles["Normal"], fontSize=8)
    firmas_table_rows = []
    for f_row in firmantes_data:
        firmas_table_rows.append([
            Paragraph(f"<b>{escape(f_row[0])}</b>", firma_style),
            Paragraph(f"<b>{escape(f_row[2])}</b>", firma_style),
        ])

    firmas_table = Table(firmas_table_rows, colWidths=[350, 150])
    firmas_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(firmas_table)
    elements.append(Spacer(1, 25))

    # Referencias como TABLA con colores
    referencias = planilla.plantilla.referencias or []
    if referencias:
        elements.append(Paragraph('REFERENCIAS DE CASILLERO "SITUACIÓN ACADÉMICA"', doc_center_style))
        ref_header = [Paragraph("<b>VALOR</b>", header_style), Paragraph("<b>DESCRIPCIÓN</b>", header_style)]
        ref_data = [ref_header]
        
        for ref in referencias:
            cod = ref.get("codigo") or ref.get("label") or "-"
            desc = ref.get("descripcion") or ""
            c_label = Paragraph(f"<b>{escape(str(cod))}</b>", header_style)
            c_desc = Paragraph(escape(str(desc)), body_left_style)
            ref_data.append([c_label, c_desc])
            
        ref_table = Table(ref_data, colWidths=[80, 460])
        ref_style = TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), color_header),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])
        
        # Aplicar colores a las filas de la tabla de referencia
        for idx, ref in enumerate(referencias, start=1):
            color = get_situacion_color(ref.get("codigo"))
            if color:
                ref_style.add('BACKGROUND', (0, idx), (0, idx), color)
                
        ref_table.setStyle(ref_style)
        elements.append(ref_table)

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()


def obtener_regularidad_metadata(user: User, include_all: bool = False) -> dict:
    """Devuelve los metadatos necesarios para armar planillas manuales:
    profesorados accesibles, plantillas disponibles y columnas/situaciones.
    Si include_all es True y el usuario tiene permisos de autoridad, devuelve todos los profesorados.
    """
    return _regularidad_metadata_for_user(user, include_all=include_all)


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
    # Intentamos verificar acceso estricto al profesorado
    try:
        ensure_profesorado_access(user, profesorado_id, role_filter={"bedel", "secretaria"})
    except Exception:
        # Si falla el acceso estricto, permitimos si el usuario es Bedel/Coordinador en CUALQUIER profesorado
        # Esto habilita la "Carga Cruzada" para comisiones o históricos.
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if not es_autoridad and not user.is_superuser:
            raise ValueError("No tiene permisos para cargar planillas en este profesorado.")

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
        # Fallback a anual del mismo formato
        formato_obj = materia.formato
        if isinstance(formato_obj, str): # Ensure formato_obj is an object, not just a slug
            formato_obj = FormatoMateria.objects.filter(slug=formato_obj).first()
        if formato_obj:
            plantilla = RegularidadPlantilla.objects.filter(formato=formato_obj, dictado="ANUAL").first()
            if plantilla:
                # If a fallback plantilla is found, use it and update plantilla_id
                plantilla_id = plantilla.id
            else:
                raise ValueError("La plantilla indicada no existe y no se encontró una plantilla ANUAL de fallback.") from None
        else:
            raise ValueError("La plantilla indicada no existe y no se pudo resolver el formato de la materia.") from None

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
                raise ValueError(f"El número de orden {orden} está duplicado.")
            ordenes_usados.add(orden)

            dni = _normalize_value(fila_data.get("dni"))

            # --- Lógica de DNI Provisorio ---
            if not dni and fila_data.get("apellido_nombre"):
                # Generar DNI provisorio: HIS-{prof_id}-{seq}
                prefix = f"HIS-{profesorado.id:02d}-"
                # Contar cuantos HIS-{prof_id}- existen para calcular el próximo
                # Buscamos en Estudiante directamente. Es una operación algo costosa pero aceptable para first-load.
                count = Estudiante.objects.filter(dni__startswith=prefix).count()
                seq = count + 1
                new_dni = f"{prefix}{seq:04d}"
                
                # Verificar colisión simple (por si acaso borraron uno intermedio o concurrencia simple)
                while Estudiante.objects.filter(dni=new_dni).exists():
                    seq += 1
                    new_dni = f"{prefix}{seq:04d}"
                
                dni = new_dni
                warnings.append(f"[Fila {orden}] Se asignó DNI provisorio {dni} al estudiante sin identificación.")
                # Asignamos el DNI generado al fila_data para que se guarde en la planilla
                # Nota: fila_data es un dict del esquema, no el objeto fila DB aún
            # --------------------------------

            if dni:
                if dni in dnis_usados:
                    raise ValueError(f"El DNI {dni} aparece más de una vez en la planilla.")
                dnis_usados.add(dni)
            estudiante = Estudiante.objects.filter(dni=dni).first() if dni else None

            # --- Lazy Student Creation (Similar a Actas) ---
            if not estudiante and dni:
                apellido_nombre = _normalize_value(fila_data.get("apellido_nombre"))
                if apellido_nombre:
                    if "," in apellido_nombre:
                        parts = apellido_nombre.split(",", 1)
                        last_name = parts[0].strip()
                        first_name = parts[1].strip()
                    else:
                        last_name = apellido_nombre
                        first_name = "-"
                    
                    # Buscar o crear usuario
                    user_obj = User.objects.filter(username=dni).first()
                    if not user_obj:
                        user_obj = User.objects.create_user(
                            username=dni,
                            password=dni,
                            first_name=first_name,
                            last_name=last_name
                        )
                    
                    # Crear Estudiante
                    estudiante = Estudiante.objects.create(
                        user=user_obj,
                        dni=dni,
                        estado_legajo=Estudiante.EstadoLegajo.PENDIENTE
                    )
                    
                    try:
                        estudiante.asignar_profesorado(profesorado)
                    except Exception:
                        pass
                    
                    warnings.append(f"[Fila {orden}] Se creó el estudiante {dni} automáticamente.")

            # Asegurar vinculación al profesorado (útil en "Cargas Cruzadas")
            if estudiante:
                try:
                    estudiante.asignar_profesorado(profesorado)
                except Exception:
                    pass
            # -----------------------------------------------
            # -----------------------------------------------

            situacion = _resolve_situacion(fila_data.get("situacion", ""), formato_para_situaciones)
            nota_final_raw = fila_data.get("nota_final")
            nota_final_decimal = None
            if nota_final_raw not in (None, "", [], "---"):
                try:
                    nota_final_decimal = Decimal(str(nota_final_raw)).quantize(Decimal("0.1"))
                except (InvalidOperation, ValueError) as e:
                    raise ValueError(
                        f"La nota final de la fila {orden} debe ser un número válido o '---'."
                    ) from e
            nota_final_entera = None
            if nota_final_decimal is not None:
                nota_final_entera = int(nota_final_decimal.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

            asistencia_raw = str(fila_data.get("asistencia") or "").strip()
            if asistencia_raw in (None, "", [], "---"):
                asistencia = None
            else:
                try:
                    # Soportar decimales y redondear hacia arriba según pedido del usuario
                    asistencia = int(math.ceil(float(asistencia_raw.replace(",", "."))))
                except (ValueError, TypeError):
                    raise ValueError(f"La asistencia de la fila {orden} debe ser un número válido o '---'.")
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
                raise ValueError(f"La nota final debe ser >= 8 para registrar una promoción en la fila {orden}.")

            if not estudiante:
                warnings.append(
                    f"[Fila {orden}] Estudiante con DNI {dni} no encontrado y no tiene formato 'Apellido, Nombre' para creación automática. "
                    "Se omitió el registro de regularidad."
                )
                continue

            # if materia.nombre.upper().startswith("EDI") and situacion in {
            #     Regularidad.Situacion.APROBADO,
            #     Regularidad.Situacion.PROMOCIONADO,
            #     Regularidad.Situacion.REGULAR,
            # }:
            #     try:
            #         checklist = PreinscripcionChecklist.objects.get(preinscripcion__estudiante=estudiante)
            #         if not checklist.curso_introductorio_aprobado:
            #             raise ValueError(
            #                 f"El estudiante {estudiante.dni} no tiene el curso introductorio aprobado. "
            #                 f"No se puede registrar la situación '{situacion}' para una materia EDI."
            #             )
            #     except PreinscripcionChecklist.DoesNotExist:
            #         raise ValueError(
            #             f"El estudiante {estudiante.dni} no posee checklist de preinscripción. "
            #             f"No se puede registrar la situación '{situacion}' para una materia EDI."
            #         ) from None

            # Validación: Evitar duplicados de aprobados
            if situacion in {Regularidad.Situacion.PROMOCIONADO, Regularidad.Situacion.APROBADO}:
                if estudiante_tiene_materia_aprobada(estudiante, materia):
                    warnings.append(
                        f"[Fila {orden}] El estudiante {estudiante.dni} ya tiene aprobada la materia {materia.nombre}. "
                        "Se omitió el registro de la promoción/aprobación."
                    )
                    continue

            nota_tp_decimal = _extraer_nota_practicos(columnas, datos_extra)

            inscripcion = (
                InscripcionMateriaEstudiante.objects.filter(estudiante=estudiante, materia=materia, anio=anio_academico)
                .order_by("-anio")
                .first()
            )
            if inscripcion is None:
                inscripcion = (
                    InscripcionMateriaEstudiante.objects.filter(estudiante=estudiante, materia=materia)
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


def obtener_planilla_regularidad_detalle(planilla_id: int) -> dict:
    try:
        planilla = PlanillaRegularidad.objects.select_related(
            "profesorado", "materia", "plantilla", "formato"
        ).get(pk=planilla_id)
    except PlanillaRegularidad.DoesNotExist:
        raise ValueError("La planilla no existe.")

    docentes = []
    for d in planilla.docentes.all().order_by("orden", "id"):
        docentes.append({
            "docente_id": d.docente_id,
            "nombre": d.nombre,
            "dni": d.dni,
            "rol": d.rol,
            "orden": d.orden,
        })
        
    filas = []
    for f in planilla.filas.all().order_by("orden", "id"):
        filas.append({
            "orden": f.orden,
            "dni": f.dni,
            "apellido_nombre": f.apellido_nombre,
            "nota_final": float(f.nota_final) if f.nota_final else None,
            "asistencia": f.asistencia_porcentaje,
            "situacion": f.situacion,
            "excepcion": f.excepcion,
            "datos": f.datos,
        })
        
    return {
        "id": planilla.id,
        "codigo": planilla.codigo,
        "anio_academico": planilla.anio_academico,
        "profesorado_id": planilla.profesorado_id,
        "profesorado_nombre": planilla.profesorado.nombre,
        "materia_id": planilla.materia_id,
        "materia_nombre": planilla.materia.nombre,
        "plantilla_id": planilla.plantilla_id,
        "dictado": planilla.dictado,
        "fecha": planilla.fecha.isoformat(),
        "folio": planilla.folio,
        "plan_resolucion": planilla.plan_resolucion,
        "observaciones": planilla.observaciones,
        "datos_adicionales": planilla.datos_adicionales,
        "docentes": docentes,
        "filas": filas,
        "estado": planilla.estado,
        "pdf_url": planilla.pdf.url if planilla.pdf else None,
    }


def actualizar_planilla_regularidad(
    planilla_id: int,
    user: User,
    profesorado_id: int | None = None,
    materia_id: int | None = None,
    plantilla_id: int | None = None,
    dictado: str | None = None,
    fecha: date | None = None,
    folio: str | None = None,
    plan_resolucion: str | None = None,
    observaciones: str | None = None,
    datos_adicionales: dict | None = None,
    docentes: list[dict] | None = None,
    filas: list[dict] | None = None,
    estado: str | None = None,
    dry_run: bool = False,
) -> dict:
    try:
        planilla = PlanillaRegularidad.objects.get(pk=planilla_id)
    except PlanillaRegularidad.DoesNotExist:
        raise ValueError("La planilla no existe.")

    # Intentamos verificar acceso estricto al profesorado
    try:
        ensure_profesorado_access(user, planilla.profesorado_id, role_filter={"bedel", "secretaria"})
    except Exception:
        # Permitir edición cruzada si es autoridad en otro lado
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if not es_autoridad and not user.is_superuser:
            raise ValueError("No tiene permisos para editar planillas de este profesorado.")

    if profesorado_id:
        planilla.profesorado_id = profesorado_id
    if materia_id:
        planilla.materia_id = materia_id
    if plantilla_id:
        planilla.plantilla_id = plantilla_id
        p = RegularidadPlantilla.objects.filter(pk=plantilla_id).first()
        if p:
            planilla.formato = p.formato
    if dictado:
        planilla.dictado = dictado
    if fecha:
        planilla.fecha = fecha
        planilla.anio_academico = fecha.year
    if folio is not None:
        planilla.folio = folio
    if plan_resolucion is not None:
        planilla.plan_resolucion = plan_resolucion
    if observaciones is not None:
        planilla.observaciones = observaciones
    if estado:
        planilla.estado = estado
    if datos_adicionales is not None:
        planilla.datos_adicionales = datos_adicionales

    atomic_ctx = transaction.atomic if not dry_run else _atomic_rollback
    warnings = []
    regularidades_registradas = 0

    with atomic_ctx():
        planilla.save()
        # Refrescar para asegurar relaciones actualizadas (materia, profesorado)
        planilla.refresh_from_db()

        if docentes is not None:
            planilla.docentes.all().delete()
            for idx, d_data in enumerate(docentes, start=1):
                nombre = d_data.get("nombre", "").strip()
                if not nombre: continue
                dni = _normalize_value(d_data.get("dni"))
                docente_id = d_data.get("docente_id")
                d_obj = Docente.objects.filter(pk=docente_id).first() if docente_id else (Docente.objects.filter(dni=dni).first() if dni else None)
                
                PlanillaRegularidadDocente.objects.create(
                    planilla=planilla, docente=d_obj, nombre=nombre, dni=dni,
                    rol=d_data.get("rol") or "profesor", orden=d_data.get("orden") or idx
                )

        if filas is not None:
            planilla.filas.all().delete()
            columnas = planilla.plantilla.columnas or []
            # Usar la materia ya actualizada
            materia_actual = planilla.materia

            for idx, f_data in enumerate(filas, start=1):
                orden = f_data.get("orden") or idx
                dni = _normalize_value(f_data.get("dni"))
                estudiante = Estudiante.objects.filter(dni=dni).first() if dni else None
                
                situacion = _resolve_situacion(f_data.get("situacion", ""), planilla.materia.formato)
                nota_raw = f_data.get("nota_final")
                nota_dec = None
                if nota_raw not in (None, "", "---"):
                    nota_dec = Decimal(str(nota_raw)).quantize(Decimal("0.1"))
                
                asist_raw = str(f_data.get("asistencia") or "").strip()
                asist = None
                if asist_raw not in ("", "---"):
                    try:
                        asist = int(math.ceil(float(asist_raw.replace(",", "."))))
                    except: pass
                
                PlanillaRegularidadFila.objects.create(
                    planilla=planilla, orden=orden, estudiante=estudiante, dni=dni or "",
                    apellido_nombre=_normalize_value(f_data.get("apellido_nombre") or ""),
                    nota_final=nota_dec, asistencia_porcentaje=asist,
                    situacion=situacion, excepcion=bool(f_data.get("excepcion")),
                    datos=_limpiar_datos_fila(f_data.get("datos"), columnas)
                )
                
                # Actualizar también tabla Regularidad si existe estudiante y materia
                if estudiante:
                    Regularidad.objects.update_or_create(
                        estudiante=estudiante, materia=materia_actual,
                        fecha_cierre=planilla.fecha,
                        defaults={
                            "nota_final_cursada": int(nota_dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP)) if nota_dec else None,
                            "asistencia_porcentaje": asist,
                            "situacion": situacion,
                            "excepcion": bool(f_data.get("excepcion")),
                        }
                    )
                    regularidades_registradas += 1

        if not dry_run:
            pdf_bytes = _render_planilla_regularidad_pdf(planilla)
            filename = f"{planilla.codigo}.pdf"
            planilla.pdf.save(filename, ContentFile(pdf_bytes), save=True)

    return obtener_planilla_regularidad_detalle(planilla.id)


REQUIRED_COLUMNS_ESTUDIANTES = {
    "DNI",
    "apellido",
    "nombre",
    "email",
    "password_plane",
    "must_change_password",
    "is_active",
    "fecha_nacimiento",
    "teléfono",
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
    raise CommandError(f"No se encontró el profesorado '{nombre}'. Disponibles: {disponibles}")


def _import_estudiante_record(
    record: dict[str, Any],
    *,
    profesorado: Profesorado,
    estudiante_group: Group,
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

    telefono = (record.get("telefono") or record.get("teléfono") or "").strip()
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

    if estudiante_group not in user.groups.all():
        user.groups.add(estudiante_group)

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

    estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
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
                    raise ValueError("No se especificó la carrera.")

                profesorado = carreras_cache.get(carrera_nombre)
                if profesorado is None:
                    profesorado = _get_profesorado_from_cache(carreras_cache, carrera_nombre)

                record = dict(normalized_row)
                record["dni"] = dni
                _import_estudiante_record(
                    record,
                    profesorado=profesorado,
                    estudiante_group=estudiante_group,
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
    estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
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
            estudiante_group=estudiante_group,
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
    "Año Cursada",
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
                anio_cursada_str = normalized_row.get("Año Cursada", "").strip()
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
                    raise ValueError(f"Plan de Estudio con resolución '{plan_resolucion}' no encontrado.")

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
