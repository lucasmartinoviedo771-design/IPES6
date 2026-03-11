from datetime import datetime
from typing import List
from ninja import Router, Schema
from django.core.management import call_command
from django.db import connection
from apps.common.api_schemas import ApiResponse
from core.models import SystemLog
from core.auth_ninja import JWTAuth, ensure_roles

router = Router(tags=["system_logs"], auth=JWTAuth())

class SystemLogOut(Schema):
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
    qs = SystemLog.objects.filter(resuelto=resuelto).order_by("-created_at")
    return list(qs)

@router.post("/{log_id}/resolve", response=ApiResponse)
@ensure_roles(["admin"])
def resolve_system_log(request, log_id: int):
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
    Realiza tareas de mantenimiento: migrate, collectstatic y limpieza de cache.
    """
    try:
        # 1. Intentar aplicar migraciones normales
        call_command('migrate', interactive=False)
        
        # 2. Recolectar estáticos
        call_command('collectstatic', interactive=False)
        
        # 3. Limpiar cache (si existe)
        from django.core.cache import cache
        cache.clear()
        
        return ApiResponse(ok=True, message="Sistema sincronizado correctamente (Migraciones y Estáticos).")
    except Exception as e:
        error_msg = str(e)
        # Si el error es de tabla ya existente, podríamos informar al admin
        return ApiResponse(ok=False, message=f"Error durante la sincronización: {error_msg}")
