from __future__ import annotations

from django.db.models import Q

from apps.common.api_schemas import ApiResponse
from core.models import Estudiante

from ..schemas import (
    EstudianteAdminDetail,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
)
from .helpers import _apply_estudiante_updates, _build_admin_detail, _ensure_admin
from .router import estudiantes_router


@estudiantes_router.get(
    "/admin/estudiantes",
    response=EstudianteAdminListResponse,
)
def admin_list_estudiantes(
    request,
    q: str | None = None,
    carrera_id: int | None = None,
    estado_legajo: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _ensure_admin(request)
    qs = (
        Estudiante.objects.select_related("user")
        .prefetch_related("carreras")
        .order_by("user__last_name", "user__first_name", "dni")
    )
    if q:
        q_clean = q.strip()
        if q_clean:
            qs = qs.filter(
                Q(dni__icontains=q_clean)
                | Q(user__first_name__icontains=q_clean)
                | Q(user__last_name__icontains=q_clean)
                | Q(legajo__icontains=q_clean)
            )
    if carrera_id:
        qs = qs.filter(carreras__id=carrera_id)
    if estado_legajo:
        qs = qs.filter(estado_legajo=estado_legajo.upper())

    total = qs.count()
    qs = qs[offset : offset + limit] if limit else qs[offset:]

    items = []
    for est in qs:
        user = est.user if est.user_id else None
        items.append(
            EstudianteAdminListItem(
                dni=est.dni,
                apellido=user.last_name if user else "",
                nombre=user.first_name if user else "",
                email=user.email if user else None,
                telefono=est.telefono or None,
                estado_legajo=est.estado_legajo,
                estado_legajo_display=est.get_estado_legajo_display(),
                carreras=[c.nombre for c in est.carreras.all()],
                legajo=est.legajo or None,
            )
        )
    return EstudianteAdminListResponse(total=total, items=items)


@estudiantes_router.get(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def admin_get_estudiante(request, dni: str):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")
    return _build_admin_detail(est)


@estudiantes_router.put(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def admin_update_estudiante(request, dni: str, payload: EstudianteAdminUpdateIn):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=True,
        allow_force_password=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)


@estudiantes_router.delete(
    "/admin/estudiantes/{dni}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def admin_delete_estudiante(request, dni: str):
    _ensure_admin(request)
    # Buscamos por DNI
    est = Estudiante.objects.filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    # --- Verificaciones de actividad previa ---
    reasons = []

    # 1. Inscripciones a materias confirmadas o pendientes
    ins_count = est.inscripciones_materia.exclude(estado="ANUL").count()
    if ins_count > 0:
        ejemplos = list(est.inscripciones_materia.exclude(estado="ANUL")[:2].values_list("materia__nombre", flat=True))
        txt_ej = f" (ej: {', '.join(ejemplos)})" if ejemplos else ""
        reasons.append(f"Tiene {ins_count} inscripciones activas a materias{txt_ej}.")

    # 2. Regularidades cargadas
    reg_count = est.regularidades.count()
    if reg_count > 0:
        ejemplos = list(est.regularidades.all()[:2].values_list("materia__nombre", flat=True))
        txt_ej = f" (ej: {', '.join(ejemplos)})" if ejemplos else ""
        reasons.append(f"Tiene {reg_count} notas de cursada/regularidades{txt_ej}.")

    # 3. Inscripciones a mesas o exámenes
    mesas_count = est.inscripciones_mesa.count()
    if mesas_count > 0:
        reasons.append(f"Tiene {mesas_count} inscripciones a mesas de examen.")

    # 4. Actas de examen históricas (por DNI)
    from core.models import ActaExamenEstudiante
    actas_count = ActaExamenEstudiante.objects.filter(dni=dni).count()
    if actas_count > 0:
        reasons.append(f"Figura en {actas_count} actas de examen históricas.")

    # 5. Preinscripción activa
    from core.models import Preinscripcion
    pre = Preinscripcion.objects.filter(alumno=est).first()
    if pre and pre.estado not in ["ANULADA"]:
        reasons.append(f"Tiene una preinscripción activa ({pre.codigo}) en estado {pre.get_estado_display()}.")

    if reasons:
        msg = "No se puede eliminar al estudiante porque ya tiene actividad en el sistema: " + " ".join(reasons)
        return 400, ApiResponse(ok=False, message=msg)

    # --- Fin verificaciones ---

    nombre_completo = str(est)
    user = est.user

    # Al borrar el estudiante, se borran en cascada sus relaciones (EstudianteCarrera, etc.)
    # Las que no bloqueamos arriba pero podrían existir (ej. mensajes, notificaciones).
    est.delete()

    # Si el usuario no tiene otros roles (como staff o docente), lo borramos también para limpiar.
    if user and not (user.is_staff or user.groups.filter(name__in=["docente", "bedel", "admin"]).exists()):
        user.delete()

    return 200, ApiResponse(ok=True, message=f"Estudiante {nombre_completo} eliminado correctamente")
