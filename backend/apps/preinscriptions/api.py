import logging
import json
from ninja import Router
from django.db import transaction
from django.contrib.auth.models import User
from ninja.errors import HttpError
from core.auth_ninja import JWTAuth
from core.models import Estudiante, Preinscripcion, Profesorado, PreinscripcionChecklist
from .schemas import PreinscripcionIn, PreinscripcionOut # Importar PreinscripcionOut
from apps.common.api_schemas import ApiResponse
from datetime import datetime, date
from typing import List, Optional # Importar List y Optional
from django.db.models import Q # Importar Q

# Helper function to convert dates in a dictionary to ISO format strings
def convert_dates_to_iso(data_dict):
    for key, value in data_dict.items():
        if isinstance(value, date):
            data_dict[key] = value.isoformat()
        elif isinstance(value, dict):
            data_dict[key] = convert_dates_to_iso(value)
    return data_dict

logger = logging.getLogger(__name__)
router = Router(tags=["preinscriptions"])

def check_roles(request, allowed_roles: list[str]):
    if not request.user or not request.user.is_authenticated:
        raise HttpError(401, "Unauthorized")
    
    user_roles = set(g.lower() for g in request.user.groups.values_list("name", flat=True))
    if request.user.is_staff:
        user_roles.add("admin")
        
    if not user_roles.intersection(allowed_roles):
        raise HttpError(403, f"Permission Denied. Your roles: {list(user_roles)}. Required: {allowed_roles}")

@router.get("/", response=List[PreinscripcionOut], auth=JWTAuth())
def listar_preinscripciones(request, q: Optional[str] = None, limit: int = 100, offset: int = 0, include_inactivas: bool = False):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    qs = Preinscripcion.objects.select_related("alumno__user", "carrera").all().order_by("-created_at")
    if not include_inactivas:
        qs = qs.filter(activa=True)

    if q:
        qs = qs.filter(
            Q(codigo__icontains=q) |
            Q(alumno__user__first_name__icontains=q) |
            Q(alumno__user__last_name__icontains=q) |
            Q(alumno__dni__icontains=q)
        )
    
    # Aplicar paginación
    qs = qs[offset : offset + limit]

    return qs

@router.get("/{pre_id}", response=PreinscripcionOut, auth=JWTAuth())
def obtener_preinscripcion(request, pre_id: int):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = Preinscripcion.objects.select_related("alumno__user", "carrera").filter(id=pre_id).first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    return pre

@router.delete("/{pre_id}", response={204: None, 404: ApiResponse}, auth=JWTAuth())
def eliminar_preinscripcion(request, pre_id: int):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
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
def activar_preinscripcion(request, pre_id: int):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
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
def listar_carreras(request, vigentes: bool = True):
    try:
        qs = Profesorado.objects.all().order_by("nombre")
        if vigentes:
            qs = qs.filter(activo=True, inscripcion_abierta=True)
        data = [{"id": c.id, "nombre": c.nombre} for c in qs]
        return ApiResponse(ok=True, message=f"{len(data)} carreras", data=data)
    except Exception as e:
        logger.exception("Error listando carreras")
        raise HttpError(500, "No se pudieron listar las carreras")

def _generar_codigo(pk: int) -> str:
    return f"PRE-{datetime.now().year}-{pk:04d}"

