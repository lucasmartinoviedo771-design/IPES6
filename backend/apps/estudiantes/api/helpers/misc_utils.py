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


def _add_years(base: date | None, years: int) -> date | None:
    if not base:
        return None
    try:
        return base.replace(year=base.year + years)
    except ValueError:
        return base.replace(month=2, day=28, year=base.year + years)


def _calcular_vigencia_regularidad(estudiante: Estudiante, regularidad: Regularidad) -> tuple[date, int]:
    from datetime import timedelta
    from core.models import MesaExamen, ActaExamenEstudiante

    # 1. Base: 2 años desde el cierre de cursada
    if not regularidad.fecha_cierre:
        # Si no hay fecha de cierre, asumimos que no hay vigencia calculable (o es infinita?)
        # Retornamos la fecha actual + 2 años como fallback seguro para evitar crash
        from django.utils import timezone
        limite = timezone.now().date() + timedelta(days=365 * 2)
        return limite, 0

    fecha_base = _add_years(regularidad.fecha_cierre, 2)
    
    # 2. Límite máximo: 60 días después de la base
    limite_60d = fecha_base + timedelta(days=60)
    
    # 3. Primer llamado posterior a la fecha base (2 años)
    primer_llamado_post_base = (
        MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
            fecha__gt=fecha_base
        )
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    
    # El límite es lo que ocurra primero entre los 60 días o el siguiente llamado tras los 2 años
    if primer_llamado_post_base and primer_llamado_post_base < limite_60d:
        limite = primer_llamado_post_base
    else:
        limite = limite_60d
        
    # Intentos: inscripciones a examen realizadas DESDE el cierre de cursada hasta el límite calculado
    intentos = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=regularidad.materia,
        acta__fecha__gt=regularidad.fecha_cierre,
        acta__fecha__lte=limite,
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
