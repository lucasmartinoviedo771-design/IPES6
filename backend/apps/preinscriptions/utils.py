# apps/preinscriptions/utils.py
from datetime import datetime


def make_codigo(
    pre: object | None = None,
    pre_id: int | None = None,
    alumno_dni: str | None = None,
    carrera_id: int | str | None = None,
    created_at: datetime | None = None,
) -> str:
    """Genera un código legible y estable para la preinscripción.

    Prioridad:
      1) si viene un objeto pre con .id -> PRE-000123
      2) si viene pre_id -> PRE-000123
      3) si vienen (dni, carrera_id, [created_at]) -> PRE-YYYY-CARRERA-DNI
      4) fallback timestamp -> PRE-YYYYMMDDhhmmss
    """
    # 1) Objeto con id
    if pre is not None and hasattr(pre, "id") and pre.id:
        try:
            return f"PRE-{int(pre.id):06d}"
        except Exception:
            pass

    # 2) id directo
    if pre_id is not None:
        try:
            return f"PRE-{int(pre_id):06d}"
        except Exception:
            pass

    # 3) Semántico
    if alumno_dni and carrera_id:
        year = created_at.year if isinstance(created_at, datetime) else datetime.now().year
        carrera_str = str(carrera_id)
        dni_str = "".join(ch for ch in str(alumno_dni) if ch.isdigit())[-8:] or "00000000"
        return f"PRE-{year}-{carrera_str}-{dni_str}"

    # 4) Fallback
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"PRE-{ts}"
