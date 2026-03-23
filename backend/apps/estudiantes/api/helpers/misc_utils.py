"""Helpers misceláneos: fechas, vigencia de regularidades, correlatividades, etc."""

from __future__ import annotations

from datetime import date, datetime

from apps.common.date_utils import format_date, format_datetime, parse_date

from core.models import (
    Correlatividad,
    CorrelatividadVersion,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Regularidad,
)


def _es_materia_edi(nombre: str) -> bool:
    valor = (nombre or "").strip().upper()
    return valor.startswith("EDI") or valor.startswith("ESPACIO DE DEFINICION INSTITUCIONAL")


def _metadata_str(data: dict[str, object]) -> dict[str, str]:
    return {key: str(value) for key, value in data.items() if value not in (None, "", [], {})}


def _add_years(base: date, years: int) -> date:
    try:
        return base.replace(year=base.year + years)
    except ValueError:
        return base.replace(month=2, day=28, year=base.year + years)


def _calcular_vigencia_regularidad(estudiante: Estudiante, regularidad: Regularidad) -> tuple[date, int]:
    limite_base = _add_years(regularidad.fecha_cierre, 2)
    siguiente_llamado = (
        MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
            fecha__gte=limite_base,
        )
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    limite = siguiente_llamado or limite_base
    intentos = InscripcionMesa.objects.filter(
        estudiante=estudiante,
        estado=InscripcionMesa.Estado.INSCRIPTO,
        mesa__materia=regularidad.materia,
        mesa__tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
        mesa__fecha__gte=regularidad.fecha_cierre,
        mesa__fecha__lte=limite,
    ).count()
    return limite, intentos


def _to_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return format_datetime(value)
    if isinstance(value, date):
        return format_date(value)
    return str(value)


def _parse_optional_date(value: str | None):
    return parse_date(value)


def _correlatividades_qs(
    materia: Materia,
    tipo: str,
    estudiante: Estudiante | None = None,
):
    qs = Correlatividad.objects.filter(materia_origen=materia, tipo=tipo)
    if not estudiante or not materia.plan_de_estudio_id:
        return qs
    profesorado_id = getattr(materia.plan_de_estudio, "profesorado_id", None)
    if not profesorado_id:
        return qs
    cohorte = estudiante.obtener_anio_ingreso(profesorado_id)
    version = CorrelatividadVersion.vigente_para(
        plan_id=materia.plan_de_estudio_id,
        profesorado_id=profesorado_id,
        cohorte=cohorte,
    )
    if version:
        return qs.filter(versiones__version=version)
    return qs
