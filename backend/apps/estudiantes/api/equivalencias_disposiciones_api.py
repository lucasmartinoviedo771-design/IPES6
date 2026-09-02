from __future__ import annotations

from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from apps.estudiantes.schemas import (
    EquivalenciaDisposicionCreateIn,
    EquivalenciaDisposicionOut,
    EquivalenciaDisposicionUpdateIn,
    EquivalenciaMateriaPendiente,
)
from apps.estudiantes.services.equivalencias_disposicion import (
    actualizar_disposicion_equivalencia,
    eliminar_disposicion_equivalencia,
    materias_pendientes_para_equivalencia,
    registrar_disposicion_equivalencia,
    resolver_contexto_equivalencia,
    serialize_disposicion,
)
from core.permissions import get_user_roles, require

from .router import estudiantes_router


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
    require(request.user, "gestionar_equivalencias")
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
    require(request.user, "gestionar_equivalencias")
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


@estudiantes_router.put(
    "/equivalencias/disposiciones/{disposicion_id}",
    response={200: EquivalenciaDisposicionOut, 400: ApiResponse, 403: ApiResponse},
)
def modificar_disposicion_equivalencia(
    request,
    disposicion_id: int,
    payload: EquivalenciaDisposicionUpdateIn,
):
    require(request.user, "gestionar_equivalencias")
    roles = get_user_roles(request.user)
    if not (
        request.user.is_superuser
        or "admin" in roles
        or "secretaria" in roles
        or any(r.startswith("secretaria") for r in roles)
        or "bedel" in roles
        or any(r.startswith("bedel") for r in roles)
    ):
        return 403, ApiResponse(ok=False, message="No tienes permisos para modificar equivalencias.")

    if not payload.detalles:
        return 400, ApiResponse(ok=False, message="Debes mantener al menos una materia en la disposición.")
    try:
        result = actualizar_disposicion_equivalencia(
            disposicion_id=disposicion_id,
            numero_disposicion=payload.numero_disposicion.strip(),
            fecha_disposicion=payload.fecha_disposicion,
            observaciones=payload.observaciones or "",
            detalles_payload=[detalle.dict() for detalle in payload.detalles],
            usuario=request.user,
            validar_correlatividades=True,
        )
        return _serialize_disposicion_schema(result.disposicion, result.detalles)
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))


@estudiantes_router.delete(
    "/equivalencias/disposiciones/{disposicion_id}",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse},
)
def anular_disposicion_equivalencia(request, disposicion_id: int):
    require(request.user, "gestionar_equivalencias")
    roles = get_user_roles(request.user)
    if not (
        request.user.is_superuser
        or "admin" in roles
        or "secretaria" in roles
        or any(r.startswith("secretaria") for r in roles)
    ):
        return 403, ApiResponse(ok=False, message="Solo Secretaría o Administradores pueden anular equivalencias.")

    try:
        eliminar_disposicion_equivalencia(disposicion_id=disposicion_id)
        return ApiResponse(ok=True, message="Disposición de equivalencia anulada correctamente.")
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
    require(request.user, "gestionar_equivalencias")
    from core.models import EquivalenciaDisposicion

    qs = EquivalenciaDisposicion.objects.select_related(
        "profesorado",
        "plan",
        "creado_por",
        "estudiante",
        "estudiante__user",
    ).prefetch_related("detalles__materia")

    if dni:
        qs = qs.filter(estudiante__persona__dni=dni)
    return [_serialize_disposicion_schema(dispo) for dispo in qs.order_by("-creado_en")]
