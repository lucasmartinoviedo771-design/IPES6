import logging
from ninja import Router
from django.db import transaction
from django.contrib.auth.models import User
from ninja.errors import HttpError
from core.models import Estudiante, Preinscripcion, Profesorado, PreinscripcionChecklist
from .schemas import PreinscripcionIn, PreinscripcionOut # Importar PreinscripcionOut
from apps.common.api_schemas import ApiResponse
from datetime import datetime
from typing import List, Optional # Importar List y Optional
from django.db.models import Q # Importar Q

logger = logging.getLogger(__name__)
router = Router(tags=["preinscriptions"])

@router.get("/", response=List[PreinscripcionOut])
def listar_preinscripciones(request, q: Optional[str] = None, limit: int = 100, offset: int = 0):
    qs = Preinscripcion.objects.select_related("alumno__user", "carrera").all().order_by("-created_at")

    if q:
        qs = qs.filter(
            Q(codigo__icontains=q) |
            Q(alumno__nombres__icontains=q) |
            Q(alumno__apellido__icontains=q) |
            Q(alumno__dni__icontains=q)
        )
    
    # Aplicar paginaciÃ³n
    qs = qs[offset : offset + limit]

    return qs

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
    try:
        # 1. Buscar o crear el User
        # Usar email como clave para buscar User, o DNI si email no estÃ¡ disponible/es Ãºnico
        user, user_created = User.objects.get_or_create(
            email=payload.alumno.email, # Asumiendo que el email es Ãºnico o un buen identificador
            defaults={
                'username': payload.alumno.dni, # DNI como username por defecto
                'first_name': payload.alumno.nombres,
                'last_name': payload.alumno.apellido,
            }
        )
        if user_created:
            user.set_unusable_password()
            user.save()
        else: # Si el User ya existÃ­a, actualizamos sus datos
            user.username = payload.alumno.dni # Aseguramos que el username sea el DNI
            user.first_name = payload.alumno.nombres
            user.last_name = payload.alumno.apellido
            user.save()

        # 2. Buscar o crear el Estudiante, vinculado al User
        estudiante, estudiante_created = Estudiante.objects.get_or_create(
            user=user, # Enlazar al User que acabamos de crear/obtener
            dni=payload.alumno.dni, # DNI tambiÃ©n en Estudiante para bÃºsqueda
            defaults={
                'fecha_nacimiento': payload.alumno.fecha_nacimiento,
                'telefono': payload.alumno.telefono,
                'domicilio': payload.alumno.domicilio,
                # 'legajo' es nullable, no es necesario aquÃ­
            }
        )
        # Si el estudiante ya existÃ­a, actualizamos sus datos
        if not estudiante_created:
            estudiante.fecha_nacimiento = payload.alumno.fecha_nacimiento
            estudiante.telefono = payload.alumno.telefono
            estudiante.domicilio = payload.alumno.domicilio
            estudiante.save()

        # 3. Buscar o crear la Preinscripcion
        current_year = datetime.now().year
        preinscripcion, created = Preinscripcion.objects.update_or_create(
            alumno=estudiante,
            carrera_id=payload.carrera_id,
            anio=current_year,
            defaults={
                'estado': 'Enviada',
                'foto_4x4_dataurl': payload.foto_4x4_dataurl,
            }
        )

        if created or not preinscripcion.codigo:
            preinscripcion.codigo = _generar_codigo(preinscripcion.id)
            preinscripcion.save()

        res = {"id": preinscripcion.id, "codigo": preinscripcion.codigo, "estado": preinscripcion.estado}
        logger.info("PreinscripciÃ³n %s id=%s codigo=%s", "creada" if created else "actualizada", preinscripcion.id, preinscripcion.codigo)
        return ApiResponse(ok=True, message="PreinscripciÃ³n enviada", data=res)

    except Exception as e:
        logger.exception("Fallo creando preinscripciÃ³n")
        raise HttpError(500, f"No se pudo procesar la preinscripciÃ³n: {e}")


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


@router.get("/{pre_id}/checklist", response=ChecklistOut)
def get_checklist(request, pre_id: int):
    pre = Preinscripcion.objects.filter(id=pre_id).select_related("alumno").first()
    if not pre:
        raise HttpError(404, "Preinscripción no encontrada")
    cl = getattr(pre, "checklist", None) or PreinscripcionChecklist(preinscripcion=pre)
    data = {k: getattr(cl, k) for k in ChecklistIn.__fields__.keys()}  # type: ignore
    data["estado_legajo"] = cl.estado_legajo or cl.calcular_estado()
    return data


@router.put("/{pre_id}/checklist", response=ChecklistOut)
@transaction.atomic
def put_checklist(request, pre_id: int, payload: ChecklistIn):
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


@router.post("/{codigo}/confirmar", response=ApiResponse)
@transaction.atomic
def confirmar_por_codigo(request, codigo: str, payload: Optional[ChecklistIn] = None):
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
