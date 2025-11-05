from datetime import date
from typing import Optional, List, Dict

from ninja import Router, File, Form, Schema
from ninja.files import UploadedFile

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import PlanillaRegularidad
from apps.primera_carga.services import (
    process_estudiantes_csv,
    process_folios_finales_csv,
    process_equivalencias_csv,
    obtener_regularidad_metadata,
    crear_planilla_regularidad,
    crear_estudiante_manual,
)


primera_carga_router = Router(tags=["primera_carga"], auth=JWTAuth())


class UploadForm(Schema):
    dry_run: bool = False


class EstudianteManualIn(Schema):
    dni: str
    nombre: str
    apellido: str
    profesorado_id: int
    email: Optional[str] = None
    telefono: Optional[str] = None
    domicilio: Optional[str] = None
    fecha_nacimiento: Optional[str] = None
    estado_legajo: Optional[str] = None
    anio_ingreso: Optional[str] = None
    genero: Optional[str] = None
    rol_extra: Optional[str] = None
    observaciones: Optional[str] = None
    cuil: Optional[str] = None
    cohorte: Optional[str] = None
    is_active: Optional[bool] = True
    must_change_password: Optional[bool] = True
    password: Optional[str] = None


@primera_carga_router.post(
    "/estudiantes",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def upload_estudiantes(request, file: UploadedFile = File(...), form: UploadForm = Form(...)):
    try:
        file_content = file.read().decode("utf-8")
        result = process_estudiantes_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(ok=True, message="ImportaciÃ³n de estudiantes completada.", data=result)
        return 400, ApiResponse(ok=False, message="ImportaciÃ³n de estudiantes con errores.", data=result)
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
        return ApiResponse(ok=True, message=result.get("message", "Estudiante registrado."), data=result)
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
def upload_folios_finales(request, file: UploadedFile = File(...), form: FoliosFinalesUploadForm = Form(...)):
    try:
        file_content = file.read().decode("utf-8")
        result = process_folios_finales_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(ok=True, message="AsignaciÃ³n de folios finales completada.", data=result)
        return 400, ApiResponse(ok=False, message="AsignaciÃ³n de folios finales con errores.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al procesar el archivo: {exc}")


class EquivalenciasUploadForm(Schema):
    dry_run: bool = False


@primera_carga_router.post(
    "/equivalencias",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def upload_equivalencias(request, file: UploadedFile = File(...), form: EquivalenciasUploadForm = Form(...)):
    try:
        file_content = file.read().decode("utf-8")
        result = process_equivalencias_csv(file_content, dry_run=form.dry_run)

        if result["ok"]:
            return ApiResponse(ok=True, message="ImportaciÃ³n de equivalencias completada.", data=result)
        return 400, ApiResponse(ok=False, message="ImportaciÃ³n de equivalencias con errores.", data=result)
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al procesar el archivo: {exc}")


class RegularidadDocenteIn(Schema):
    docente_id: Optional[int] = None
    nombre: str
    dni: Optional[str] = None
    rol: Optional[str] = None
    orden: Optional[int] = None


class RegularidadFilaIn(Schema):
    orden: Optional[int] = None
    dni: str
    apellido_nombre: str
    nota_final: float
    asistencia: int
    situacion: str
    excepcion: Optional[bool] = False
    datos: Optional[Dict[str, str]] = None


class PlanillaRegularidadCreateIn(Schema):
    profesorado_id: int
    materia_id: int
    plantilla_id: int
    dictado: str
    fecha: date
    folio: Optional[str] = None
    plan_resolucion: Optional[str] = None
    observaciones: Optional[str] = None
    datos_adicionales: Optional[Dict[str, str]] = None
    docentes: Optional[List[RegularidadDocenteIn]] = None
    filas: List[RegularidadFilaIn]
    estado: Optional[str] = None
    dry_run: bool = False


@primera_carga_router.get(
    "/regularidades/metadata",
    response={200: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def regularidades_metadata(request):
    data = obtener_regularidad_metadata(request.user)
    return ApiResponse(ok=True, message="Metadata de planillas de regularidad.", data=data)


@primera_carga_router.post(
    "/regularidades/planillas",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 401: ApiResponse},
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_planilla(request, payload: PlanillaRegularidadCreateIn):
    try:
        estado = payload.estado or PlanillaRegularidad.Estado.FINAL
        if estado not in PlanillaRegularidad.Estado.values:
            return 400, ApiResponse(ok=False, message="Estado de planilla invÃ¡lido.")

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
        return 400, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al crear la planilla: {exc}")
