"""
API de Administración Centralizada de Estudiantes y Legajos.
Gestiona el ciclo de vida administrativo del alumno: desde la supervisión de
documentación física (DNI, Títulos) hasta la auditoría de legajos y
la baja administrativa bajo estrictas reglas de integridad académica.
"""

from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.common.api_schemas import ApiResponse
from apps.common.audit import log_action_from_request, snapshot
from apps.common.date_utils import format_datetime
from core.models import (
    EquivalenciaDisposicionDetalle,
    Estudiante,
    EstudianteCarrera,
    ProrrogaTituloSecundario,
    Regularidad,
    ResidenciaCondicional,
)
from core.permissions import allowed_profesorados, ensure_profesorado_access, require

from ..schemas import (
    AutorizarRendirIn,
    EstudianteAdminDetail,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
    EstudianteDocumentacionBulkUpdateIn,
    EstudianteDocumentacionListItem,
    EstudianteDocumentacionListResponse,
    EstudianteDocumentacionUpdateIn,
    ProrrogaTituloIn,
    ProrrogaTituloOut,
)
from ..services.estudiante_service import EstudianteService
from .helpers import (
    _apply_estudiante_updates,
    _build_admin_detail,
    _ensure_admin,
    _ensure_staff_view,
    _recalcular_estado_legajo,
)
from .router import estudiantes_router as router


@router.get("/admin/estudiantes/buscar-global", response=list[dict])
def admin_buscar_estudiantes_global(request, q: str = ""):
    """
    Búsqueda global de estudiantes sin restricción de carrera.
    Devuelve datos mínimos (dni, nombre, carreras actuales).
    Usado para agregar un estudiante de otra carrera a la propia.
    """
    require(request.user, "editar_estudiantes")
    from django.db.models import Q as DQ

    q = q.strip()[:100]
    if len(q) < 2:
        return []

    qs = (
        Estudiante.objects.select_related("user")
        .prefetch_related("carreras_detalle__profesorado")
        .filter(DQ(persona__dni__icontains=q) | DQ(persona__nombre__icontains=q) | DQ(persona__apellido__icontains=q))
        .order_by("persona__apellido", "persona__nombre")[:20]
    )

    result = []
    for est in qs:
        carreras = []
        for ec in est.carreras_detalle.all():
            from apps.estudiantes.api.helpers.estudiante_admin import es_carrera_visible

            if es_carrera_visible(est, ec.profesorado_id, ec.anio_ingreso, ec.estado_legajo):
                carreras.append(
                    {
                        "nombre": ec.profesorado.nombre,
                        "estado_academico": ec.get_estado_academico_display(),
                    }
                )
        result.append(
            {
                "dni": est.dni,
                "apellido": est.apellido,
                "nombre": est.nombre,
                "carreras": carreras,
            }
        )
    return result


