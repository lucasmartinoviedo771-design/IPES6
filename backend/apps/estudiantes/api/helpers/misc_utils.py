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


def _calcular_vigencia_regularidad(estudiante: Estudiante, regularidad: Regularidad) -> tuple[date, int, int]:
    """
    Retorna (vigencia_limite, intentos_usados, intentos_max=3).

    Reglas:
    - El alumno tiene 3 intentos en total (incluida la prórroga).
    - Dentro de los 2 años puede usar esos 3 intentos libremente.
    - Si al cumplirse los 2 años le quedan intentos, tiene una prórroga (hasta 60 días
      o el siguiente llamado disponible) para usar los intentos restantes.
    - Si agota los 3 intentos antes de los 2 años: la regularidad cae sin prórroga.
    """
    from datetime import timedelta
    from core.models import MesaExamen, ActaExamenEstudiante

    INTENTOS_MAX = 3

    if not regularidad.fecha_cierre:
        from django.utils import timezone
        limite = _add_years(timezone.now().date(), 2)
        return limite, 0, INTENTOS_MAX

    fecha_base = _add_years(regularidad.fecha_cierre, 2)

    # Límite de la prórroga post-2-años
    limite_60d = fecha_base + timedelta(days=60)
    primer_llamado_post_base = (
        MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
            fecha__gt=fecha_base,
        )
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    limite_prorroga = (
        primer_llamado_post_base
        if primer_llamado_post_base and primer_llamado_post_base < limite_60d
        else limite_60d
    )

    # Total de intentos usados (período normal + prórroga, todo suma al mismo pool de 3)
    intentos = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=regularidad.materia,
        acta__fecha__gt=regularidad.fecha_cierre,
        acta__fecha__lte=limite_prorroga,
    ).count()

    # Si agotó los 3 intentos dentro del período normal: no accede a la prórroga
    intentos_en_periodo = ActaExamenEstudiante.objects.filter(
        dni=estudiante.dni,
        acta__materia=regularidad.materia,
        acta__fecha__gt=regularidad.fecha_cierre,
        acta__fecha__lte=fecha_base,
    ).count()
    if intentos_en_periodo >= INTENTOS_MAX:
        return fecha_base, intentos_en_periodo, INTENTOS_MAX

    return limite_prorroga, intentos, INTENTOS_MAX


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
