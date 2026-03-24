"""
Definición y exportación de routers para el módulo de Preinscripciones.
Separa el flujo público de aspirantes (sin auth) del flujo administrativo (con JWT).
"""

from ninja import Router
from core.auth_ninja import JWTAuth

# Router para aspirantes (público) - registro y carga de documentos inicial
preins_router = Router(tags=["Preinscripciones"], auth=None)

# Router para bedeles y administradores (protegido) - validación y gestión
preins_admin_router = Router(tags=["Gestión Preinscripciones"], auth=JWTAuth())

from . import api  # noqa: F401
from . import api_uploads  # noqa: F401

__all__ = ["preins_router", "preins_admin_router"]
