import logging
from datetime import date, datetime
from apps.common.date_utils import format_date, format_datetime
from apps.primera_carga.services.historial import get_historial_regularidades, get_historico_mesas_pandemia

from typing import Any
from django.http import HttpResponse
from ninja import File, Form, Router, Schema
from ninja.files import UploadedFile

logger = logging.getLogger(__name__)

from apps.estudiantes.schemas import (
    EquivalenciaDisposicionCreateIn,
    EquivalenciaDisposicionOut,
)
from apps.estudiantes.services.equivalencias_disposicion import (
    registrar_disposicion_equivalencia,
    resolver_contexto_equivalencia,
    serialize_disposicion,
)
from apps.common.api_schemas import ApiResponse
from apps.primera_carga.services import (
    crear_estudiante_manual,
    crear_planilla_regularidad,
    obtener_regularidad_metadata,
    obtener_planilla_regularidad_detalle,
    actualizar_planilla_regularidad,
    process_equivalencias_csv,
    process_estudiantes_csv,
    process_folios_finales_csv,
)
from apps.primera_carga.services.mesas_pandemia import registrar_mesa_pandemia
from core.auth_ninja import JWTAuth, ensure_roles
from core.permissions import allowed_profesorados
from core.models import PlanillaRegularidad

primera_carga_router = Router(tags=["primera_carga"], auth=JWTAuth())


class UploadForm(Schema):
    dry_run: bool = False


class EstudianteManualIn(Schema):
    dni: str
    nombre: str
    apellido: str
    profesorado_id: int
    email: str | None = None
    telefono: str | None = None
    domicilio: str | None = None
    fecha_nacimiento: str | None = None
    estado_legajo: str | None = None
    anio_ingreso: str | None = None
    genero: str | None = None
    rol_extra: str | None = None
    observaciones: str | None = None
    cuil: str | None = None
    cohorte: str | None = None
    is_active: bool | None = True
    must_change_password: bool | None = True
    password: str | None = None


