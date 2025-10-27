# core/api_root.py
from ninja import NinjaAPI

# ⬇ importa el router del módulo de preinscripciones
from apps.preinscriptions.api import router as preins_router
from apps.preinscriptions.api_uploads import router as preins_uploads_router
from apps.carreras.api import carreras_router  # Importar el router de carreras
from apps.alumnos.api import alumnos_router    # Importar el router de alumnos
from apps.alumnos.carga_notas_api import carga_notas_router
from apps.health_api import health  # Health check

api = NinjaAPI(title="IPES6 API")
api.get("/health")(health) # Health endpoint

api.add_router("/preinscripciones", preins_router)
api.add_router("/preinscripciones", preins_uploads_router)
api.add_router("/profesorados", carreras_router)
api.add_router("/alumnos", alumnos_router)  # Montar el router de alumnos
api.add_router("/alumnos/carga-notas", carga_notas_router)

# (opcional) si tienes otros routers, puedes montarlos aquí también:
from .auth_api import router as auth_router
api.add_router("/auth", auth_router)

from .api import router as core_router
api.add_router("/", core_router)
