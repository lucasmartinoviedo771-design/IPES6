from __future__ import annotations

from apps.common.api_schemas import ApiResponse

from ..schemas import EstudianteAdminDetail, EstudianteAdminUpdateIn
from .helpers import _apply_estudiante_updates, _build_admin_detail, _resolve_estudiante
from .router import estudiantes_router


@estudiantes_router.get(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def estudiante_get_perfil_completar(request):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")
    return _build_admin_detail(est)


@estudiantes_router.put(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def estudiante_update_perfil_completar(request, payload: EstudianteAdminUpdateIn):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")

    # Evitamos que el estudiante modifique datos sensibles/administrativos
    payload.dni = None
    payload.anio_ingreso = None
    payload.cuil = None
    payload.observaciones = None
    payload.rol_extra = None
    payload.documentacion = None
    payload.curso_introductorio_aprobado = None
    payload.libreta_entregada = None

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=False,
        allow_force_password=False,
        mark_profile_complete=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)
