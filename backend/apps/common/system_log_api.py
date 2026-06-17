"""
Endpoints de administración del sistema y diagnóstico.
Permite la visualización de errores críticos del servidor (System Logs) 
y provee herramientas de mantenimiento operacional como sincronización de esquemas 
y recolección de archivos estáticos.
"""

from datetime import datetime
from typing import List
from ninja import Router, Schema
from django.core.management import call_command
from apps.common.api_schemas import ApiResponse
from core.models import SystemLog
from core.auth_ninja import JWTAuth, ensure_roles

# Acceso restringido únicamente a Superusuarios/Administradores globales.
router = Router(tags=["system_logs"], auth=JWTAuth())


class SystemLogOut(Schema):
    """Esquema de salida para logs de error del sistema."""
    id: int
    tipo: str
    mensaje: str
    metadata: dict
    resuelto: bool
    created_at: datetime
    updated_at: datetime


@router.get("/", response=List[SystemLogOut])
@ensure_roles(["admin"])
def list_system_logs(request, resuelto: bool = False):
    """Lista las alertas del sistema, filtrando por estado de resolución."""
    qs = SystemLog.objects.filter(resuelto=resuelto).order_by("-created_at")
    return list(qs)


@router.post("/{log_id}/resolve", response=ApiResponse)
@ensure_roles(["admin"])
def resolve_system_log(request, log_id: int):
    """Marca una alerta del sistema como atendida/resuelta."""
    try:
        log = SystemLog.objects.get(id=log_id)
        log.resuelto = True
        log.save()
        return ApiResponse(ok=True, message="Log marcado como resuelto.")
    except SystemLog.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Log no encontrado.")


@router.post("/sync-repair", response=ApiResponse)
@ensure_roles(["admin"])
def sync_repair_system(request):
    """
    Herramienta de autorecuperación del sistema.
    Ejecuta comandos de infraestructura (migrate, collectstatic, clear_cache)
    desde la interfaz administrativa para resolver inconsistencias post-despliegue.
    """
    try:
        # 1. Aplicación de migraciones pendientes
        call_command('migrate', interactive=False)
        
        # 2. Re-compilación de archivos estáticos (Frontend/Admin)
        call_command('collectstatic', interactive=False)
        
        # 3. Limpieza total de la memoria caché
        from django.core.cache import cache
        cache.clear()
        
        return ApiResponse(
            ok=True, 
            message="Sincronización completada exitosamente (Migraciones, Estáticos y Caché)."
        )
    except Exception as e:
        error_msg = str(e)
        return ApiResponse(
            ok=False, 
            message=f"Error crítico durante la sincronización: {error_msg}"
        )