@router.get(
    "/admin/estudiantes",
    response=EstudianteAdminListResponse,
)
def admin_list_estudiantes(
    request,
    q: str | None = None,
    carrera_id: int | None = None,
    estado_legajo: str | None = None,
    estado_academico: str | None = None,
    anio_ingreso: int | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Lista estudiantes con filtros administrativos y de carrera.
    Utiliza el servicio EstudianteService para la lógica compleja de filtrado.
    """
    _ensure_staff_view(request)
    allowed_ids = allowed_profesorados(request.user)
    filters = {
        "q": q,
        "carrera_id": carrera_id,
        "estado_legajo": estado_legajo,
        "estado_academico": estado_academico,
        "anio_ingreso": anio_ingreso,
    }
    return EstudianteService.list_estudiantes_admin(filters, limit, offset, allowed_ids)


@router.get(
    "/admin/estudiantes/anios-ingreso",
    response=list[int],
)
def admin_list_anios_ingreso(request, carrera_id: int | None = None):
    """
    Obtiene la lista de años de ingreso únicos presentes en la base de datos
    para alimentar los filtros de búsqueda.
    """
    _ensure_staff_view(request)
    allowed_ids = allowed_profesorados(request.user)

    # Si se pasa una carrera_id, debemos verificar que el usuario tenga acceso
    effective_allowed_ids = allowed_ids
    if carrera_id:
        if allowed_ids is not None and carrera_id not in allowed_ids:
            return []
        effective_allowed_ids = {carrera_id}

    return EstudianteService.get_unique_admission_years(effective_allowed_ids)


@router.get(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def admin_get_estudiante(request, dni: str):
    """Obtiene el detalle completo del legajo de un estudiante."""
    _ensure_staff_view(request)
    allowed_ids = allowed_profesorados(request.user)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")
    return _build_admin_detail(est, allowed_carrera_ids=allowed_ids)


@router.put(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def admin_update_estudiante(request, dni: str, payload: EstudianteAdminUpdateIn):
    """
    Actualiza la información base del estudiante (Perfil, Legajo, Password).
    Permite el reseteo forzado de contraseña desde la administración.
    """
    _ensure_admin(request, include_attp=True)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    # Capturar estado previo para auditoría
    before = snapshot(est)

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=True,
        allow_force_password=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    # Registrar acción en auditoría
    log_action_from_request(
        request,
        accion="UPDATE",
        tipo_accion="CRUD",
        detalle_accion=f"Actualización de datos base legajo {dni}",
        entidad="Estudiante",
        entidad_id=dni,
        before=before,
        after=est,
    )

    allowed_ids = allowed_profesorados(request.user)
    return _build_admin_detail(est, allowed_carrera_ids=allowed_ids)


@router.delete(
    "/admin/estudiantes/{dni}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def admin_delete_estudiante(request, dni: str):
    """
    Elimina físicamente a un estudiante del sistema.

    REGLA CRÍTICA DE INTEGRIDAD: Solo se permite si NO tiene historial académico.
    Se verifica: Inscripciones a materias, mesas, regularidades y actas históricas.
    """
    _ensure_admin(request)
    est = Estudiante.objects.filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    reasons = []
    # 1. Verificación de Cursadas
    ins_count = est.inscripciones_materia.exclude(estado="ANUL").count()
    if ins_count > 0:
        reasons.append(f"Tiene {ins_count} inscripciones activas.")

    # 2. Verificación de Notas y Regularidades
    reg_count = est.regularidades.count()
    if reg_count > 0:
        reasons.append(f"Tiene {reg_count} registros de regularidad/notas.")

    # 3. Verificación de Exámenes Finales
    mesas_count = est.inscripciones_mesa.count()
    if mesas_count > 0:
        reasons.append(f"Tiene {mesas_count} inscripciones a exámenes.")

    # 4. Auditoría en Actas Históricas (Datos Externos)
    from core.models import ActaExamenEstudiante

    actas_count = ActaExamenEstudiante.objects.filter(dni=dni).count()
    if actas_count > 0:
        reasons.append(f"Figura como alumno en {actas_count} actas de examen.")

    if reasons:
        msg = "No se puede eliminar: el estudiante posee historial académico irrenunciable. " + " ".join(reasons)
        return 400, ApiResponse(ok=False, message=msg)

    nombre_completo = str(est)
    user = est.user

    # Borrado en cascada (EstudianteCarrera, etc.)
    est.delete()

    # Limpieza de usuario si no tiene otros roles institucionales
    if user and not (user.is_staff or user.groups.filter(name__in=["docente", "bedel", "admin"]).exists()):
        user.delete()

    return 200, ApiResponse(ok=True, message=f"Legajo de {nombre_completo} eliminado correctamente.")


@router.post(
    "/admin/estudiantes/{dni}/reset-password",
    response=ApiResponse,
)
def admin_reset_estudiante_password(request, dni: str):
    """
    Resetea la contraseña del estudiante a una clave segura aleatoria.
    Útil cuando el alumno olvida su primer acceso o hay problemas de login masivos.
    """
    _ensure_admin(request)
    est = get_object_or_404(Estudiante, persona__dni=dni)

    # Verificar si el usuario tiene permisos para esta carrera
    allowed_ids = allowed_profesorados(request.user)
    if allowed_ids is not None:
        from core.models import EstudianteCarrera

        est_carreras_ids = set(
            EstudianteCarrera.objects.filter(estudiante=est).values_list("profesorado_id", flat=True)
        )
        if not allowed_ids.intersection(est_carreras_ids):
            from apps.common.constants import AppErrorCode
            from apps.common.errors import raise_app_error

            raise_app_error(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos para modificar este legajo.")

    new_password = EstudianteService.reset_password(est)
    if not new_password:
        return ApiResponse(ok=False, message="No se pudo resetear la contraseña (usuario no vinculado)")

    return ApiResponse(
        ok=True,
        message=f"Contraseña reseteada correctamente para {dni}: {new_password}. Copia esta contraseña y compártela de forma segura con el estudiante, ya que deberá cambiarla al primer ingreso.",
    )


@router.patch(
    "/admin/estudiantes/{dni}/autorizar-rendir",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def admin_autorizar_rendir(request, dni: str, payload: AutorizarRendirIn):
    """
    Activa o desactiva la autorización excepcional para rendir exámenes finales
    con legajo incompleto. Solo Secretaría y Bedelía pueden usar este endpoint.
    """
    require(request.user, "editar_estudiantes")
    est = get_object_or_404(Estudiante, persona__dni=dni)

    est.autorizado_rendir = payload.autorizado
    est.autorizado_rendir_observacion = payload.observacion or None

    # Procesamiento de materias autorizadas (Many-to-Many)
    if payload.autorizado:
        est.materias_autorizadas.set(payload.materias_autorizadas)
    else:
        est.materias_autorizadas.clear()

    est.save(update_fields=["autorizado_rendir", "autorizado_rendir_observacion"])

    estado = "habilitado" if payload.autorizado else "deshabilitado"
    return 200, ApiResponse(ok=True, message=f"Autorización para rendir {estado} correctamente.")


def _prorroga_to_out(p: ProrrogaTituloSecundario) -> dict:
    nombre = None
    if p.autorizado_por:
        nombre = p.autorizado_por.get_full_name() or p.autorizado_por.username
    return {
        "id": p.id,
        "fecha_otorgada": str(p.fecha_otorgada),
        "fecha_vencimiento": str(p.fecha_vencimiento),
        "observaciones": p.observaciones,
        "autorizado_por_nombre": nombre,
        "vigente": p.vigente,
        "dias_restantes": p.dias_restantes,
        "created_at": p.created_at.isoformat(),
    }


@router.get(
    "/admin/estudiantes/{dni}/prorrogas-titulo",
    response={200: list[ProrrogaTituloOut], 403: ApiResponse, 404: ApiResponse},
)
def admin_list_prorrogas_titulo(request, dni: str):
    """Lista todas las prórrogas del título secundario de un estudiante."""
    require(request.user, "editar_estudiantes")
    est = get_object_or_404(Estudiante, persona__dni=dni)
    prorrogas = ProrrogaTituloSecundario.objects.filter(estudiante=est)
    return 200, [ProrrogaTituloOut(**_prorroga_to_out(p)) for p in prorrogas]


@router.post(
    "/admin/estudiantes/{dni}/prorrogas-titulo",
    response={200: ProrrogaTituloOut, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def admin_create_prorroga_titulo(request, dni: str, payload: ProrrogaTituloIn):
    """Crea una prórroga del título secundario para el estudiante."""
    require(request.user, "gestionar_staff")
    est = get_object_or_404(Estudiante, persona__dni=dni)
    from django.utils.dateparse import parse_date

    fecha_otorgada = parse_date(payload.fecha_otorgada)
    fecha_vencimiento = parse_date(payload.fecha_vencimiento)
    if not fecha_otorgada or not fecha_vencimiento:
        return 400, ApiResponse(ok=False, message="Fechas inválidas.")
    if fecha_vencimiento <= fecha_otorgada:
        return 400, ApiResponse(
            ok=False, message="La fecha de vencimiento debe ser posterior a la fecha de otorgamiento."
        )
    p = ProrrogaTituloSecundario.objects.create(
        estudiante=est,
        fecha_otorgada=fecha_otorgada,
        fecha_vencimiento=fecha_vencimiento,
        observaciones=payload.observaciones,
        autorizado_por=request.user,
    )
    return 200, ProrrogaTituloOut(**_prorroga_to_out(p))


@router.patch(
    "/admin/prorrogas-titulo/{prorroga_id}",
    response={200: ProrrogaTituloOut, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def admin_update_prorroga_titulo(request, prorroga_id: int, payload: ProrrogaTituloIn):
    """Actualiza una prórroga existente."""
    require(request.user, "gestionar_staff")
    p = get_object_or_404(ProrrogaTituloSecundario, id=prorroga_id)
    from django.utils.dateparse import parse_date

    fecha_otorgada = parse_date(payload.fecha_otorgada)
    fecha_vencimiento = parse_date(payload.fecha_vencimiento)
    if not fecha_otorgada or not fecha_vencimiento:
        return 400, ApiResponse(ok=False, message="Fechas inválidas.")
    if fecha_vencimiento <= fecha_otorgada:
        return 400, ApiResponse(
            ok=False, message="La fecha de vencimiento debe ser posterior a la fecha de otorgamiento."
        )
    p.fecha_otorgada = fecha_otorgada
    p.fecha_vencimiento = fecha_vencimiento
    p.observaciones = payload.observaciones
    p.save(update_fields=["fecha_otorgada", "fecha_vencimiento", "observaciones", "updated_at"])
    return 200, ProrrogaTituloOut(**_prorroga_to_out(p))


@router.delete(
    "/admin/prorrogas-titulo/{prorroga_id}",
    response={200: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def admin_delete_prorroga_titulo(request, prorroga_id: int):
    """Elimina una prórroga."""
    require(request.user, "gestionar_staff")
    p = get_object_or_404(ProrrogaTituloSecundario, id=prorroga_id)
    p.delete()
    return 200, ApiResponse(ok=True, message="Prórroga eliminada.")


from ninja import Schema as _Schema


class AgregarCarreraIn(_Schema):
    profesorado_id: int
    anio_ingreso: int | None = None


@router.post(
    "/admin/estudiantes/{dni}/carreras",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def admin_agregar_carrera(request, dni: str, payload: AgregarCarreraIn):
    """Vincula a un estudiante existente con una nueva carrera (sin requerir preinscripción)."""
    require(request.user, "editar_estudiantes")
    from django.utils import timezone

    from core.models import Profesorado

    est = Estudiante.objects.filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado.")

    carrera = Profesorado.objects.filter(id=payload.profesorado_id).first()
    if not carrera:
        return 404, ApiResponse(ok=False, message="Carrera no encontrada.")

    allowed_ids = allowed_profesorados(request.user)
    if allowed_ids is not None and payload.profesorado_id not in allowed_ids:
        return 403, ApiResponse(ok=False, message="No tiene permisos para esta carrera.")

    if EstudianteCarrera.objects.filter(estudiante=est, profesorado=carrera).exists():
        return 400, ApiResponse(ok=False, message="El estudiante ya está vinculado a esa carrera.")

    anio = payload.anio_ingreso or timezone.now().year
    EstudianteCarrera.objects.create(
        estudiante=est,
        profesorado=carrera,
        anio_ingreso=anio,
        estado_academico=EstudianteCarrera.EstadoAcademico.ACTIVO,
    )

    return 200, _build_admin_detail(est, allowed_carrera_ids=allowed_ids)
