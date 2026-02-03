from ninja import Router

# Importamos los routers de los sub-modulos
from .api.actas import router as actas_router
from .api.regularidades_carga import router as regularidades_router
from .api.actas_orales import router as actas_orales_router

# Creamos el router principal que agrega los demas
carga_notas_router = Router()

# Agregamos los routers
# Nota: tags=["carga_notas"] se hereda/agrega. 
# En los sub-modulos tambien definimos tags. Ninja mergea esto.
carga_notas_router.add_router("", actas_router)
carga_notas_router.add_router("", regularidades_router)
carga_notas_router.add_router("", actas_orales_router)