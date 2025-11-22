from __future__ import annotations

from apps.common.api_schemas import ApiResponse

from ..schemas import CarreraDetalleResumen, CarreraPlanResumen
from .helpers import _listar_carreras_detalle, _resolve_estudiante
from .router import alumnos_router


@alumnos_router.get(
    "/carreras-activas",
    response={200: list[CarreraDetalleResumen], 404: ApiResponse},
)
def carreras_activas(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")
    carreras_est = list(est.carreras.all())
    if not carreras_est:
        return []
    detalle = _listar_carreras_detalle(est, carreras_est)
    return [
        CarreraDetalleResumen(
            profesorado_id=item["profesorado_id"],
            nombre=item["nombre"],
            planes=[
                CarreraPlanResumen(
                    id=plan["id"],
                    resolucion=plan["resolucion"],
                    vigente=plan["vigente"],
                )
                for plan in item["planes"]
            ],
        )
        for item in detalle
    ]
