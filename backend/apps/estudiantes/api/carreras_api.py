from __future__ import annotations

from apps.common.api_schemas import ApiResponse

from ..schemas import CarreraDetalleResumen, CarreraPlanResumen, CarrerasActivasOut
from .helpers import _listar_carreras_detalle, _resolve_estudiante
from .router import estudiantes_router


@estudiantes_router.get(
    "/carreras-activas",
    response={200: CarrerasActivasOut, 404: ApiResponse},
)
def carreras_activas(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")
    
    carreras_est = list(est.carreras.all())
    detalle = _listar_carreras_detalle(est, carreras_est)
    
    carreras_out = [
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

    return CarrerasActivasOut(
        estudiante_nombre=est.user.get_full_name() if est.user_id else est.apellido + ", " + est.nombre,
        estudiante_dni=est.dni,
        carreras=carreras_out
    )
