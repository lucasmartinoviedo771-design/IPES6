"""
Paquete de endpoints del módulo de alumnos.

El router principal sigue siendo `alumnos_router`. A medida que
refactoricemos funcionalidades, iremos moviendo los bloques desde
`legacy_api.py` a módulos dedicados (por ejemplo, `curso_intro_api`).
"""

from .router import alumnos_router
from . import legacy_api  # noqa: F401
from . import curso_intro_api  # noqa: F401
from . import equivalencias_api  # noqa: F401
from . import equivalencias_disposiciones_api  # noqa: F401

__all__ = ["alumnos_router"]
