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
from .router import alumnos_router


@alumnos_router.get(
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


@alumnos_router.get(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def admin_get_estudiante(request, dni: str):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")
    return _build_admin_detail(est)


@alumnos_router.put(
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
