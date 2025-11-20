"""
Paquete de endpoints del módulo de alumnos.

El router principal sigue siendo `alumnos_router`, y cada funcionalidad
vive en su propio módulo (curso introductorio, trayectorias, horarios, etc.).
"""

from .router import alumnos_router

from . import curso_intro_api  # noqa: F401
from . import equivalencias_api  # noqa: F401
from . import equivalencias_disposiciones_api  # noqa: F401
from . import analiticos_api  # noqa: F401
from . import admin_estudiantes_api  # noqa: F401
from . import perfil_api  # noqa: F401
from . import trayectoria_api  # noqa: F401
from . import horarios_api  # noqa: F401
from . import regularidades_api  # noqa: F401
from . import carreras_api  # noqa: F401
from . import inscripciones_materias_api  # noqa: F401
from . import mesas_api  # noqa: F401
from . import planillas_finales_api  # noqa: F401

__all__ = ["alumnos_router"]
