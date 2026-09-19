from __future__ import annotations

import os

from django.http import FileResponse, HttpResponse
from ninja import File
from ninja.files import UploadedFile

from apps.common.api_schemas import ApiResponse
from apps.preinscriptions.upload_utils import is_allowed, sanitize_image

from ..schemas import EstudianteAdminDetail, EstudianteAdminUpdateIn, PerfilEstudianteUpdateIn
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
def estudiante_update_perfil_completar(request, payload: PerfilEstudianteUpdateIn):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")

    # Mapeo estricto de campos de autoservicio para asegurar que campos administrativos
    # (dni, cuil, nombre, apellido, email, activo, estado_legajo, must_change_password,
    # carreras_update, documentacion, curso_introductorio_aprobado, libreta_entregada, etc.)
    # nunca puedan ser alterados por el estudiante.
    admin_payload = EstudianteAdminUpdateIn(
        telefono=payload.telefono,
        domicilio=payload.domicilio,
        fecha_nacimiento=payload.fecha_nacimiento,
        lugar_nacimiento=payload.lugar_nacimiento,
        genero=payload.genero,
        nacionalidad=payload.nacionalidad,
        estado_civil=payload.estado_civil,
        localidad_nac=payload.localidad_nac,
        provincia_nac=payload.provincia_nac,
        pais_nac=payload.pais_nac,
        emergencia_telefono=payload.emergencia_telefono,
        emergencia_parentesco=payload.emergencia_parentesco,
        sec_titulo=payload.sec_titulo,
        sec_establecimiento=payload.sec_establecimiento,
        sec_fecha_egreso=payload.sec_fecha_egreso,
        sec_localidad=payload.sec_localidad,
        sec_provincia=payload.sec_provincia,
        sec_pais=payload.sec_pais,
        sup1_titulo=payload.sup1_titulo,
        sup1_establecimiento=payload.sup1_establecimiento,
        sup1_fecha_egreso=payload.sup1_fecha_egreso,
        sup1_localidad=payload.sup1_localidad,
        sup1_provincia=payload.sup1_provincia,
        sup1_pais=payload.sup1_pais,
        cud_informado=payload.cud_informado,
        condicion_salud_informada=payload.condicion_salud_informada,
        condicion_salud_detalle=payload.condicion_salud_detalle,
        trabaja=payload.trabaja,
        empleador=payload.empleador,
        horario_trabajo=payload.horario_trabajo,
        domicilio_trabajo=payload.domicilio_trabajo,
    )

    updated, error = _apply_estudiante_updates(
        est,
        admin_payload,
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
