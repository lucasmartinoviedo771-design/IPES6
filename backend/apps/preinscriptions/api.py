from typing import Optional
import copy
import logging
from datetime import date, datetime

import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Q  # Importar Q
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import VentanaHabilitacion
from core.permissions import ensure_profesorado_access, ensure_roles

from .schemas import (
    ChecklistIn,
    ChecklistOut,
    NuevaCarreraIn,
    PreinscripcionIn,
    PreinscripcionOut,
    PreinscripcionUpdateIn,
    RequisitoDocumentacionOut,
    RequisitoDocumentacionUpdateIn,
)
from .services.requisitos import sync_profesorado_requisitos


# Helper function to convert dates in a dictionary to ISO format strings
def convert_dates_to_iso(data_dict):
    for key, value in data_dict.items():
        if isinstance(value, date):
            data_dict[key] = value.isoformat()
        elif isinstance(value, dict):
            data_dict[key] = convert_dates_to_iso(value)
    return data_dict


logger = logging.getLogger(__name__)


def _ventana_preinscripcion_activa():
    """Retorna la ventana de preinscripción activa (si existe)."""
    hoy = timezone.now().date()
    return (
        VentanaHabilitacion.objects.filter(
            tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
            desde__lte=hoy,
            hasta__gte=hoy,
            activo=True,
        )
        .order_by("-desde")
        .first()
    )


def _client_ip(request) -> str:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
        if ip:
            return ip
    return request.META.get("REMOTE_ADDR", "") or ""


def _check_rate_limit(request) -> None:
    limit = getattr(settings, "PREINS_RATE_LIMIT_PER_HOUR", 0)
    if not limit:
        return
    ip = _client_ip(request) or "unknown"
    cache_key = f"preins:rate:{ip}"
    added = cache.add(cache_key, 1, timeout=3600)
    if added:
        return
    try:
        count = cache.incr(cache_key)
    except ValueError:
        cache.set(cache_key, 1, timeout=3600)
        count = 1
    if count > limit:
        raise HttpError(
            429,
            "Demasiadas preinscripciones desde tu red. Intentá nuevamente más tarde.",
        )


def _verify_recaptcha(token: str | None, remote_ip: str) -> bool:
    secret = getattr(settings, "RECAPTCHA_SECRET_KEY", "")
    if not secret:
        return True
    if not token:
        return False
    try:
        response = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={
                "secret": secret,
                "response": token,
                "remoteip": remote_ip,
            },
            timeout=5,
        )
        data = response.json()
    except requests.RequestException as exc:
        logger.warning("No se pudo verificar reCAPTCHA: %s", exc)
        return False
    if not data.get("success"):
        logger.info("reCAPTCHA rechazado: %s", data)
        return False
    score = data.get("score")
    min_score = getattr(settings, "RECAPTCHA_MIN_SCORE", 0.3)
    if score is not None and score < min_score:
        logger.info("reCAPTCHA score bajo (%s)", score)
        return False
    return True


router = Router(tags=["preinscriptions"])
PREINS_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}
DOC_ALLOWED_ROLES = {"admin", "secretaria", "bedel", "coordinador", "jefes"}


def check_roles(request, allowed_roles: list[str], profesorado_id: Optional[int] = None):
    if not request.user or not request.user.is_authenticated:
        raise HttpError(401, "Unauthorized")

    user_roles = {g.lower() for g in request.user.groups.values_list("name", flat=True)}
    if request.user.is_staff:
        user_roles.add("admin")
    allowed = {role.lower() for role in allowed_roles}
    if not user_roles.intersection(allowed):
        raise HttpError(403, "Permiso denegado.")


