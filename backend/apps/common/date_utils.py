from datetime import date, datetime
from typing import Any

def format_date(d: date | datetime | str | None) -> str | None:
    """Format a date or datetime object as DD/MM/YYYY."""
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d.strftime("%d/%m/%Y")
    if isinstance(d, str):
        # Already a string, return as is or try to reformat if it looks like ISO
        if len(d) == 10 and "-" in d:
             try:
                 dt = datetime.strptime(d, "%Y-%m-%d")
                 return dt.strftime("%d/%m/%Y")
             except ValueError:
                 pass
        return d
    return str(d)

def format_datetime(dt: datetime | None) -> str | None:
    """Format a datetime object as DD/MM/YYYY HH:MM."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.strftime("%d/%m/%Y %H:%M")
    return str(dt)

def parse_date(value: str | None) -> date | None:
    """Parse a date string in various formats."""
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
