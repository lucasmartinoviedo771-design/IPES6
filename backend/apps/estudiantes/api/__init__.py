"""
Paquete de endpoints del módulo de estudiantes.

El router principal sigue siendo `estudiantes_router`, y cada funcionalidad
vive en su propio módulo (curso introductorio, trayectorias, horarios, etc.).
"""

from . import (
    admin_documentacion_api,  # noqa: F401
    admin_estudiantes_core_api,  # noqa: F401
    admin_prorrogas_residencias_api,  # noqa: F401
    admin_resguardos_api,  # noqa: F401
    analisis_api,  # noqa: F401
    analiticos_api,  # noqa: F401
    carreras_api,  # noqa: F401
    certificados_api,  # noqa: F401
    curso_intro_api,  # noqa: F401
    equivalencias_api,  # noqa: F401
    equivalencias_disposiciones_api,  # noqa: F401
    horarios_api,  # noqa: F401
    inscripciones_materias_api,  # noqa: F401
    mesas_api,  # noqa: F401
    perfil_api,  # noqa: F401
    planillas_finales_api,  # noqa: F401
    regularidades_api,  # noqa: F401
    reportes_api,  # noqa: F401
    trayectoria_api,  # noqa: F401
)
from .router import estudiantes_router

__all__ = ["estudiantes_router"]
