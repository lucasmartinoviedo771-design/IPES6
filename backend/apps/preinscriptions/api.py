from typing import Optional
import logging
from datetime import datetime

from django.db import transaction, DatabaseError, IntegrityError
from django.db.models import Q
from ninja.errors import HttpError
import copy

from .router import preins_router as router

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.permissions import ensure_profesorado_access, ensure_roles

from .schemas import (
    ChecklistIn,
    ChecklistOut,
    NuevaCarreraIn,
    PreinscripcionIn,
    PreinscripcionOut,
    PreinscripcionPaginatedOut,
    PreinscripcionUpdateIn,
    RequisitoDocumentacionOut,
    RequisitoDocumentacionUpdateIn,
)
from .services.requisitos import sync_profesorado_requisitos
from .services.rate_limiting import check_rate_limit, client_ip, verify_recaptcha
from .services.ventanas import ventana_preinscripcion_activa
from .services.serializers import serialize_pre
from .services.preinscripcion_service import PreinscripcionService

logger = logging.getLogger(__name__)

PREINS_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}
DOC_ALLOWED_ROLES = {"admin", "secretaria", "bedel", "coordinador", "jefes"}


class AllowPublic:
    def __call__(self, request):
        return True


def check_roles(request, roles, profesorado_id=None):
    ensure_roles(request.user, roles)
    if profesorado_id is not None:
        ensure_profesorado_access(request.user, profesorado_id, role_filter=roles)


@router.get("/carreras", response=ApiResponse, auth=AllowPublic())
def listar_carreras(request, vigentes: bool = True, profesorado_id: Optional[int] = None):
    try:
        from core.models import Profesorado
        qs = Profesorado.objects.all().order_by("nombre")
        if vigentes:
            qs = qs.filter(activo=True, inscripcion_abierta=True)
        data = [{"id": c.id, "nombre": c.nombre} for c in qs]
        return ApiResponse(ok=True, message=f"{len(data)} carreras", data=data)
    except DatabaseError as e:
        logger.exception("Error listando carreras")
        raise HttpError(500, "No se pudieron listar las carreras") from e


@router.get("/", response=PreinscripcionPaginatedOut, auth=JWTAuth())
def listar_preinscripciones(
    request,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
    include_inactivas: bool = False,
    profesorado_id: Optional[int] = None,
    anio: Optional[int] = None,
    exclude_confirmed: bool = False,
):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)

    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    if search:
        search = search[:100]

    qs = Preinscripcion.objects.select_related("alumno__user", "carrera").all().order_by("-created_at")

    if not include_inactivas:
        qs = qs.filter(activa=True)
    if exclude_confirmed:
        qs = qs.exclude(estado="Confirmada")
    if profesorado_id:
        qs = qs.filter(carrera_id=profesorado_id)
    if anio:
        qs = qs.filter(anio=anio)
    if search:
        qs = qs.filter(
            Q(codigo__icontains=search)
            | Q(alumno__user__first_name__icontains=search)
            | Q(alumno__user__last_name__icontains=search)
            | Q(alumno__persona__dni__icontains=search)
        )

    total = qs.count()
    qs = qs[offset: offset + limit]
    return {"count": total, "results": list(qs)}


@router.get("/{pre_id}", response=PreinscripcionOut, auth=JWTAuth())
def obtener_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.select_related("alumno__user", "carrera").filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    return pre


