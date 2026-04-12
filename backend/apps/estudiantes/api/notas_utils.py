"""
Utilidades para la gestión de calificaciones y situaciones académicas.
Este módulo centraliza la lógica de validación de regularidades, formatos de materia
(Talleres, Seminarios, etc.) y el sistema de bloqueos de planillas post-cierre.
"""

from datetime import date
from django.db.models import Q
from core.models import Docente, Regularidad, RegularidadPlanillaLock, Comision, Materia

# Formatos que se comportan bajo la lógica de Taller (Asistencia estricta)
FORMATOS_TALLER = {"TAL", "PRA", "SEM", "LAB"}
_VIRTUAL_COMISION_FACTOR = 10000

# Diccionario maestro de situaciones permitidas por formato de cursada
_SITUACIONES = {
    "ASI": [
        {"alias": "REGULAR", "codigo": Regularidad.Situacion.REGULAR, "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10)."},
        {"alias": "DESAPROBADO_TP", "codigo": Regularidad.Situacion.DESAPROBADO_TP, "descripcion": "Desaprueba TP y sus recuperatorios."},
        {"alias": "DESAPROBADO_PA", "codigo": Regularidad.Situacion.DESAPROBADO_PA, "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios."},
        {"alias": "LIBRE-I", "codigo": Regularidad.Situacion.LIBRE_I, "descripcion": "Libre por inasistencias (menos del 65% de la cursada)."},
        {"alias": "LIBRE-AT", "codigo": Regularidad.Situacion.LIBRE_AT, "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada)."},
    ],
    "MOD": [
        {"alias": "PROMOCION", "codigo": Regularidad.Situacion.PROMOCIONADO, "descripcion": "Cumple con asistencia (80%), aprueba TP y parcial (nota final ≥ 8)."},
        {"alias": "REGULAR", "codigo": Regularidad.Situacion.REGULAR, "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10)."},
        {"alias": "DESAPROBADO_TP", "codigo": Regularidad.Situacion.DESAPROBADO_TP, "descripcion": "Desaprueba TP y sus recuperatorios."},
        {"alias": "DESAPROBADO_PA", "codigo": Regularidad.Situacion.DESAPROBADO_PA, "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios."},
        {"alias": "LIBRE-I", "codigo": Regularidad.Situacion.LIBRE_I, "descripcion": "Libre por inasistencias (menos del 65% de la cursada)."},
        {"alias": "LIBRE-AT", "codigo": Regularidad.Situacion.LIBRE_AT, "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada)."},
    ],
    "TAL": [
        {"alias": "APROBADO", "codigo": Regularidad.Situacion.APROBADO, "descripcion": "Cumple con el régimen de asistencia (80%, o 65% con excepción) y con las evaluaciones."},
        {"alias": "DESAPROBADO_TP", "codigo": Regularidad.Situacion.DESAPROBADO_TP, "descripcion": "Desaprueba TP y sus recuperatorios."},
        {"alias": "LIBRE-I", "codigo": Regularidad.Situacion.LIBRE_I, "descripcion": "Libre por inasistencias (menos del 80%, o menos del 65% con excepción)."},
        {"alias": "LIBRE-AT", "codigo": Regularidad.Situacion.LIBRE_AT, "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada)."},
    ],
}

ALIAS_TO_SITUACION = {item["alias"]: item["codigo"] for items in _SITUACIONES.values() for item in items}
ALIAS_TO_SITUACION["BAJA"] = Regularidad.Situacion.BAJA
SITUACION_TO_ALIAS = {v: k for k, v in ALIAS_TO_SITUACION.items()}

def normalized_user_roles(user) -> set[str]:
    """Retorna los roles del usuario (grupos) normalizados a minúsculas y sin espacios."""
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    roles = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        roles.add("admin")
    return roles

def docente_from_user(user) -> Docente | None:
    """Intenta identificar al objeto Docente asociado a un usuario de Django."""
    if not user or not getattr(user, "is_authenticated", False):
        return None
    lookup = Q()
    username = (getattr(user, "username", "") or "").strip()
    if username: lookup |= Q(persona__dni__iexact=username)
    email = (getattr(user, "email", "") or "").strip()
    if email: lookup |= Q(persona__email__iexact=email)
    if not lookup: return None
    return Docente.objects.filter(lookup).first()

def user_has_privileged_planilla_access(user) -> bool:
    """Verifica si el usuario tiene permisos de gestión (Admin, Bedelía, Secretaría)."""
    if not user or not getattr(user, "is_authenticated", False): return False
    if user.is_superuser or user.is_staff: return True
    group_names = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    return bool(group_names.intersection({"admin", "secretaria", "bedel"}))

def regularidad_lock_for_scope(comision: Comision | None = None, materia: Materia | None = None, anio_virtual: int | None = None):
    """Retorna el bloqueo (Lock) de planilla para una comisión específica o ámbito virtual."""
    qs = RegularidadPlanillaLock.objects.select_related("cerrado_por")
    if comision:
        return qs.filter(comision=comision).first()
    if materia is not None and anio_virtual is not None:
        return qs.filter(comision__isnull=True, materia=materia, anio_virtual=anio_virtual).first()
    return None

def virtual_comision_id(materia_id: int, anio: int | None) -> int:
    """Genera un ID ficticio (negativo) para representar comisiones virtuales de EDI o Libres."""
    base = materia_id * _VIRTUAL_COMISION_FACTOR + (anio or 0)
    return -base

def split_virtual_comision_id(raw_id: int) -> tuple[int, int | None]:
    """Descompone un ID de comisión virtual en Materia ID y Año."""
    absolute = abs(raw_id)
    materia_id = absolute // _VIRTUAL_COMISION_FACTOR
    anio = absolute % _VIRTUAL_COMISION_FACTOR
    return materia_id, anio or None

def situaciones_para_formato(formato: str) -> list[dict]:
    """Retorna las situaciones académicas válidas para el formato de materia dado."""
    if not formato: return _SITUACIONES["ASI"]
    formato_key = formato.upper()
    if formato_key in _SITUACIONES: return _SITUACIONES[formato_key]
    if formato_key in FORMATOS_TALLER: return _SITUACIONES["TAL"]
    return _SITUACIONES["ASI"]

def alias_desde_situacion(codigo: str | None) -> str | None:
    """Traduce un código de situación (base de datos) a su alias legible (UI)."""
    return SITUACION_TO_ALIAS.get(codigo) if codigo else None

def docente_to_string(docente: Docente | None) -> str | None:
    """Retorna la representación 'Apellido, Nombre' de un docente."""
    if not docente: return None
    apellido, nombre = (docente.apellido or "").strip(), (docente.nombre or "").strip()
    if apellido and nombre: return f"{apellido}, {nombre}"
    return apellido or nombre or None

def format_user_display(user) -> str | None:
    """Retorna el nombre completo del usuario o su username si no está disponible."""
    if not user or not getattr(user, "is_authenticated", False):
        return None
    full_name = (user.get_full_name() or "").strip()
    if full_name:
        return full_name
    username = getattr(user, "username", None)
    if username:
        return username
    return None
