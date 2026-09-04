"""
Utilidades de caching para analytics.

IMPORTANTE: el chequeo de permisos va SIEMPRE antes de mirar el cache. Ver
cache_endpoint().
"""

import hashlib
import json
from functools import wraps
from typing import Any, Callable

from django.core.cache import cache

from core.permissions import require


def get_cache_key(prefix: str, **kwargs) -> str:
    """
    Genera una cache key única basada en prefix + parámetros.

    Args:
        prefix: Identificador del endpoint (ej: "students_summary", "academic_performance")
        **kwargs: Parámetros que varían la respuesta (ej: anio=2026, profesorado_id=5)

    Returns:
        Clave de cache consistente y corta
    """
    params_str = json.dumps(kwargs, sort_keys=True, default=str)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
    return f"analytics:{prefix}:{params_hash}"


def cache_endpoint(timeout: int = 300, prefix: str | None = None, capability: str = "ver_metricas") -> Callable:
    """
    Decorador para cachear respuestas de endpoints analíticos.

    El permiso se verifica ANTES de consultar el cache, en cada request.

    El motivo no es teórico: este decorador envuelve la vista completa, así que
    un acierto de cache devuelve el valor guardado sin ejecutar el cuerpo de la
    función. Si el `require()` viviera solamente dentro del cuerpo, cualquier
    usuario autenticado recibiría métricas institucionales cacheadas por otro
    con permisos, sin control alguno. Por eso el chequeo se hace acá y no se
    delega en la vista.

    Args:
        timeout: Segundos a cachear (default: 5 minutos)
        prefix: Prefijo custom para la cache key (default: nombre de la función)
        capability: Permiso exigido en cada llamada, incluso con cache HIT.
            Pasar None solo si la vista es deliberadamente pública.

    Ejemplo:
        @cache_endpoint(timeout=600, prefix="students_summary")
        def students_summary(request, anio=None, profesorado_id=None):
            ...
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            if capability:
                request = kwargs.get("request") or (args[0] if args else None)
                user = getattr(request, "user", None)
                # Sin request identificable no se puede autorizar: se niega.
                require(user, capability)

            # Extraer parámetros relevantes (excluir 'request')
            cache_params = {k: v for k, v in kwargs.items() if k != "request"}

            key = get_cache_key(prefix or func.__name__, **cache_params)

            # Intentar traer del cache
            cached = cache.get(key)
            if cached is not None:
                return cached

            # Calcular la respuesta
            result = func(*args, **kwargs)

            # Guardar en cache
            cache.set(key, result, timeout)

            return result

        return wrapper

    return decorator


def invalidate_cache(prefix: str, **kwargs) -> None:
    """
    Invalida cache específico de un endpoint.

    Args:
        prefix: Prefijo del cache (ej: "students_summary")
        **kwargs: Parámetros para identificar la cache key

    Ejemplo:
        invalidate_cache("students_summary", profesorado_id=5)
    """
    key = get_cache_key(prefix, **kwargs)
    cache.delete(key)


def invalidate_cache_pattern(prefix: str) -> None:
    """
    Invalida TODOS los caches de un patrón (cuando no sabemos exactamente qué parâmetros).
    Util cuando hay cambio estructural (ej: nuevo año académico).

    Nota: Django no tiene patrón matching nativo en cache, así que esto es un placeholder.
    Para invalidación bulk, se puede usar una versión con Redis o memcached.
    """
    # Por ahora, se puede implementar con cache.clear() si es necesario
    # O mantener un registro de todas las keys generadas
    pass


# Cache keys para invalidación desde signals
CACHE_PREFIXES = {
    "students_summary": "analytics:students_summary",
    "students_at_risk": "analytics:students_at_risk",
    "preinscripciones_summary": "analytics:preinscripciones_summary",
    "preinscripciones_evolucion": "analytics:preinscripciones_evolucion",
    "teacher_workload": "analytics:teacher_workload",
    "teacher_attendance_summary": "analytics:teacher_attendance_summary",
    "academic_performance_materia": "analytics:academic_performance_materia",
    "academic_performance_comisiones": "analytics:academic_performance_comisiones",
    "academic_performance_cohortes": "analytics:academic_performance_cohortes",
    "ausentismo_consolidado": "analytics:ausentismo_consolidado",
}
