import re
from datetime import date

_re_dni = re.compile(r"^\d{6,9}$")
_re_cuil = re.compile(r"^\d{11}$")

def validar_dni(dni: str) -> bool:
    return bool(_re_dni.match(dni or ""))

def validar_cuil(cuil: str) -> bool:
    return bool(_re_cuil.match(cuil or ""))

def validar_fecha_nacimiento(d: date) -> bool:
    try:
        return d <= date.today()
    except Exception:
        return False