from __future__ import annotations
import re
import unicodedata
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Max, Q, Prefetch
from django.core.management.base import CommandError
from django.core.cache import cache
from django.contrib.auth.models import User as DjangoUser

from apps.estudiantes.api.notas_utils import ALIAS_TO_SITUACION, situaciones_para_formato as _situaciones_para_formato
from core.models import (
    Estudiante,
    PlanillaRegularidad,
    Profesorado,
    Regularidad,
    Materia,
    PlanDeEstudio,
    RegularidadPlantilla,
    Docente,
)
from core.permissions import allowed_profesorados

FORMATO_SLUG_MAP = {
    "ASI": "asignatura",
    "MOD": "modulo",
    "TAL": "taller",
    "PRA": "taller",
    "LAB": "taller",
    "SEM": "taller",
}

def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    val = value.strip().lower()
    return val in {"true", "1", "si", "sí", "yes", "verdadero"}

def _parse_date(value: str) -> date | None:
    if not value:
        return None
    value = str(value).strip()
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
    cleaned = str(value).replace("\ufeff", "")
    if cleaned.startswith("ï»¿"):
        cleaned = cleaned[3:]
    return cleaned.strip()

def _normalize_label(value: str) -> str:
    return "".join((str(value) or "").split()).lower()

def _normalize_value(value: str | None) -> str:
    if value is None:
        return ""
    cleaned = str(value).replace("\ufeff", "").strip()
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
    return (str(value) or "").strip().upper()

def _format_column_label(value: str | None) -> str:
    if not value:
        return ""
    normalized = str(value).replace("º", "°")
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
    allowed_codes = {item["codigo"] for item in _situaciones_para_formato(formato_slug)}
    if alias_key in ALIAS_TO_SITUACION:
        candidate = ALIAS_TO_SITUACION[alias_key]
        if _normalize_alias(candidate) in allowed_codes:
             return candidate
    if alias_key in allowed_codes:
        return alias_key
    if alias_key in ALIAS_TO_SITUACION:
         mapped = ALIAS_TO_SITUACION[alias_key]
         if mapped in allowed_codes:
             return mapped
    for code in Regularidad.Situacion.values:
        if alias_key == _normalize_alias(code) and code in allowed_codes:
            return code
    raise ValueError(f"Situacion academica '{raw}' no es valida para el formato seleccionado ({formato_slug}).")

def _decimal_from_string(value: str | None) -> Decimal | None:
    if value in (None, "", []):
        return None
    try:
        return Decimal(str(value).replace(",", ".")).quantize(Decimal("0.1"))
    except (InvalidOperation, ValueError):
        return None

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

def obtener_docentes_metadata():
    docente_qs = (
        Docente.objects.select_related("persona")
        .exclude(
            Q(persona__dni__startswith="DOC-HIS-") |
            Q(persona__apellido__icontains="CARGA HISTÓRICA") |
            Q(persona__apellido__icontains="SISTEMA")
        )
        .order_by("persona__apellido", "persona__nombre")
    )
    return [
        {"id": d.id, "nombre": f"{d.apellido}, {d.nombre}".strip(", "), "dni": d.dni}
        for d in docente_qs
    ]

def obtener_estudiantes_metadata():
    estudiantes_qs = (
        Estudiante.objects.all()
        .select_related("persona", "user")
        .prefetch_related("carreras")
        .order_by("persona__apellido", "persona__nombre")
    )
    return [
        {
            "id": e.id,
            "apellido_nombre": f"{e.apellido}, {e.nombre}".strip(", "),
            "nombre": f"{e.apellido}, {e.nombre}".strip(", "),
            "dni": e.dni,
            "profesorados": [c.id for c in e.carreras.all()]
        }
        for e in estudiantes_qs
    ]

def obtener_regularidad_metadata(user: DjangoUser, include_all: bool = False) -> dict:
    allowed = allowed_profesorados(user, role_filter={"bedel", "secretaria"})
    cache_key = f"reg_metadata_u{user.id}_a{include_all}"
    if allowed is not None:
        allowed_str = "-".join(map(str, sorted(list(allowed))))
        cache_key += f"_p{allowed_str}"
    
    cached_data = cache.get(cache_key)
    if cached_data:
        return cached_data

    if include_all:
        es_autoridad = user.asignaciones_profesorado.filter(rol__in=["bedel", "coordinador", "secretaria"]).exists()
        if es_autoridad or user.is_superuser:
            allowed = None
            
    profes_qs = Profesorado.objects.filter(activo=True).order_by("nombre")
    if allowed is not None:
        if not allowed:
            return {"profesorados": [], "plantillas": [], "docentes": [], "estudiantes": []}
        profes_qs = profes_qs.filter(id__in=allowed)

    materias_prefetch = Materia.objects.all().only(
        "id", "plan_de_estudio_id", "nombre", "anio_cursada", "formato", "regimen"
    ).order_by("anio_cursada", "nombre")
    
    planes_prefetch = PlanDeEstudio.objects.all().only(
        "id", "profesorado_id", "resolucion", "anio_inicio", "anio_fin", "vigente"
    ).prefetch_related(
        Prefetch("materias", queryset=materias_prefetch)
    ).order_by("anio_inicio")
    
    profes_qs = profes_qs.prefetch_related(Prefetch("planes", queryset=planes_prefetch))

    profes_data = []
    REGIMEN_MAP = {"ANU": "ANUAL", "PCU": "1C", "SCU": "2C"}
    for profesorado in profes_qs:
        planes_data = []
        for plan in profesorado.planes.all():
            materias_data = [
                {
                    "id": m.id, "nombre": m.nombre, "anio_cursada": m.anio_cursada,
                    "formato": m.formato, "dictado": REGIMEN_MAP.get(m.regimen, "ANUAL"),
                    "regimen": m.regimen, "plan_id": plan.id, "plan_resolucion": plan.resolucion,
                }
                for m in plan.materias.all()
            ]
            planes_data.append(
                {"id": plan.id, "resolucion": plan.resolucion, "anio_inicio": plan.anio_inicio, "anio_fin": plan.anio_fin, "vigente": plan.vigente, "materias": materias_data}
            )
        profes_data.append({"id": profesorado.id, "nombre": profesorado.nombre, "acronimo": _profesorado_acronym(profesorado), "planes": planes_data})

    plantillas = []
    plantillas_qs = RegularidadPlantilla.objects.select_related("formato").order_by("formato__nombre", "dictado")
    for plantilla in plantillas_qs:
        cols = [
            {"key": c.get("key"), "label": _format_column_label(c.get("label") or c.get("key") or ""), "group": c.get("group")}
            for c in plantilla.columnas or []
        ]
        plantillas.append({
            "id": plantilla.id, "nombre": plantilla.nombre, "dictado": plantilla.dictado, "descripcion": plantilla.descripcion,
            "columnas": cols, "situaciones": plantilla.situaciones, "referencias": plantilla.referencias,
            "formato": {"slug": plantilla.formato.slug, "nombre": plantilla.formato.nombre, "metadata": plantilla.formato.metadata}
        })

    result = {
        "profesorados": profes_data, "plantillas": plantillas,
        "docentes": obtener_docentes_metadata(), "estudiantes": obtener_estudiantes_metadata(),
    }
    cache.set(cache_key, result, timeout=3600)
    return result

def _get_profesorado_from_cache(cache: dict, nombre: str) -> Profesorado:
    target = _normalize_label(nombre)
    for p in Profesorado.objects.all():
        if _normalize_label(p.nombre) == target:
            cache[nombre] = p
            return p
    raise CommandError(f"No se encontró el profesorado '{nombre}'.")
