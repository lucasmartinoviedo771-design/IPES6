from __future__ import annotations

import os

from django.http import FileResponse, HttpResponse
from ninja import File
from ninja.files import UploadedFile

from apps.common.api_schemas import ApiResponse
from apps.preinscriptions.upload_utils import is_allowed, sanitize_image

from ..schemas import EstudianteAdminDetail, EstudianteAdminUpdateIn
from .helpers import _apply_estudiante_updates, _build_admin_detail, _resolve_estudiante
from .router import estudiantes_router as router


@router.get(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def estudiante_get_perfil_completar(request):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")
    return _build_admin_detail(est, request=request)


@router.put(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def estudiante_update_perfil_completar(request, payload: EstudianteAdminUpdateIn):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")

    # Evitamos que el estudiante modifique datos sensibles/administrativos
    payload.dni = None
    payload.anio_ingreso = None
    payload.cuil = None
    payload.observaciones = None
    payload.rol_extra = None
    payload.documentacion = None
    payload.curso_introductorio_aprobado = None
    payload.libreta_entregada = None

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=False,
        allow_force_password=False,
        mark_profile_complete=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)


@router.get("/perfil/foto")
def estudiante_get_foto(request):
    est = _resolve_estudiante(request)
    if not est or not est.persona:
        return HttpResponse(status=404)
    persona = est.persona
    if not persona.foto:
        return HttpResponse(status=404)
    ext = os.path.splitext(persona.foto.name)[1].lower()
    content_type_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    content_type = content_type_map.get(ext, "application/octet-stream")
    return FileResponse(persona.foto.open("rb"), content_type=content_type)


@router.post("/perfil/foto", response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse})
def estudiante_update_foto(request, file: UploadedFile = File(...)):  # noqa: B008
    est = _resolve_estudiante(request)
    if not est or not est.persona:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")
    ok_flag, err = is_allowed(file, file.size)
    if not ok_flag:
        return 400, ApiResponse(ok=False, message=err or "Formato no permitido.")
    persona = est.persona
    try:
        clean_io = sanitize_image(file)
    except ValueError as exc:
        return 400, ApiResponse(ok=False, message=str(exc))

    from django.core.files.base import ContentFile
    if persona.foto:
        persona.foto.delete(save=False)
    persona.foto.save(
        f"foto_{persona.dni}.jpg",
        ContentFile(clean_io.read()),
        save=True,
    )
    return 200, ApiResponse(ok=True, message="Foto actualizada correctamente.")
