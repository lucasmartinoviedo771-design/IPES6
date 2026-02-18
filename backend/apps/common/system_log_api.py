from datetime import datetime
from typing import List
from ninja import Router, Schema
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