@router.get("/", response=list[PreinscripcionOut], auth=JWTAuth())
def listar_preinscripciones(
    request, q: str | None = None,
    limit: int = 100,
    offset: int = 0,
    include_inactivas: bool = False, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    qs = Preinscripcion.objects.select_related("alumno__user", "carrera").all().order_by("-created_at")
    if not include_inactivas:
        qs = qs.filter(activa=True)

    if q:
        qs = qs.filter(
            Q(codigo__icontains=q)
            | Q(alumno__user__first_name__icontains=q)
            | Q(alumno__user__last_name__icontains=q)
            | Q(alumno__dni__icontains=q)
        )

    # Aplicar paginación
    qs = qs[offset : offset + limit]

    return qs


@router.get("/{pre_id}", response=PreinscripcionOut, auth=JWTAuth())
def obtener_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.select_related("alumno__user", "carrera").filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    return pre


@router.delete("/{pre_id}", response={204: None, 404: ApiResponse}, auth=JWTAuth())
def eliminar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        return 404, ApiResponse(ok=False, message="No encontrada")
    pre.activa = False
    try:
        pre.estado = "Borrador"
        pre.save(update_fields=["activa", "estado"])
    except Exception:
        pre.save(update_fields=["activa"])
    return 204, None


@router.post("/{pre_id}/activar", response=PreinscripcionOut, auth=JWTAuth())
def activar_preinscripcion(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    pre.activa = True
    try:
        pre.estado = "Enviada"
        pre.save(update_fields=["activa", "estado"])
    except Exception:
        pre.save(update_fields=["activa"])
    return pre


@router.get("/carreras", response=ApiResponse)
def listar_carreras(request, vigentes: bool = True, profesorado_id: Optional[int] = None):
    try:
        from core.models import Profesorado
        qs = Profesorado.objects.all().order_by("nombre")
        if vigentes:
            qs = qs.filter(activo=True, inscripcion_abierta=True)
        data = [{"id": c.id, "nombre": c.nombre} for c in qs]
        return ApiResponse(ok=True, message=f"{len(data)} carreras", data=data)
    except Exception as e:
        logger.exception("Error listando carreras")
        raise HttpError(500, "No se pudieron listar las carreras") from e


def _generar_codigo(pk: int) -> str:
    return f"PRE-{datetime.now().year}-{pk:04d}"


@router.post("", response=ApiResponse)
@transaction.atomic
def crear_o_actualizar(request, payload: PreinscripcionIn, profesorado_id: Optional[int] = None):
    """Crea o actualiza una preinscripción.
    La lógica es centrada en el Estudiante, usando el DNI como identificador principal.
    """
    _check_rate_limit(request)
    if payload.honeypot:
        raise HttpError(400, "Solicitud inválida.")
    ventana_activa = _ventana_preinscripcion_activa()
    if not ventana_activa:
        raise HttpError(
            403,
            "El período de preinscripción no está habilitado actualmente. "
            "Consultá las fechas publicadas por la institución.",
        )
    remote_ip = _client_ip(request)
    if not _verify_recaptcha(getattr(payload, "captcha_token", None), remote_ip):
        raise HttpError(400, "No pudimos validar el reCAPTCHA. Intentá nuevamente.")
    data_dict = payload.dict()
    data_dict.pop("captcha_token", None)
    data_dict.pop("honeypot", None)
    try:
        from django.contrib.auth.models import User
        from core.models import Estudiante, Preinscripcion
        estudiante_data = payload.estudiante
        dni = estudiante_data.dni
        email = estudiante_data.email

        # 1. Buscar o crear el Estudiante y el User asociado, usando DNI como clave.
        estudiante = Estudiante.objects.filter(dni=dni).first()

        if estudiante:
            # Si el estudiante ya existe, actualizar sus datos y los del usuario asociado.
            user = estudiante.user
            user.first_name = estudiante_data.nombres
            user.last_name = estudiante_data.apellido
            # Solo actualizar email si se proporciona uno nuevo.
            if email and user.email != email:
                # Opcional: verificar si el nuevo email ya está en uso por otro usuario.
                if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                    raise HttpError(409, f"El email '{email}' ya está en uso por otro usuario.")
                user.email = email
            user.save()

            estudiante.fecha_nacimiento = estudiante_data.fecha_nacimiento
            estudiante.telefono = estudiante_data.telefono
            estudiante.domicilio = estudiante_data.domicilio
            from contextlib import suppress

            with suppress(Exception):
                # cuil puede ser opcional
                estudiante.cuil = getattr(estudiante_data, "cuil", None)
            estudiante.save()
        else:
            # Si el estudiante no existe, crear un nuevo User y Estudiante.
            # El username del User se basa en el DNI para garantizar unicidad.
            user, user_created = User.objects.get_or_create(
                username=dni,
                defaults={
                    "first_name": estudiante_data.nombres,
                    "last_name": estudiante_data.apellido,
                    "email": email,
                },
            )
            if not user_created:
                # Si el username (DNI) ya existía, es un caso anómalo.
                # Se podría actualizar el email, pero es mejor registrar el problema.
                logger.warning(
                    f"Se intentó crear un estudiante con DNI {dni}, pero ya existía un User con ese username."
                )
                if email and user.email != email:
                    user.email = email
                    user.save()

            estudiante = Estudiante.objects.create(
                user=user,
                dni=dni,
                fecha_nacimiento=estudiante_data.fecha_nacimiento,
                telefono=estudiante_data.telefono,
                domicilio=estudiante_data.domicilio,
            )

        # 2. Buscar o crear la Preinscripción.
        current_year = datetime.now().year
        # 2. Buscar o crear la Preinscripción.
        current_year = datetime.now().year
        try:
            preinscripcion = Preinscripcion.objects.get(
                alumno=estudiante,
                carrera_id=payload.carrera_id,
                anio=current_year,
            )
            created = False
        except Preinscripcion.DoesNotExist:
            preinscripcion = Preinscripcion.objects.create(
                alumno=estudiante,
                carrera_id=payload.carrera_id,
                anio=current_year,
            )
            # Assign other fields after creation
            preinscripcion.estado = "Enviada"
            preinscripcion.foto_4x4_dataurl = payload.foto_4x4_dataurl
            preinscripcion.datos_extra = convert_dates_to_iso(data_dict.copy())
            preinscripcion.cuil = estudiante_data.cuil
            preinscripcion.save()
            created = True

        if not created:
            # If object already existed, update its fields
            preinscripcion.estado = "Enviada"
            preinscripcion.datos_extra = convert_dates_to_iso(data_dict.copy())
            preinscripcion.cuil = estudiante_data.cuil
            preinscripcion.save()

        if created or not preinscripcion.codigo:
            preinscripcion.codigo = _generar_codigo(preinscripcion.id)
            preinscripcion.save()

        res = {
            "id": preinscripcion.id,
            "codigo": preinscripcion.codigo,
            "estado": preinscripcion.estado,
        }
        logger.info(
            "Preinscripción %s id=%s codigo=%s",
            "creada" if created else "actualizada",
            preinscripcion.id,
            preinscripcion.codigo,
        )
        return ApiResponse(ok=True, message="Preinscripción enviada", data=res)

    except Exception as e:
        logger.exception("Fallo creando preinscripción")
        raise HttpError(500, "No se pudo procesar la solicitud.") from e


# === Checklist & Confirmacion ===


def _get_pre_by_codigo(codigo: str) -> 'Preinscripcion':
    from core.models import Preinscripcion
    pre = Preinscripcion.objects.filter(codigo__iexact=codigo).select_related("alumno", "carrera").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    return pre


def _sync_curso_intro_flag(estudiante, nuevo_valor: bool | None):
    if nuevo_valor is None:
        return
    aprobado = bool(nuevo_valor)
    if estudiante.curso_introductorio_aprobado != aprobado:
        estudiante.curso_introductorio_aprobado = aprobado
        estudiante.save(update_fields=["curso_introductorio_aprobado"])


@router.get("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
def get_checklist(request, pre_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).select_related("alumno").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl = getattr(pre, "checklist", None) or PreinscripcionChecklist(preinscripcion=pre)
    data = {k: getattr(cl, k) for k in ChecklistIn.__fields__}  # type: ignore
    if pre.alumno.curso_introductorio_aprobado:
        data["curso_introductorio_aprobado"] = True
    data["estado_legajo"] = cl.estado_legajo or cl.calcular_estado()
    return data


@router.put("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
@transaction.atomic
def put_checklist(request, pre_id: int, payload: ChecklistIn, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = Preinscripcion.objects.filter(id=pre_id).select_related("alumno").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
    for k, v in payload.dict().items():
        setattr(cl, k, v)
    cl.save()
    _sync_curso_intro_flag(pre.alumno, payload.curso_introductorio_aprobado)
    data = {k: getattr(cl, k) for k in ChecklistIn.__fields__}  # type: ignore
    if pre.alumno.curso_introductorio_aprobado:
        data["curso_introductorio_aprobado"] = True
    data["estado_legajo"] = cl.estado_legajo
    return data


@router.post("/by-code/{codigo}/confirmar", response=ApiResponse, auth=JWTAuth())
@transaction.atomic
def confirmar_por_codigo(request, codigo: str, payload: ChecklistIn | None = None, profesorado_id: Optional[int] = None):
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    """Confirma la preinscripción, actualiza checklist y estado de legajo.

    - Si viene payload: actualiza checklist antes de confirmar.
    - Cambia estado de Preinscripcion a 'Confirmada'.
    - Agrega la carrera al estudiante si no está presente.
    """
    pre = _get_pre_by_codigo(codigo)
    from django.contrib.auth.models import Group
    from core.models import PreinscripcionChecklist, Estudiante
    if payload:
        cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
        for k, v in payload.dict().items():
            setattr(cl, k, v)
        cl.save()
        _sync_curso_intro_flag(pre.alumno, payload.curso_introductorio_aprobado)

    # Asegurar relación estudiante-carrera
    cohorte_val = str(pre.anio) if pre.anio else None
    pre.alumno.asignar_profesorado(
        pre.carrera,
        anio_ingreso=pre.anio,
        cohorte=cohorte_val,
    )
    pre.estado = "Confirmada"
    pre.save(update_fields=["estado"])

    estudiante = pre.alumno
    user = estudiante.user
    default_password = f"Pass{estudiante.dni}"
    user.set_password(default_password)
    user.save(update_fields=["password"])

    estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
    user.groups.add(estudiante_group)

    estudiante.must_change_password = True
    estudiante.save(update_fields=["must_change_password"])

    logger.info(
        "Pre %s confirmada. Legajo=%s",
        pre.codigo,
        getattr(pre.checklist, "estado_legajo", "PEN"),
    )
    return ApiResponse(
        ok=True,
        message="Preinscripción confirmada",
        data={
            "codigo": pre.codigo,
            "estado": pre.estado,
            "legajo": getattr(pre.checklist, "estado_legajo", "PEN"),
            "password_inicial": default_password,
        },
    )


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
    payload: list[RequisitoDocumentacionUpdateIn], profesorado_id: Optional[int] = None):
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


def _serialize_pre(pre: 'Preinscripcion'):
    from core.models import Preinscripcion
    a = pre.alumno
    u = getattr(a, "user", None)  # u can be None

    # Define helper function or variables to safely get user attributes
    user_first_name = getattr(u, "first_name", "") if u else ""
    user_last_name = getattr(u, "last_name", "") if u else ""
    user_email = getattr(u, "email", "") if u else ""

    extra = copy.deepcopy(pre.datos_extra or {})  # ensure we never mutate DB state
    estudiante_extra = extra.get("estudiante") if isinstance(extra.get("estudiante"), dict) else {}
    estudiante_extra = getattr(a, "datos_extra", {}) or {}

    def ensure_extra(field: str):
        if extra.get(field):
            return
        for source in (estudiante_extra, estudiante_extra):
            if isinstance(source, dict):
                value = source.get(field)
                if value not in (None, ""):
                    extra[field] = value
                    return

    for campo in ("nacionalidad", "estado_civil", "localidad_nac", "provincia_nac", "pais_nac"):
        ensure_extra(campo)

    return {
        "id": pre.id,
        "codigo": pre.codigo,
        "estado": pre.estado.lower() if pre.estado else "enviada",
        "fecha": getattr(pre, "created_at", None),
        "estudiante": {
            "dni": getattr(a, "dni", ""),
            "nombre": user_first_name,
            "apellido": user_last_name,
            "email": user_email,
            "telefono": getattr(a, "telefono", ""),
            "domicilio": getattr(a, "domicilio", ""),
            "fecha_nacimiento": getattr(a, "fecha_nacimiento", None),
            "cuil": getattr(pre, "cuil", ""),
        },
        "carrera": {"id": pre.carrera_id, "nombre": getattr(pre.carrera, "nombre", "")},
        "datos_extra": extra,
    }


@router.get("/by-code/{codigo}", auth=JWTAuth())
def obtener_por_codigo(request, codigo: str, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
    return _serialize_pre(pre)


@router.get("/estudiante/{dni}", auth=JWTAuth())
def listar_por_estudiante(request, dni: str, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    preins = (
        Preinscripcion.objects.select_related("alumno__user", "carrera")
        .filter(alumno__dni=dni)
        .order_by("-anio", "-created_at")
    )
    return [_serialize_pre(p) for p in preins]


@router.post(
    "/by-code/{codigo}/carreras",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@transaction.atomic
def agregar_carrera(request, codigo: str, payload: NuevaCarreraIn, profesorado_id: Optional[int] = None):
    from core.models import Profesorado, Preinscripcion, PreinscripcionChecklist
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
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
        nueva.codigo = _generar_codigo(nueva.id)
        nueva.save(update_fields=["codigo"])
        PreinscripcionChecklist.objects.create(preinscripcion=nueva)
    except Exception as e:
        logger.exception("No se pudo agregar profesorado %s al estudiante %s", carrera.id, pre.alumno_id)
        raise HttpError(500, "No se pudo procesar la solicitud.") from e

    return ApiResponse(
        ok=True,
        message="Se agregó un nuevo profesorado para el estudiante.",
        data=_serialize_pre(nueva),
    )





@router.put("/by-code/{codigo}", auth=JWTAuth())
@transaction.atomic
def actualizar_por_codigo(request, codigo: str, payload: PreinscripcionUpdateIn, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
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
    try:
        pre.save()
    except Exception as e:
        logger.exception("Error guardando preinscripción")
        raise HttpError(500, f"Error interno al guardar la preinscripción: {e}") from e
    return _serialize_pre(pre)


@router.post("/by-code/{codigo}/observar", auth=JWTAuth())
def observar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
    pre.estado = "Observada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Observada"}


@router.post("/by-code/{codigo}/rechazar", auth=JWTAuth())
def rechazar(request, codigo: str, motivo: str | None = None, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
    pre.estado = "Rechazada"
    pre.save(update_fields=["estado"])
    return {"ok": True, "message": "Rechazada"}


@router.post("/by-code/{codigo}/cambiar-carrera", auth=JWTAuth())
def cambiar_carrera(request, codigo: str, carrera_id: int, profesorado_id: Optional[int] = None):
    from core.models import Preinscripcion, InscripcionMateriaEstudiante, Regularidad, InscripcionMesa
    check_roles(request, PREINS_ALLOWED_ROLES, profesorado_id)
    pre = _get_pre_by_codigo(codigo)
    carrera_actual = pre.carrera
    estudiante = pre.alumno

    hay_inscripciones = InscripcionMateriaEstudiante.objects.filter(
        estudiante=estudiante,
        materia__plan_de_estudio__profesorado_id=carrera_actual.id,
    ).exists()
    hay_regularidades = Regularidad.objects.filter(
        estudiante=estudiante,
        materia__plan_de_estudio__profesorado_id=carrera_actual.id,
    ).exists()
    hay_mesas = InscripcionMesa.objects.filter(
        estudiante=estudiante,
        mesa__materia__plan_de_estudio__profesorado_id=carrera_actual.id,
    ).exists()

    if hay_inscripciones or hay_regularidades or hay_mesas:
        return 400, ApiResponse(
            ok=False,
            message=(
                "No se puede cambiar el profesorado porque el estudiante ya registra inscripciones o notas en esta carrera."
            ),
        )

    pre.carrera_id = carrera_id
    pre.save(update_fields=["carrera"])
    return _serialize_pre(pre)
