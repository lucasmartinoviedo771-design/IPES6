from __future__ import annotations

from ninja.errors import HttpError

from apps.estudiantes.schemas import (
    EquivalenciaDisposicionCreateIn,
    EquivalenciaDisposicionOut,
    EquivalenciaMateriaPendiente,
)
from apps.estudiantes.services.equivalencias_disposicion import (
    materias_pendientes_para_equivalencia,
    registrar_disposicion_equivalencia,
    resolver_contexto_equivalencia,
    serialize_disposicion,
)
from apps.common.api_schemas import ApiResponse
from core.permissions import ensure_roles

from .router import estudiantes_router

EQUIVALENCIAS_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}


def _serialize_disposicion_schema(dispo, detalles=None) -> EquivalenciaDisposicionOut:
    data = serialize_disposicion(dispo, detalles)
    return EquivalenciaDisposicionOut(**data)


@estudiantes_router.get(
    "/equivalencias/disposiciones/materias",
    response=list[EquivalenciaMateriaPendiente],
)
def materias_pendientes_equivalencia(
    request,
    dni: str,
    profesorado_id: int,
    plan_id: int,
):
    ensure_roles(request.user, EQUIVALENCIAS_ALLOWED_ROLES)
    estudiante, _, plan = resolver_contexto_equivalencia(
        dni=dni,
        profesorado_id=profesorado_id,
        plan_id=plan_id,
    )
    materias = materias_pendientes_para_equivalencia(estudiante, plan)
    return [
        EquivalenciaMateriaPendiente(
            id=mat.id,
            nombre=mat.nombre,
            anio=mat.anio_cursada,
            plan_id=plan.id,
        )
        for mat in materias
    ]


@estudiantes_router.post(
    "/equivalencias/disposiciones",
    response={200: EquivalenciaDisposicionOut, 400: ApiResponse},
)
def crear_disposicion_equivalencia(request, payload: EquivalenciaDisposicionCreateIn):
    ensure_roles(request.user, EQUIVALENCIAS_ALLOWED_ROLES)
    if not payload.detalles:
        return 400, ApiResponse(ok=False, message="Debes cargar al menos una materia.")
    try:
        estudiante, profesorado, plan = resolver_contexto_equivalencia(
            dni=payload.dni,
            profesorado_id=payload.profesorado_id,
            plan_id=payload.plan_id,
        )
        result = registrar_disposicion_equivalencia(
            estudiante=estudiante,
            profesorado=profesorado,
            plan=plan,
            numero_disposicion=payload.numero_disposicion.strip(),
            fecha_disposicion=payload.fecha_disposicion,
            observaciones=payload.observaciones or "",
            detalles_payload=[detalle.dict() for detalle in payload.detalles],
            origen="secretaria",
            usuario=request.user,
            validar_correlatividades=True,
        )
        return _serialize_disposicion_schema(result.disposicion, result.detalles)
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))


@estudiantes_router.get(
    "/equivalencias/disposiciones",
    response=list[EquivalenciaDisposicionOut],
)
def listar_disposiciones_equivalencia(
    request,
    dni: str | None = None,
):
    ensure_roles(request.user, EQUIVALENCIAS_ALLOWED_ROLES)
    from core.models import EquivalenciaDisposicion

    qs = EquivalenciaDisposicion.objects.select_related(
        "profesorado",
        "plan",
        "creado_por",
        "estudiante",
        "estudiante__user",
    ).prefetch_related("detalles__materia")

    if dni:
        qs = qs.filter(estudiante__dni=dni)
    return [_serialize_disposicion_schema(dispo) for dispo in qs.order_by("-creado_en")]