@router.get("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
def obtener_checklist(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl = getattr(pre, "checklist", None)
    if not cl:
        cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
    return cl


@router.delete("/{pre_id}", response={204: None, 404: ApiResponse}, auth=JWTAuth())
@transaction.atomic
def eliminar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        return 404, ApiResponse(ok=False, message="No encontrada")
    pre.activa = False
    pre.estado = "Borrador"
    pre.save(update_fields=["activa", "estado"])
    return 204, None


@router.post("/{pre_id}/activar", response=PreinscripcionOut, auth=JWTAuth())
@transaction.atomic
def activar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    pre.activa = True
    pre.estado = "Enviada"
    pre.save(update_fields=["activa", "estado"])
    return pre


@router.post("", response=ApiResponse)
def crear_o_actualizar(request, payload: PreinscripcionIn, profesorado_id: Optional[int] = None):
    check_rate_limit(request)
    if payload.honeypot:
        raise HttpError(400, "Solicitud inválida.")

    if not ventana_preinscripcion_activa():
        raise HttpError(403, "El período de preinscripción no está habilitado actualmente.")

    if not verify_recaptcha(getattr(payload, "captcha_token", None), client_ip(request)):
        raise HttpError(400, "Fallo validación reCAPTCHA.")

    preinscripcion = PreinscripcionService.create_or_update_preinscripcion(payload)
    return ApiResponse(ok=True, message="Preinscripción enviada", data={
        "id": preinscripcion.id,
        "codigo": preinscripcion.codigo,
        "estado": preinscripcion.estado,
    })


@router.post("/by-code/{codigo}/confirmar", response=ApiResponse, auth=JWTAuth())
def confirmar_por_codigo(request, codigo: str, payload: ChecklistIn | None = None, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    res = PreinscripcionService.confirm_preinscripcion(pre, payload.dict() if payload else None)
    return ApiResponse(ok=True, message="Preinscripción confirmada", data=res)


def _serialize_requisito(req) -> RequisitoDocumentacionOut:
    return RequisitoDocumentacionOut(
        id=req.id,
        codigo=req.codigo,
        titulo=req.titulo,
        descripcion=req.descripcion or "",
        categoria=req.categoria,
        categoria_display=req.get_categoria_display(),
        obligatorio=req.obligatorio,
        orden=req.orden,
        activo=req.activo,
        personalizado=req.personalizado,
    )


@router.get(
    "/profesorados/{prof_id}/requisitos-documentacion",
    response=list[RequisitoDocumentacionOut],
    auth=JWTAuth(),
)
def listar_requisitos_documentacion(request, prof_id: int, profesorado_id: Optional[int] = None):
    from core.models import Profesorado
    ensure_roles(request.user, DOC_ALLOWED_ROLES)
    ensure_profesorado_access(request.user, prof_id, role_filter=DOC_ALLOWED_ROLES)
    profesorado = Profesorado.objects.filter(id=prof_id).first()
    if not profesorado:
        raise HttpError(404, "Profesorado no encontrado")
    qs = sync_profesorado_requisitos(profesorado).order_by("categoria", "orden", "codigo")
    return [_serialize_requisito(req) for req in qs]


@router.put(
    "/profesorados/{prof_id}/requisitos-documentacion",
    response=list[RequisitoDocumentacionOut],
    auth=JWTAuth(),
)
def actualizar_requisitos_documentacion(
    request, prof_id: int,
    payload: list[RequisitoDocumentacionUpdateIn], profesorado_id: Optional[int] = None,
):
    from core.models import Profesorado, ProfesoradoRequisitoDocumentacion
    ensure_roles(request.user, DOC_ALLOWED_ROLES)
    ensure_profesorado_access(request.user, prof_id, role_filter=DOC_ALLOWED_ROLES)
    profesorado = Profesorado.objects.filter(id=prof_id).first()
    if not profesorado:
        raise HttpError(404, "Profesorado no encontrado")

    qs = sync_profesorado_requisitos(profesorado).select_related("template")
    requisitos = {req.id: req for req in qs}

    if not payload:
        return [_serialize_requisito(req) for req in requisitos.values()]

    for item in payload:
        req = requisitos.get(item.id)
        if not req:
            raise HttpError(400, f"Requisito desconocido: {item.id}")

        if item.personalizado is False and req.template:
            if req.personalizado:
                req.personalizado = False
                req.save(update_fields=["personalizado", "updated_at"])
            req.aplicar_template(force=True)
            continue

        cambios: list[str] = []
        if item.titulo is not None and item.titulo != req.titulo:
            req.titulo = item.titulo
            cambios.append("titulo")
        if item.descripcion is not None and item.descripcion != req.descripcion:
            req.descripcion = item.descripcion
            cambios.append("descripcion")
        if item.obligatorio is not None and item.obligatorio != req.obligatorio:
            req.obligatorio = item.obligatorio
            cambios.append("obligatorio")
        if item.activo is not None and item.activo != req.activo:
            req.activo = item.activo
            cambios.append("activo")
        if item.orden is not None and item.orden != req.orden:
            req.orden = item.orden
            cambios.append("orden")

        if item.personalizado is True and not req.personalizado:
            req.personalizado = True
            cambios.append("personalizado")

        if cambios:
            if "personalizado" not in cambios and not req.personalizado:
                req.personalizado = True
                cambios.append("personalizado")
            if "updated_at" not in cambios:
                cambios.append("updated_at")
            req.save(update_fields=cambios)

    return [
        _serialize_requisito(req)
        for req in ProfesoradoRequisitoDocumentacion.objects.filter(profesorado=profesorado)
        .select_related("template")
        .order_by("categoria", "orden", "codigo")
    ]


@router.get("/by-code/{codigo}", auth=JWTAuth())
def obtener_por_codigo(request, codigo: str, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    return serialize_pre(pre)


@router.get("/estudiante/{dni}", auth=JWTAuth())
def listar_por_estudiante(request, dni: str, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    preins = (
        Preinscripcion.objects.select_related("alumno__user", "carrera")
        .filter(alumno__persona__dni=dni)
        .order_by("-anio", "-created_at")
    )
    return [serialize_pre(p) for p in preins]


@router.post(
    "/by-code/{codigo}/carreras",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@transaction.atomic
def agregar_carrera(request, codigo: str, payload: NuevaCarreraIn, profesorado_id: Optional[int] = None):
    from core.models import Profesorado, Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    carrera = Profesorado.objects.filter(id=payload.carrera_id).first()
    if not carrera:
        return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")

    anio = payload.anio or datetime.now().year
    if Preinscripcion.objects.filter(
        alumno=pre.alumno,
        carrera_id=carrera.id,
        anio=anio,
        activa=True,
    ).exists():
        return 400, ApiResponse(
            ok=False,
            message="El estudiante ya tiene una preinscripción activa para esa carrera en el ciclo actual.",
        )

    try:
        with transaction.atomic():
            datos_extra = copy.deepcopy(pre.datos_extra or {})
            nueva_kwargs = {
                "alumno": pre.alumno,
                "carrera": carrera,
                "anio": anio,
                "estado": "Enviada",
                "activa": True,
                "datos_extra": datos_extra,
                "cuil": pre.cuil,
            }
            foto_4x4 = getattr(pre, "foto_4x4_dataurl", None)
            if foto_4x4:
                nueva_kwargs["foto_4x4_dataurl"] = foto_4x4
            nueva = Preinscripcion.objects.create(**nueva_kwargs)
            nueva.codigo = f"PRE-{datetime.now().year}-{nueva.id:04d}"
            nueva.save(update_fields=["codigo"])
            PreinscripcionChecklist.objects.create(preinscripcion=nueva)
    except IntegrityError as e:
        logger.exception("Conflicto al agregar profesorado %s al estudiante %s", carrera.id, pre.alumno_id)
        raise HttpError(409, "Ya existe una preinscripción para esa combinación.") from e
    except DatabaseError as e:
        logger.exception("No se pudo agregar profesorado %s al estudiante %s", carrera.id, pre.alumno_id)
        raise HttpError(500, "No se pudo procesar la solicitud.") from e

    return ApiResponse(
        ok=True,
        message="Se agregó un nuevo profesorado para el estudiante.",
        data=serialize_pre(nueva),
    )


@router.put("/by-code/{codigo}", auth=JWTAuth())
@transaction.atomic
def actualizar_por_codigo(request, codigo: str, payload: PreinscripcionUpdateIn, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    if payload.estudiante:
        estudiante = payload.estudiante
        u = pre.alumno.user
        u.first_name = estudiante.nombres or u.first_name
        u.last_name = estudiante.apellido or u.last_name
        if estudiante.email:
            u.email = estudiante.email
        u.save()
        a = pre.alumno
        if estudiante.telefono is not None:
            a.telefono = estudiante.telefono
        if estudiante.domicilio is not None:
            a.domicilio = estudiante.domicilio
        if estudiante.fecha_nacimiento:
            a.fecha_nacimiento = estudiante.fecha_nacimiento
        a.save()
        if estudiante.cuil:
            pre.cuil = estudiante.cuil

    if payload.carrera_id:
        pre.carrera_id = payload.carrera_id
    if payload.datos_extra:
        pre.datos_extra = payload.datos_extra

    if payload.checklist:
        from core.models import PreinscripcionChecklist
        cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
        for k, v in payload.checklist.dict().items():
            setattr(cl, k, v)
        cl.save()
        PreinscripcionService.sync_curso_intro_flag(pre.alumno, payload.checklist.curso_introductorio_aprobado)

    try:
        pre.save()
    except IntegrityError as e:
        logger.exception("Conflicto al guardar preinscripción %s", pre.id)
        raise HttpError(409, "No se pudo guardar: conflicto de datos.") from e
    except DatabaseError as e:
        logger.exception("Error de BD al guardar preinscripción %s", pre.id)
        raise HttpError(500, "Error interno al guardar la preinscripción.") from e
    return serialize_pre(pre)


@router.post("/by-code/{codigo}/observar", auth=JWTAuth())
def observar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    pre.estado = "Observada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Observada"}


@router.post("/by-code/{codigo}/rechazar", auth=JWTAuth())
def rechazar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    pre.estado = "Rechazada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Rechazada"}


@router.post("/by-code/{codigo}/cambiar-carrera", auth=JWTAuth())
def cambiar_carrera(request, codigo: str, carrera_id: int, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    updated_pre, error_msg = PreinscripcionService.cambiar_carrera(pre, carrera_id)
    if error_msg:
        from apps.common.api_schemas import ApiResponse as _ApiResponse
        return 400, _ApiResponse(ok=False, message=error_msg)
    return serialize_pre(updated_pre)
