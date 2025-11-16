# core/api_root.py
from ninja import NinjaAPI

from apps.alumnos.api import alumnos_router as alumnos_api_router  # Importar el router de alumnos
from apps.alumnos.carga_notas_api import carga_notas_router
from apps.carreras.api import carreras_router  # Importar el router de carreras
from apps.guias.api import router as guias_router
from apps.health_api import health  # Health check
from apps.asistencia.api import (
    alumnos_router as asistencia_alumnos_router,
    docentes_router as asistencia_docentes_router,
    calendario_router as asistencia_calendario_router,
)
from apps.common.audit_api import router as audit_router

if 'api' not in locals():
    api = NinjaAPI(title="IPES6 API")
    api.get("/health")(health)  # Health endpoint

    # ⬇ importa el router del módulo de preinscripciones
    from apps.preinscriptions.api import router as preins_router
    from apps.preinscriptions.api_uploads import router as preins_uploads_router
    api.add_router("/preinscripciones", preins_router)
    api.add_router("/preinscripciones", preins_uploads_router)
    api.add_router("/profesorados", carreras_router)
    api.add_router("/alumnos", alumnos_api_router)  # Montar el router de alumnos
    api.add_router("/alumnos/carga-notas", carga_notas_router)
    api.add_router("/asistencia/docentes", asistencia_docentes_router)
    api.add_router("/asistencia/alumnos", asistencia_alumnos_router)
    api.add_router("/asistencia/calendario", asistencia_calendario_router)
    api.add_router("/", guias_router)
    from apps.metrics.api import router as metrics_router
    api.add_router("/reportes", metrics_router)
    from apps.primera_carga.api import (
        primera_carga_router,
    )
    api.add_router("/admin/primera-carga", primera_carga_router)  # Montar el router de primera carga
    api.add_router("/auditoria", audit_router)

    # (opcional) si tienes otros routers, puedes montarlos aquí también:
    from .api import router as core_router
    from .auth_api import router as auth_router
    api.add_router("/auth", auth_router)

    api.add_router("/", core_router)
