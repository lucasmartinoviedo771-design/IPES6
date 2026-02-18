# core/api_root.py
from ninja import NinjaAPI

from apps.estudiantes.api import estudiantes_router as estudiantes_api_router  # Importar el router de estudiantes
from apps.estudiantes.carga_notas_api import carga_notas_router
from apps.carreras.api import carreras_router  # Importar el router de carreras
from apps.guias.api import router as guias_router
from apps.health_api import health  # Health check
from apps.asistencia.api import (
    estudiantes_router as asistencia_estudiantes_router,
    docentes_router as asistencia_docentes_router,
    calendario_router as asistencia_calendario_router,
)
from apps.common.audit_api import router as audit_router
from apps.common.errors import register_error_handlers

if 'api' not in locals():
    api = NinjaAPI(title="IPES6 API")
    register_error_handlers(api)
    # Función auxiliar para evitar errores de router duplicado
    from ninja.errors import ConfigError

    def safe_add_router(prefix, router):
        try:
            api.add_router(prefix, router)
        except ConfigError:
            pass

    # ⬇ importa el router del módulo de preinscripciones
    from apps.preinscriptions.api import router as preins_router
    from apps.preinscriptions.api_uploads import router as preins_uploads_router
    
    safe_add_router("/preinscripciones", preins_router)
    safe_add_router("/preinscripciones/uploads", preins_uploads_router)

    from apps.preinscriptions.admin_api import router as preins_admin_router
    safe_add_router("/preinscripciones/admin", preins_admin_router)
    
    safe_add_router("/profesorados", carreras_router)
    safe_add_router("/estudiantes", estudiantes_api_router)  # Montar el router de estudiantes
    safe_add_router("/estudiantes/carga-notas", carga_notas_router)
    
    from apps.estudiantes.gestion_comisiones_api import router as gestion_comisiones_router
    safe_add_router("/estudiantes/comisiones", gestion_comisiones_router)

    safe_add_router("/asistencia/docentes", asistencia_docentes_router)
    safe_add_router("/asistencia/estudiantes", asistencia_estudiantes_router)
    safe_add_router("/asistencia/calendario", asistencia_calendario_router)
    safe_add_router("/", guias_router)
    
    from apps.metrics.api import router as metrics_router
    safe_add_router("/reportes", metrics_router)
    
    from apps.primera_carga.api import (
        primera_carga_router,
    )
    safe_add_router("/admin/primera-carga", primera_carga_router)  # Montar el router de primera carga
    safe_add_router("/auditoria", audit_router)
    
    from apps.common.system_log_api import router as system_log_router
    safe_add_router("/system/logs", system_log_router)

    # (opcional) si tienes otros routers, puedes montarlos aquí también:
    from .api import router as core_router
    from .auth_api import router as auth_router
    safe_add_router("/auth", auth_router)

    from .api import management_router
    safe_add_router("/management", management_router)
    safe_add_router("/", core_router)
