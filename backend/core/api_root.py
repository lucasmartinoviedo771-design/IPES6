# core/api_root.py
from ninja import NinjaAPI

# ⬇ importa el router del módulo de preinscripciones
from apps.preinscriptions.api import router as preins_router
from apps.carreras.api import carreras_router # Importar el router de carreras

api = NinjaAPI(title="IPES6 API")

api.add_router("/preinscriptions", preins_router)
api.add_router("/profesorados", carreras_router) # Montar el router de carreras

# (opcional) si tienes otros routers, puedes montarlos aquí también:
from .auth_api import router as auth_router
api.add_router("/auth", auth_router)

from .api import router as core_router
api.add_router("/", core_router)