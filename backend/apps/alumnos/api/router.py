from ninja import Router

from core.auth_ninja import JWTAuth

alumnos_router = Router(tags=["alumnos"], auth=JWTAuth())

__all__ = ["alumnos_router"]
