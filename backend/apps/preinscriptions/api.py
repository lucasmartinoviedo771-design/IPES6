"""
API principal del módulo de Preinscripciones.
Gestiona el ciclo de vida completo de un aspirante: desde la postulación pública 
(protegida por reCAPTCHA y Honeypot) hasta la validación administrativa 
de documentación y confirmación final de vacante.
"""

import logging
import copy
from typing import Optional
from datetime import datetime
from django.db import transaction, DatabaseError, IntegrityError
from django.db.models import Q
from ninja.errors import HttpError

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
from .views_pdf import preinscripcion_pdf

logger = logging.getLogger(__name__)

# Grupos de seguridad para decoradores de permisos
PREINS_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}
DOC_ALLOWED_ROLES = {"admin", "secretaria", "bedel", "coordinador", "jefes"}


class AllowPublic:
    """Soporte para endpoints Ninja con acceso anónimo explícito."""
    def __call__(self, request):
        return True


def check_roles(request, roles, profesorado_id=None):
    """Atajo para validar roles y acceso restringido por carrera."""
    ensure_roles(request.user, roles)
    if profesorado_id is not None:
        ensure_profesorado_access(request.user, profesorado_id, role_filter=roles)


@router.get("/carreras", response=ApiResponse, auth=AllowPublic())
def listar_carreras(request, vigentes: bool = True, profesorado_id: Optional[int] = None):
    """
    Lista las carreras disponibles para ingreso.
    Endpoint público consumido por el formulario de inscripción inicial.
    """
    try:
        from core.models import Profesorado
        qs = Profesorado.objects.all().order_by("nombre")
        if vigentes:
            qs = qs.filter(activo=True, inscripcion_abierta=True)
        data = [{"id": c.id, "nombre": c.nombre} for c in qs]
        return ApiResponse(ok=True, message=f"{len(data)} carreras disponibles.", data=data)
    except DatabaseError as e:
        logger.exception("Error listando carreras publicas.")
        raise HttpError(500, "No se pudieron recuperar las carreras.") from e


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
    """
    Listado administrativo de solicitudes con filtros avanzados y paginación.
    Permite buscar por DNI, nombre o código de preinscripción.
    """
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)

    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    
    qs = Preinscripcion.objects.select_related(
        "alumno__user", "carrera"
    ).all().order_by("-created_at")

    if not include_inactivas:
        qs = qs.filter(activa=True)
    if exclude_confirmed:
        qs = qs.exclude(estado="Confirmada")
    if profesorado_id:
        qs = qs.filter(carrera_id=profesorado_id)
    if anio:
        qs = qs.filter(anio=anio)
        
    if search:
        search = search[:100]
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
    """Detalle completo de una solicitud específica."""
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.select_related("alumno__user", "carrera").filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Solicitud no encontrada.")
    return pre


