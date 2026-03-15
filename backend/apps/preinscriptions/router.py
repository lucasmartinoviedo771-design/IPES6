from ninja import Router
from core.auth_ninja import JWTAuth

preins_router = Router(tags=["Preinscripciones"])
preins_admin_router = Router(tags=["Gestión Preinscripciones"], auth=JWTAuth())

from . import api  # noqa: F401
from . import api_uploads  # noqa: F401

__all__ = ["preins_router", "preins_admin_router"]
