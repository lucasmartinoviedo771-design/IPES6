from ninja import Router

from core.auth_ninja import JWTAuth

estudiantes_router = Router(tags=["Estudiantes"], auth=JWTAuth())

__all__ = ["estudiantes_router"]
