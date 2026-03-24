"""
Utilidades para el manejo y formateo de fechas.
Centraliza las reglas de representación de fechas (DD/MM/YYYY) para 
asegurar una experiencia de usuario consistente en reportes y formularios.
"""

from datetime import date, datetime


def format_date(d: date | datetime | str | None) -> str | None:
    """
    Formatea una fecha u objeto datetime al estándar regional 'DD/MM/YYYY'.
    Soporta la conversión desde cadenas ISO (YYYY-MM-DD).
    """
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%d/%m/%Y")
    if isinstance(d, str):
        # Intento de re-formateo si viene en formato ISO desde la BD
        if len(d) == 10 and "-" in d:
             try:
                 dt = datetime.strptime(d, "%Y-%m-%d")
                 return dt.strftime("%d/%m/%Y")
             except ValueError:
                 pass
        return d
    return str(d)


def format_datetime(dt: datetime | None) -> str | None:
    """
    Formatea un objeto datetime al estándar regional 'DD/MM/YYYY HH:MM'.
    Utilizado principalmente en registros de auditoría y logs.
    """
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y %H:%M")
    return str(dt)


def parse_date(value: str | None) -> date | None:
    """
    Intenta convertir una cadena de texto en un objeto date de Python.
    Soporta múltiples formatos comunes (%d/%m/%Y, %Y-%m-%d).
    """
    if not value:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(trimmed, fmt).date()
        except ValueError:
            continue
    return None
