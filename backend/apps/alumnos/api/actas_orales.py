from datetime import date
from ninja import Router, Schema, Body
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import InscripcionMesa, MesaActaOral, MesaExamen

from apps.alumnos.schemas import (
    ActaOralSchema,
    ActaOralListItemSchema,
)

# ==============================================================================
# LOGIC & ENDPOINTS
# ==============================================================================

router = Router(tags=["carga_notas"])

def _get_inscripcion_mesa_or_404(mesa_id: int, inscripcion_id: int) -> InscripcionMesa:
    inscripcion = (
        InscripcionMesa.objects.select_related("mesa", "estudiante")
        .filter(id=inscripcion_id, mesa_id=mesa_id)
        .first()
    )
    if not inscripcion:
        raise HttpError(404, "La inscripcion indicada no pertenece a la mesa seleccionada.")
    return inscripcion


@router.get(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ActaOralSchema, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def obtener_acta_oral(request, mesa_id: int, inscripcion_id: int):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    acta: MesaActaOral | None = getattr(inscripcion, "acta_oral", None)
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta oral no registrada para el estudiante.")

    return ActaOralSchema(
        acta_numero=acta.acta_numero or None,
        folio_numero=acta.folio_numero or None,
        fecha=acta.fecha,
        curso=acta.curso or None,
        nota_final=acta.nota_final or None,
        observaciones=acta.observaciones or None,
        temas_alumno=acta.temas_alumno or [],
        temas_docente=acta.temas_docente or [],
    )


@router.post(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def guardar_acta_oral(request, mesa_id: int, inscripcion_id: int, payload: ActaOralSchema = Body(...)):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    temas_alumno = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_alumno or [])
        if item.tema
    ]
    temas_docente = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_docente or [])
        if item.tema
    ]

    MesaActaOral.objects.update_or_create(
        inscripcion=inscripcion,
        defaults={
            "mesa": inscripcion.mesa,
            "acta_numero": payload.acta_numero or "",
            "folio_numero": payload.folio_numero or "",
            "fecha": payload.fecha,
            "curso": payload.curso or "",
            "nota_final": payload.nota_final or "",
            "observaciones": payload.observaciones or "",
            "temas_alumno": temas_alumno,
            "temas_docente": temas_docente,
        },
    )

    return ApiResponse(ok=True, message="Acta oral guardada correctamente.")


@router.get(
    "/mesas/{mesa_id}/oral-actas",
    response={200: list[ActaOralListItemSchema], 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_actas_orales(request, mesa_id: int):
    mesa = MesaExamen.objects.filter(id=mesa_id).first()
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")

    actas = (
        MesaActaOral.objects.filter(mesa_id=mesa_id)
        .select_related("inscripcion__estudiante__user")
        .order_by(
            "inscripcion__estudiante__user__last_name",
            "inscripcion__estudiante__user__first_name",
        )
    )

    payload: list[ActaOralListItemSchema] = []
    for acta in actas:
        estudiante = acta.inscripcion.estudiante
        full_name = estudiante.user.get_full_name().strip() or f"{estudiante.user.last_name} {estudiante.user.first_name}".strip()
        payload.append(
            ActaOralListItemSchema(
                inscripcion_id=acta.inscripcion_id,
                alumno=full_name,
                dni=estudiante.dni,
                acta_numero=acta.acta_numero or None,
                folio_numero=acta.folio_numero or None,
                fecha=acta.fecha,
                curso=acta.curso or None,
                nota_final=acta.nota_final or None,
            )
        )

    return payload
