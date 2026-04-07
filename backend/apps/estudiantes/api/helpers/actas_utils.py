"""Helpers para formateo y clasificación de notas de actas."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from core.models import ActaExamenEstudiante


def _format_nota(value: Decimal | float | int | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    try:
        return f"{float(value):.1f}".rstrip("0").rstrip(".")
    except (ValueError, TypeError):
        return str(value)


def _format_acta_calificacion(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip().upper()
    if text in {"APR", "APROBADO"}:
        return "APR"
    if text in {"DES", "DESAPROBADO"}:
        return "DES"
    if text in {"AUS", "AUSENTE"}:
        return "AUS"
    return text


def _acta_condicion(calificacion: str | None) -> tuple[str, str]:
    if not calificacion:
        return ("SIN", "Sin resultado")
    normalized = calificacion.strip().upper()
    if normalized == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
        return ("AUS", "Ausente (justificado)")
    if normalized == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
        return ("AUS", "Ausente")
    try:
        valor = Decimal(normalized.replace(",", "."))
    except InvalidOperation:
        return ("DES", "Desaprobado")
    return ("APR", "Aprobado") if valor >= 6 else ("DES", "Desaprobado")