@router.post("", response=ApiResponse)
@transaction.atomic
def crear_o_actualizar(request, payload: PreinscripcionIn):
    """
    Crea o actualiza una preinscripción.
    La lógica es centrada en el Estudiante, usando el DNI como identificador principal.
    """
    try:
        alumno_data = payload.alumno
        dni = alumno_data.dni
        email = alumno_data.email

        # 1. Buscar o crear el Estudiante y el User asociado, usando DNI como clave.
        estudiante = Estudiante.objects.filter(dni=dni).first()

        if estudiante:
            # Si el estudiante ya existe, actualizar sus datos y los del usuario asociado.
            user = estudiante.user
            user.first_name = alumno_data.nombres
            user.last_name = alumno_data.apellido
            # Solo actualizar email si se proporciona uno nuevo.
            if email and user.email != email:
                # Opcional: verificar si el nuevo email ya está en uso por otro usuario.
                if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                    raise HttpError(409, f"El email '{email}' ya está en uso por otro usuario.")
                user.email = email
            user.save()

            estudiante.fecha_nacimiento = alumno_data.fecha_nacimiento
            estudiante.telefono = alumno_data.telefono
            estudiante.domicilio = alumno_data.domicilio
            try:
                # cuil puede ser opcional
                estudiante.cuil = getattr(alumno_data, "cuil", None)
            except Exception:
                pass
            estudiante.save()
        else:
            # Si el estudiante no existe, crear un nuevo User y Estudiante.
            # El username del User se basa en el DNI para garantizar unicidad.
            user, user_created = User.objects.get_or_create(
                username=dni,
                defaults={
                    'first_name': alumno_data.nombres,
                    'last_name': alumno_data.apellido,
                    'email': email,
                }
            )
            if not user_created:
                # Si el username (DNI) ya existía, es un caso anómalo.
                # Se podría actualizar el email, pero es mejor registrar el problema.
                logger.warning(f"Se intentó crear un estudiante con DNI {dni}, pero ya existía un User con ese username.")
                if email and user.email != email:
                    user.email = email
                    user.save()

            estudiante = Estudiante.objects.create(
                user=user,
                dni=dni,
                fecha_nacimiento=alumno_data.fecha_nacimiento,
                telefono=alumno_data.telefono,
                domicilio=alumno_data.domicilio,
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
            preinscripcion.estado = 'Enviada'
            preinscripcion.foto_4x4_dataurl = payload.foto_4x4_dataurl
            preinscripcion.datos_extra = convert_dates_to_iso(payload.dict())
            preinscripcion.cuil = alumno_data.cuil
            preinscripcion.save()
            created = True

        if not created:
            # If object already existed, update its fields
            preinscripcion.estado = 'Enviada'
            preinscripcion.datos_extra = convert_dates_to_iso(payload.dict())
            preinscripcion.cuil = alumno_data.cuil
            preinscripcion.save()

        if created or not preinscripcion.codigo:
            preinscripcion.codigo = _generar_codigo(preinscripcion.id)
            preinscripcion.save()

        res = {"id": preinscripcion.id, "codigo": preinscripcion.codigo, "estado": preinscripcion.estado}
        logger.info("Preinscripción %s id=%s codigo=%s", "creada" if created else "actualizada", preinscripcion.id, preinscripcion.codigo)
        return ApiResponse(ok=True, message="Preinscripción enviada", data=res)

    except Exception as e:
        logger.exception("Fallo creando preinscripción")
        raise HttpError(500, f"No se pudo procesar la preinscripción: {e}")


# === Checklist & Confirmacion ===

from ninja import Schema
from typing import Optional


class ChecklistIn(Schema):
    dni_legalizado: bool = False
    fotos_4x4: bool = False
    certificado_salud: bool = False
    folios_oficio: int = 0
    titulo_secundario_legalizado: bool = False
    certificado_titulo_en_tramite: bool = False
    analitico_legalizado: bool = False
    certificado_alumno_regular_sec: bool = False
    adeuda_materias: bool = False
    adeuda_materias_detalle: Optional[str] = ""
    escuela_secundaria: Optional[str] = ""
    es_certificacion_docente: bool = False
    titulo_terciario_univ: bool = False


class ChecklistOut(ChecklistIn):
    estado_legajo: str


def _get_pre_by_codigo(codigo: str) -> Preinscripcion:
    pre = Preinscripcion.objects.filter(codigo__iexact=codigo).select_related("alumno", "carrera").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    return pre


@router.get("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
def get_checklist(request, pre_id: int):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = Preinscripcion.objects.filter(id=pre_id).select_related("alumno").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl = getattr(pre, "checklist", None) or PreinscripcionChecklist(preinscripcion=pre)
    data = {k: getattr(cl, k) for k in ChecklistIn.__fields__.keys()}  # type: ignore
    data["estado_legajo"] = cl.estado_legajo or cl.calcular_estado()
    return data


@router.put("/{pre_id}/checklist", response=ChecklistOut, auth=JWTAuth())
@transaction.atomic
def put_checklist(request, pre_id: int, payload: ChecklistIn):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = Preinscripcion.objects.filter(id=pre_id).select_related("alumno").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
    for k, v in payload.dict().items():
        setattr(cl, k, v)
    cl.save()
    data = {k: getattr(cl, k) for k in ChecklistIn.__fields__.keys()}  # type: ignore
    data["estado_legajo"] = cl.estado_legajo
    return data


@router.post("/by-code/{codigo}/confirmar", response=ApiResponse, auth=JWTAuth())
@transaction.atomic
def confirmar_por_codigo(request, codigo: str, payload: Optional[ChecklistIn] = None):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    """Confirma la preinscripción, actualiza checklist y estado de legajo.

    - Si viene payload: actualiza checklist antes de confirmar.
    - Cambia estado de Preinscripcion a 'Confirmada'.
    - Agrega la carrera al estudiante si no está presente.
    """
    pre = _get_pre_by_codigo(codigo)
    if payload:
        cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
        for k, v in payload.dict().items():
            setattr(cl, k, v)
        cl.save()

    # Asegurar relación alumno-carrera
    pre.alumno.carreras.add(pre.carrera)
    pre.estado = "Confirmada"
    pre.save(update_fields=["estado"])
    logger.info("Pre %s confirmada. Legajo=%s", pre.codigo, getattr(pre.checklist, 'estado_legajo', 'PEN'))
    return ApiResponse(ok=True, message="Preinscripción confirmada", data={
        "codigo": pre.codigo,
        "estado": pre.estado,
        "legajo": getattr(pre.checklist, 'estado_legajo', 'PEN')
    })

def _serialize_pre(pre: Preinscripcion):
    a = pre.alumno
    u = getattr(a, 'user', None) # u can be None

    # Define helper function or variables to safely get user attributes
    user_first_name = getattr(u, 'first_name', "") if u else ""
    user_last_name = getattr(u, 'last_name', "") if u else ""
    user_email = getattr(u, 'email', "") if u else ""

    return {
        "id": pre.id,
        "codigo": pre.codigo,
        "estado": pre.estado.lower() if pre.estado else "enviada",
        "fecha": getattr(pre, 'created_at', None),
        "alumno": {
            "dni": getattr(a, 'dni', ""),
            "nombre": user_first_name,
            "apellido": user_last_name,
            "email": user_email,
            "telefono": getattr(a, 'telefono', ""),
            "domicilio": getattr(a, 'domicilio', ""),
            "fecha_nacimiento": getattr(a, 'fecha_nacimiento', None),
            "cuil": getattr(pre, 'cuil', ""),
        },
        "carrera": { "id": pre.carrera_id, "nombre": getattr(pre.carrera, 'nombre', '') },
        "datos_extra": pre.datos_extra,
    }

@router.get("/by-code/{codigo}", auth=JWTAuth())
def obtener_por_codigo(request, codigo: str):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = _get_pre_by_codigo(codigo)
    return _serialize_pre(pre)

from .schemas import PreinscripcionIn, PreinscripcionOut, PreinscripcionUpdateIn # Importar PreinscripcionOut

@router.put("/by-code/{codigo}", auth=JWTAuth())
@transaction.atomic
def actualizar_por_codigo(request, codigo: str, payload: PreinscripcionUpdateIn):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = _get_pre_by_codigo(codigo)
    if payload.alumno:
        alumno = payload.alumno
        u = pre.alumno.user
        u.first_name = alumno.nombres or u.first_name
        u.last_name = alumno.apellido or u.last_name
        if alumno.email: u.email = alumno.email
        u.save()
        a = pre.alumno
        if alumno.telefono is not None: a.telefono = alumno.telefono
        if alumno.domicilio is not None: a.domicilio = alumno.domicilio
        if alumno.fecha_nacimiento: a.fecha_nacimiento = alumno.fecha_nacimiento
        a.save()
        if alumno.cuil: pre.cuil = alumno.cuil

    if payload.carrera_id:
        pre.carrera_id = payload.carrera_id

    if payload.datos_extra:
        pre.datos_extra = payload.datos_extra
    try:
        pre.save()
    except Exception as e:
        logger.exception("Error guardando preinscripción")
        raise HttpError(500, f"Error interno al guardar la preinscripción: {e}")
    return _serialize_pre(pre)

@router.post("/by-code/{codigo}/observar", auth=JWTAuth())
def observar(request, codigo: str, motivo: Optional[str] = None):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = _get_pre_by_codigo(codigo)
    pre.estado = 'Observada'
    pre.save(update_fields=['estado'])
    return {"ok": True, "message": "Observada"}

@router.post("/by-code/{codigo}/rechazar", auth=JWTAuth())
def rechazar(request, codigo: str, motivo: Optional[str] = None):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = _get_pre_by_codigo(codigo)
    pre.estado = 'Rechazada'
    pre.save(update_fields=['estado'])
    return {"ok": True, "message": "Rechazada"}

@router.post("/by-code/{codigo}/cambiar-carrera", auth=JWTAuth())
def cambiar_carrera(request, codigo: str, carrera_id: int):
    check_roles(request, ['admin', 'secretaria', 'bedel'])
    pre = _get_pre_by_codigo(codigo)
    pre.carrera_id = carrera_id
    pre.save(update_fields=['carrera'])
    return _serialize_pre(pre)