@primera_carga_router.post(
    "/estudiantes",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def upload_estudiantes(request, file: UploadedFile = File(...), form: UploadForm = Form(...)):  # noqa: B008
    try:
        file_content = file.read().decode("utf-8")
        result = process_estudiantes_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(ok=True, message="Importación de estudiantes completada.", data=result)
        return 400, ApiResponse(ok=False, message="Importación de estudiantes con errores.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al procesar el archivo: {exc}")


@primera_carga_router.post(
    "/estudiantes/manual",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_estudiante_manual_endpoint(request, payload: EstudianteManualIn):
    try:
        result = crear_estudiante_manual(user=request.user, data=payload.dict())
        return ApiResponse(
            ok=True,
            message=result.get("message", "Estudiante registrado."),
            data=result,
        )
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al registrar al estudiante: {exc}")


class FoliosFinalesUploadForm(Schema):
    dry_run: bool = False


@primera_carga_router.post(
    "/folios-finales",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def upload_folios_finales(request, file: UploadedFile = File(...), form: FoliosFinalesUploadForm = Form(...)):  # noqa: B008
    try:
        file_content = file.read().decode("utf-8")
        result = process_folios_finales_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(
                ok=True,
                message="Asignación de folios finales completada.",
                data=result,
            )
        return 400, ApiResponse(ok=False, message="Asignación de folios finales con errores.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al procesar el archivo: {exc}")


class EquivalenciasUploadForm(Schema):
    dry_run: bool = False


@primera_carga_router.post(
    "/equivalencias",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def upload_equivalencias(request, file: UploadedFile = File(...), form: EquivalenciasUploadForm = Form(...)):  # noqa: B008
    try:
        file_content = file.read().decode("utf-8")
        result = process_equivalencias_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(
                ok=True,
                message="Importación de equivalencias completada.",
                data=result,
            )
        return 400, ApiResponse(ok=False, message="Importación de equivalencias con errores.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al procesar el archivo: {exc}")


@primera_carga_router.post(
    "/equivalencias/disposiciones",
    response={200: EquivalenciaDisposicionOut, 400: ApiResponse, 403: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def registrar_disposicion_equivalencia_primera_carga(request, payload: EquivalenciaDisposicionCreateIn):
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
            origen="primera_carga",
            usuario=request.user,
            validar_correlatividades=False,
        )
        data = serialize_disposicion(result.disposicion, result.detalles)
        return EquivalenciaDisposicionOut(**data)
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))


class RegularidadDocenteIn(Schema):
    docente_id: int | None = None
    nombre: str
    dni: str | None = None
    rol: str | None = None
    orden: int | None = None


class RegularidadFilaIn(Schema):
    orden: int | None = None
    dni: str
    apellido_nombre: str
    nota_final: float | None = None
    asistencia: float | None = None
    situacion: str
    excepcion: bool | None = False
    datos: dict[str, str] | None = None
    observaciones: str | None = None


class PlanillaRegularidadCreateIn(Schema):
    profesorado_id: int
    materia_id: int
    plantilla_id: int
    dictado: str
    fecha: date
    folio: str | None = None
    plan_resolucion: str | None = None
    observaciones: str | None = None
    datos_adicionales: dict[str, str] | None = None
    docentes: list[RegularidadDocenteIn] | None = None
    filas: list[RegularidadFilaIn]
    estado: str | None = None
    dry_run: bool = False


@primera_carga_router.get(
    "/regularidades/metadata",
    response={200: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def regularidades_metadata(request, include_all: bool = False):
    data = obtener_regularidad_metadata(request.user, include_all=include_all)
    return ApiResponse(ok=True, message="Metadata de planillas de regularidad.", data=data)


@primera_carga_router.post(
    "/regularidades/planillas",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_planilla(request, payload: PlanillaRegularidadCreateIn):
    logger.debug("Iniciando crear_planilla. Materia=%s, Filas=%s", payload.materia_id, len(payload.filas))
    try:
        estado = payload.estado or PlanillaRegularidad.Estado.FINAL
        if estado not in PlanillaRegularidad.Estado.values:
            logger.warning("Estado inválido: %s", estado)
            return 400, ApiResponse(ok=False, message="Estado de planilla inválido.")

        result = crear_planilla_regularidad(
            user=request.user,
            profesorado_id=payload.profesorado_id,
            materia_id=payload.materia_id,
            plantilla_id=payload.plantilla_id,
            dictado=payload.dictado,
            fecha=payload.fecha,
            folio=payload.folio,
            plan_resolucion=payload.plan_resolucion,
            observaciones=payload.observaciones or "",
            datos_adicionales=payload.datos_adicionales or {},
            docentes=[doc.dict() for doc in (payload.docentes or [])],
            filas=[fila.dict() for fila in payload.filas],
            estado=estado,
            dry_run=payload.dry_run,
        )
        message = "Planilla generada (dry-run)." if payload.dry_run else "Planilla generada correctamente."
        return ApiResponse(ok=True, message=message, data=result)
    except ValueError as exc:
        logger.warning("ValueError en crear_planilla: %s", exc)
        return 400, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        logger.exception("Exception en crear_planilla: %s", exc)
        return 400, ApiResponse(ok=False, message=f"Error al crear la planilla: {exc}")


class RegularidadIndividualIn(Schema):
    dni: str
    materia_id: int
    profesorado_id: int
    plan_id: int | None = None
    fecha: date
    dictado: str | None = "ANUAL"
    nota_final: float | None = None
    asistencia: float | None = None
    situacion: str
    excepcion: bool = False
    observaciones: str | None = None
    force_upgrade: bool = False
    folio: str | None = None


@primera_carga_router.post(
    "/regularidades/individual",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def registrar_regularidad_individual(request, payload: RegularidadIndividualIn):
    try:
        from apps.primera_carga.services import registrar_regularidad_individual_historica
        result = registrar_regularidad_individual_historica(request.user, payload.dict())
        return ApiResponse(ok=True, message="Regularidad registrada exitosamente.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=str(exc))


class PlanillaRegularidadListOut(Schema):
    id: int
    codigo: str
    profesorado_id: int
    profesorado_nombre: str
    materia_nombre: str
    anio_cursada: str | None
    dictado: str | None
    fecha: date
    cantidad_estudiantes: int
    estado: str | None
    folio: str | None = None
    anio_academico: int
    created_at: str | None

@primera_carga_router.get(
    "/regularidades/historial",
    response={200: list[PlanillaRegularidadListOut], 403: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def listar_historial_regularidades(request, anio: int | None = None, profesorado_id: int | None = None, ordering: str = "-created_at"):
    data, error = get_historial_regularidades(request.user, anio=anio, profesorado_id=profesorado_id, ordering=ordering)
    if error:
        return 403, ApiResponse(ok=False, message=error)
    return data

@primera_carga_router.get(
    "/regularidades/planillas/{planilla_id}/pdf",
    auth=None,
    response={200: Any, 403: ApiResponse, 404: ApiResponse},
)
# @ensure_roles(["admin", "secretaria", "bedel"])
def descargar_planilla_pdf(request, planilla_id: int):
    planilla = PlanillaRegularidad.objects.filter(id=planilla_id).first()
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")
    
    # Renderizar PDF al vuelo
    from apps.primera_carga.services import _render_planilla_regularidad_pdf
    pdf_bytes = _render_planilla_regularidad_pdf(planilla)
    
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="planilla_{planilla.codigo}.pdf"'
    return response


@primera_carga_router.get(
    "/regularidades/planillas/{planilla_id}",
    response={200: Any, 404: ApiResponse, 403: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def ver_planilla_detalle(request, planilla_id: int):
    try:
        data = obtener_planilla_regularidad_detalle(planilla_id)
        return ApiResponse(ok=True, message="Detalle de planilla.", data=data)
    except ValueError as exc:
        return 404, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error: {exc}")


@primera_carga_router.put(
    "/regularidades/planillas/{planilla_id}",
    response={200: ApiResponse, 404: ApiResponse, 403: ApiResponse, 400: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def actualizar_planilla_endpoint(request, planilla_id: int, payload: PlanillaRegularidadCreateIn):
    try:
        data = actualizar_planilla_regularidad(
            planilla_id=planilla_id,
            user=request.user,
            **payload.dict(exclude={"dry_run"}),
            dry_run=payload.dry_run
        )
        return ApiResponse(ok=True, message="Planilla actualizada correctamente.", data=data)
    except ValueError as exc:
        return 404, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al actualizar la planilla: {exc}")


# ---------------------------------------------------------------------------
# Mesas Pandemia / Notas Históricas
# ---------------------------------------------------------------------------

class MesaPandemiaFilaIn(Schema):
    apellido_nombre: str
    dni: str | None = None
    nota_raw: str | None = None          # "7", "AUSENTE", "LIBRE", etc.
    comision_obs: str | None = None      # texto libre: comisión / otro prof.
    observaciones: str | None = None


class MesaPandemiaIn(Schema):
    profesorado_id: int
    materia_id: int
    fecha: date
    tipo: str = "EXT"                    # FIN, EXT, ESP
    docente_nombre: str | None = None
    folio: str | None = None
    libro: str | None = None
    observaciones: str | None = None
    filas: list[MesaPandemiaFilaIn]
    dry_run: bool = False


@primera_carga_router.post(
    "/mesas-pandemia",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def registrar_mesa_pandemia_endpoint(request, payload: MesaPandemiaIn):
    try:
        result = registrar_mesa_pandemia(
            user=request.user,
            profesorado_id=payload.profesorado_id,
            materia_id=payload.materia_id,
            fecha=payload.fecha,
            tipo=payload.tipo,
            docente_nombre=payload.docente_nombre or "",
            folio=payload.folio or "",
            libro=payload.libro or "",
            observaciones=payload.observaciones or "",
            filas=[f.dict() for f in payload.filas],
            dry_run=payload.dry_run,
        )
        msg = "Carga de notas procesada (dry-run)." if payload.dry_run else "Notas de mesa registradas correctamente."
        return ApiResponse(ok=True, message=msg, data=result)
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        logger.exception("Error al procesar la carga: %s", exc)
        return 400, ApiResponse(ok=False, message=f"Error al procesar la carga: {exc}")


@primera_carga_router.get(
    "/mesas-pandemia",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def listar_historico_mesas_pandemia(request, ordering: str = "-fecha"):
    """Lista las mesas de examen registradas bajo protocolo de 'PANDEMIA'."""
    data = get_historico_mesas_pandemia(request.user, ordering=ordering)
    return ApiResponse(ok=True, message="Listado histórico.", data=data)

