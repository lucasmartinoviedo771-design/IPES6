from datetime import date

from ninja import File, Form, Router, Schema
from ninja.files import UploadedFile

from apps.alumnos.schemas import (
    EquivalenciaDisposicionCreateIn,
    EquivalenciaDisposicionOut,
)
from apps.alumnos.services.equivalencias_disposicion import (
    registrar_disposicion_equivalencia,
    resolver_contexto_equivalencia,
    serialize_disposicion,
)
from apps.common.api_schemas import ApiResponse
from apps.primera_carga.services import (
    crear_estudiante_manual,
    crear_planilla_regularidad,
    obtener_regularidad_metadata,
    process_equivalencias_csv,
    process_estudiantes_csv,
    process_folios_finales_csv,
)
from core.auth_ninja import JWTAuth, ensure_roles
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
    nota_final: float
    asistencia: int
    situacion: str
    excepcion: bool | None = False
    datos: dict[str, str] | None = None


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
        return 400, ApiResponse(ok=False, message=str(exc))
    except Exception as exc:
        return 400, ApiResponse(ok=False, message=f"Error al crear la planilla: {exc}")
