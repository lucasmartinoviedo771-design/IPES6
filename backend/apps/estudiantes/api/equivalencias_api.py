"""
Orquestador de equivalencias — importar este módulo registra todos los
endpoints en estudiantes_router via el subpaquete equivalencias/.
"""

from apps.estudiantes.api.equivalencias import (
    export,  # noqa: F401
    pedidos,  # noqa: F401
)
