"""
Orquestador de equivalencias — importar este módulo registra todos los
endpoints en estudiantes_router via el subpaquete equivalencias/.
"""

from apps.estudiantes.api.equivalencias import pedidos  # noqa: F401
from apps.estudiantes.api.equivalencias import export  # noqa: F401