@router.get("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
def obtener_checklist(request, pre_id: int, profesorado_id: Optional[int] = None):
    """Recupera la lista de verificación de requisitos documentales del aspirante."""
    from core.models import Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada.")
    cl = getattr(pre, "checklist", None)
    if not cl:
        cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
    return cl


@router.delete("/{pre_id}", response={204: None, 404: ApiResponse}, auth=JWTAuth())
@transaction.atomic
def eliminar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    """Inactivación lógica de una solicitud (Soft Delete)."""
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        return 404, ApiResponse(ok=False, message="No encontrada.")
    pre.activa = False
    pre.estado = "Borrador"
    pre.save(update_fields=["activa", "estado"])
    return 204, None


@router.post("/{pre_id}/activar", response=PreinscripcionOut, auth=JWTAuth())
@transaction.atomic
def activar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    """Re-activa una solicitud que fue previamente marcada como inactiva."""
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Solicitud no encontrada.")
    pre.activa = True
    pre.estado = "Enviada"
    pre.save(update_fields=["activa", "estado"])
    return pre

@router.post("", response=ApiResponse)
def crear_o_actualizar(request, payload: PreinscripcionIn, profesorado_id: Optional[int] = None):
    """
    Alta de preinscripción (Flujo Público).
    Implementa: Rate Limit, Honeypot, Ventana Temporal y reCAPTCHA.
    """
    check_rate_limit(request)
    if payload.honeypot:
        raise HttpError(400, "Solicitud rechazada (Bot Detection).")

    if not ventana_preinscripcion_activa():
        raise HttpError(403, "El período de preinscripción está cerrado.")

    if not verify_recaptcha(getattr(payload, "captcha_token", None), client_ip(request)):
        raise HttpError(400, "Error en validación de seguridad (CAPTCHA).")

    preinscripcion = PreinscripcionService.create_or_update_preinscripcion(payload)
    return ApiResponse(ok=True, message="Solicitud enviada correctamente.", data={
        "id": preinscripcion.id,
        "codigo": preinscripcion.codigo,
        "estado": preinscripcion.estado,
    })

@router.post("/preview-pdf/", auth=AllowPublic())
def preview_pdf(request, payload: PreinscripcionIn):
    """
    Genera una vista previa del PDF con datos no guardados.
    Permite al aspirante revisar el diseño antes de confirmar datos sensibles.
    """
    from .views_pdf import render_to_string
    from weasyprint import HTML
    from django.http import HttpResponse
    from core.models import Profesorado
    import os
    from django.conf import settings

    carrera = Profesorado.objects.filter(id=payload.carrera_id).first()
    carrera_nombre = carrera.nombre if carrera else "Carrera no especificada"

    # Preparar el mismo contexto que la vista oficial
    # El payload tiene estudiante anidado — aplanamos para la plantilla
    raw = payload.dict()
    est = raw.get("estudiante") or {}
    v = {
        "apellido": (est.get("apellido") or "").upper(),
        "nombres": est.get("nombres") or "",
        "dni": est.get("dni") or "",
        "cuil": est.get("cuil") or "",
        "fecha_nacimiento": str(est.get("fecha_nacimiento") or ""),
        "email": est.get("email") or "",
        "tel_movil": est.get("telefono") or "",
        "domicilio": est.get("domicilio") or "",
        # datos extra planos
        "nacionalidad": raw.get("nacionalidad"),
        "estado_civil": raw.get("estado_civil"),
        "localidad_nac": raw.get("localidad_nac"),
        "provincia_nac": raw.get("provincia_nac"),
        "pais_nac": raw.get("pais_nac"),
        "emergencia_telefono": raw.get("emergencia_telefono"),
        "emergencia_parentesco": raw.get("emergencia_parentesco"),
        "trabaja": raw.get("trabaja"),
        "empleador": raw.get("empleador"),
        "horario_trabajo": raw.get("horario_trabajo"),
        # Estudios secundarios
        "sec_titulo": raw.get("sec_titulo"),
        "sec_establecimiento": raw.get("sec_establecimiento"),
        "sec_fecha_egreso": str(raw.get("sec_fecha_egreso") or ""),
        "sec_localidad": raw.get("sec_localidad"),
        "sec_provincia": raw.get("sec_provincia"),
        "sec_pais": raw.get("sec_pais"),
        # Estudios superiores
        "sup1_titulo": raw.get("sup1_titulo"),
        "sup1_establecimiento": raw.get("sup1_establecimiento"),
        "sup1_fecha_egreso": str(raw.get("sup1_fecha_egreso") or ""),
        "sup1_localidad": raw.get("sup1_localidad"),
        "sup1_provincia": raw.get("sup1_provincia"),
        "sup1_pais": raw.get("sup1_pais"),
        # Laboral
        "domicilio_trabajo": raw.get("domicilio_trabajo"),
        # Accesibilidad
        "cud_informado": raw.get("cud_informado"),
        "condicion_salud_informada": raw.get("condicion_salud_informada"),
        "condicion_salud_detalle": raw.get("condicion_salud_detalle"),
        "consentimiento_datos": raw.get("consentimiento_datos", True),
    }
    
    checklist_items = [
        {"label": "Fotocopia legalizada DNI", "checked": False},
        {"label": "Copia legalizada Analítico", "checked": False},
        {"label": "2 fotos carnet 4x4", "checked": False},
        {"label": "Título Secundario", "checked": False},
        {"label": "Certificado Alumno Regular", "checked": False},
        {"label": "Certificado Título en Trámite", "checked": False},
        {"label": "Certificado Buena Salud", "checked": False},
        {"label": "3 Folios Oficio", "checked": False},
    ]

    # Rutas para recursos estáticos (Encabezado Universal)
    logo_left_path = os.path.join(settings.BASE_DIR, "static/logos/escudo_ministerio_tdf.png")
    logo_right_path = os.path.join(settings.BASE_DIR, "static/logos/logo_ipes.jpg")
    
    if not os.path.exists(logo_left_path):
        logo_left_path = os.path.join(settings.BASE_DIR, "backend/static/logos/escudo_ministerio_tdf.png")
        logo_right_path = os.path.join(settings.BASE_DIR, "backend/static/logos/logo_ipes.jpg")

    context = {
        "v": v,
        "carrera_nombre": carrera_nombre,
        "checklist_items": checklist_items,
        "logo_left_path": logo_left_path,
        "logo_right_path": logo_right_path,
        "photo_url": raw.get("foto_4x4_dataurl") or raw.get("foto_dataUrl"),
    }

    html = render_to_string("core/preinscripcion_premium.html", context)
    pdf_content = HTML(string=html, base_url=request.build_absolute_uri("/")).write_pdf()

    response = HttpResponse(pdf_content, content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="Vista_Previa_Preinscripcion.pdf"'
    return response


@router.post("/by-code/{codigo}/confirmar", response=ApiResponse, auth=JWTAuth())
def confirmar_por_codigo(request, codigo: str, payload: ChecklistIn | None = None, profesorado_id: Optional[int] = None):
    """Confirma la vacante y sincroniza el checklist de documentación."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    res = PreinscripcionService.confirm_preinscripcion(pre, payload.dict() if payload else None)
    return ApiResponse(ok=True, message="Inscripción confirmada con éxito.", data=res)


def _serialize_requisito(req) -> RequisitoDocumentacionOut:
    """Serializador auxiliar para requisitos de documentación."""
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
    """Obtiene los requisitos de ingreso para una carrera, sincronizando con la base global."""
    from core.models import Profesorado
    ensure_roles(request.user, DOC_ALLOWED_ROLES)
    ensure_profesorado_access(request.user, prof_id, role_filter=DOC_ALLOWED_ROLES)
    
    profesorado = Profesorado.objects.filter(id=prof_id).first()
    if not profesorado:
        raise HttpError(404, "Carrera no encontrada.")
        
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
    """Permite personalizar manualmenten los requisitos de documentación de una carrera."""
    from core.models import Profesorado, ProfesoradoRequisitoDocumentacion
    ensure_roles(request.user, DOC_ALLOWED_ROLES)
    ensure_profesorado_access(request.user, prof_id, role_filter=DOC_ALLOWED_ROLES)
    
    profesorado = Profesorado.objects.filter(id=prof_id).first()
    if not profesorado:
        raise HttpError(404, "Profesorado no encontrado.")

    qs = sync_profesorado_requisitos(profesorado).select_related("template")
    requisitos = {req.id: req for req in qs}

    if not payload:
        return [_serialize_requisito(req) for req in requisitos.values()]

    for item in payload:
        req = requisitos.get(item.id)
        if not req:
            raise HttpError(400, f"ID inexistente: {item.id}")

        # Reversión a valores de template si se des-personaliza
        if item.personalizado is False and req.template:
            if req.personalizado:
                req.personalizado = False
                req.save(update_fields=["personalizado", "updated_at"])
            req.aplicar_template(force=True)
            continue

        cambios: list[str] = []
        campos = ["titulo", "descripcion", "obligatorio", "activo", "orden"]
        for campo in campos:
            val = getattr(item, campo)
            if val is not None and val != getattr(req, campo):
                setattr(req, campo, val)
                cambios.append(campo)

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
    """Busca una solicitud específica por su código de seguridad."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    return serialize_pre(pre)


@router.get("/estudiante/{dni}", auth=JWTAuth())
def listar_por_estudiante(request, dni: str, profesorado_id: Optional[int] = None):
    """Busca todas las preinscripciones asociadas a un DNI."""
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
    """Permite inscribir a un aspirante existente en una carrera adicional."""
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
            message="El estudiante ya tiene una preinscripción activa para esa carrera.",
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
        logger.exception("Conflicto al duplicar preinscripción para carrera %s", carrera.id)
        raise HttpError(409, "Ya existe una preinscripción para esa combinación.") from e
    except DatabaseError as e:
        logger.exception("Error de BD al agregar carrera.")
        raise HttpError(500, "No se pudo procesar la solicitud.") from e

    return ApiResponse(
        ok=True,
        message="Carrera agregada exitosamente.",
        data=serialize_pre(nueva),
    )


@router.put("/by-code/{codigo}", auth=JWTAuth())
@transaction.atomic
def actualizar_por_codigo(request, codigo: str, payload: PreinscripcionUpdateIn, profesorado_id: Optional[int] = None):
    """Actualización integral de datos de identidad, contacto, académicos y checklist."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    
    if payload.estudiante:
        est = payload.estudiante
        u = pre.alumno.user
        u.first_name = est.nombres or u.first_name
        u.last_name = est.apellido or u.last_name
        if est.email:
            u.email = est.email
        u.save()
        
        p = pre.alumno.persona
        if est.telefono is not None: p.telefono = est.telefono
        if est.domicilio is not None: p.domicilio = est.domicilio
        if est.fecha_nacimiento: p.fecha_nacimiento = est.fecha_nacimiento
        p.save()
        
        if est.cuil:
            pre.cuil = est.cuil

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
    except (IntegrityError, DatabaseError) as e:
        logger.exception("Error guardando cambios manuales en preinscripción %s", pre.id)
        raise HttpError(500, "Error de persistencia en base de datos.") from e
    return serialize_pre(pre)


@router.post("/by-code/{codigo}/observar", auth=JWTAuth())
def observar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    """Cambia el estado a 'Observada'."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    pre.estado = "Observada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Actualizado a Observada."}


@router.post("/by-code/{codigo}/rechazar", auth=JWTAuth())
def rechazar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    """Cambia el estado a 'Rechazada'."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    pre.estado = "Rechazada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Actualizado a Rechazada."}


@router.post("/by-code/{codigo}/cambiar-carrera", auth=JWTAuth())
def cambiar_carrera(request, codigo: str, carrera_id: int, profesorado_id: Optional[int] = None):
    """Mueve la preinscripción a una carrera diferente preservando el expediente."""
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = PreinscripcionService.get_by_codigo(codigo)
    updated_pre, error_msg = PreinscripcionService.cambiar_carrera(pre, carrera_id)
    if error_msg:
        from apps.common.api_schemas import ApiResponse as _ApiResponse
        return 400, _ApiResponse(ok=False, message=error_msg)
    return serialize_pre(updated_pre)
