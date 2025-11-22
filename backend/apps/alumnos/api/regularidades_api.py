from __future__ import annotations

from apps.common.api_schemas import ApiResponse
from core.models import Materia, Regularidad

from ..schemas import RegularidadVigenciaOut
from .helpers import _calcular_vigencia_regularidad, _resolve_estudiante
from .router import alumnos_router


@alumnos_router.get("/vigencia-regularidad", response=dict)
def vigencia_regularidad(request, materia_id: int, dni: str | None = None):
    """Calcula hasta cuándo está vigente la regularidad del alumno en una materia."""
    est = _resolve_estudiante(request, dni)
    if not est:
        return {"vigente": False, "motivo": "estudiante_no_encontrado"}

    materia = Materia.objects.filter(id=materia_id).first()
    if not materia:
        return {"vigente": False, "motivo": "materia_no_encontrada"}

    reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
    if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
        return {"vigente": False, "motivo": "sin_regularidad"}

    vigencia_limite, intentos = _calcular_vigencia_regularidad(est, reg)
    return {
        "vigente": True,
        "fecha_cierre": reg.fecha_cierre.isoformat(),
        "hasta": vigencia_limite.isoformat(),
        "intentos_usados": intentos,
        "intentos_max": 3,
    }
