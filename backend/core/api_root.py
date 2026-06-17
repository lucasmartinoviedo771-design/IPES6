"""
Punto de entrada central de la API (NinjaAPI).
Este módulo configura la instancia global de 'api', monta los routers de todas las aplicaciones
y define la política de seguridad por defecto del sistema.
"""

import logging
from ninja import NinjaAPI
from ninja.errors import ConfigError

logger = logging.getLogger(__name__)

# Importación selectiva de routers de aplicaciones
from apps.estudiantes.api import estudiantes_router as estudiantes_api_router
from apps.estudiantes.carga_notas_api import carga_notas_router
from apps.carreras.api import profesorados_router, planes_router, materias_router
from apps.carreras.comisiones_api import router as comisiones_router
from apps.carreras.correlatividades_api import router as correlatividades_router
from apps.calendario.api import router as calendario_router
from apps.mensajeria.api import router as mensajeria_router
from apps.docentes.api import router as docentes_router
from apps.guias.api import router as guias_router
from apps.health_api import router as health_router
from apps.asistencia.api import (
    estudiantes_router as asistencia_estudiantes_router,
    docentes_router as asistencia_docentes_router,
    calendario_router as asistencia_calendario_router,
)
from apps.common.audit_api import router as audit_router
from apps.common.errors import register_error_handlers
from apps.metrics.api import router as metrics_router
from apps.metrics.dashboard_api import router as dashboard_router
from apps.primera_carga.api import primera_carga_router
from apps.estudiantes.api.planillas_cursada_api import router as planillas_cursada_router
from apps.common.system_log_api import router as system_log_router
from apps.management.auth_api import router as auth_router
from apps.management import management_router
from apps.preinscriptions.router import preins_router, preins_admin_router
from apps.preinscriptions.api_uploads import router as preins_uploads_router

# Singleton de la API
if 'api' not in locals():
    from core.auth_ninja import JWTAuth
    
    api = NinjaAPI(
        title="IPES6 API",
        version="1.0.0",
        auth=JWTAuth(),  # SEGURIDAD: TODA la API requiere JWT por defecto.
    )
    register_error_handlers(api)

    def safe_add_router(prefix: str, router):
        """
        Monta un router en la API de forma segura.
        Evita interrupciones si se intenta registrar un prefijo duplicado
        durante el proceso de recolección de configuraciones.
        """
        try:
            api.add_router(prefix, router)
        except ConfigError as e:
            # Reportar como error crítico para alertar en monitoreo de logs estructurados
            logger.error(f"CRITICO: Fallo al montar router en {prefix}: {e}", exc_info=True)

    # --- MONTAJE DE SEGMENTOS ---

    # Aplicaciones CORE y Gestión (Management)
    safe_add_router("/auth", auth_router)
    safe_add_router("/auditoria", audit_router)
    safe_add_router("/system/logs", system_log_router)
    safe_add_router("/system/health", health_router)
    safe_add_router("/", management_router)

    # Profesorados y Planes (Estructura Académica)
    safe_add_router("/profesorados", profesorados_router)
    safe_add_router("/planes", planes_router)
    safe_add_router("/materias", materias_router)
    safe_add_router("/comisiones", comisiones_router)

    # Estudiantes y Docentes (Gestión Académica)
    safe_add_router("/estudiantes", estudiantes_api_router)
    safe_add_router("/estudiantes/carga-notas", carga_notas_router)
    safe_add_router("/estudiantes/planillas-cursada", planillas_cursada_router)
    from apps.estudiantes.gestion_comisiones_api import router as gestion_comisiones_router
    safe_add_router("/estudiantes/comisiones", gestion_comisiones_router)
    safe_add_router("/docentes", docentes_router)

    # Preinscripciones (Puerta de entrada de Alumnos)
    safe_add_router("/preinscripciones", preins_router)
    safe_add_router("/preinscripciones/uploads", preins_uploads_router)
    safe_add_router("/preinscripciones/admin", preins_admin_router)

    # Seguimiento y Servicios (Calendario, Mensajería, Asistencia)
    safe_add_router("/", calendarios_globales_router := calendario_router)
    safe_add_router("/", correlatividades_router_fix := correlatividades_router)
    safe_add_router("/mensajes", mensajeria_router)
    safe_add_router("/asistencia/docentes", asistencia_docentes_router)
    safe_add_router("/asistencia/estudiantes", asistencia_estudiantes_router)
    safe_add_router("/asistencia/calendario", asistencia_calendario_router)
    safe_add_router("/", guias_router)

    # Reportes y Dashboards
    safe_add_router("/reportes", metrics_router)
    safe_add_router("/", dashboard_router)

    # Mantenimiento y Carga Inicial
    safe_add_router("/admin/primera-carga", primera_carga_router)
