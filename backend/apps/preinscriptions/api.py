import logging
from ninja import Router
from django.db import transaction
from django.contrib.auth.models import User
from ninja.errors import HttpError
from core.models import Estudiante, Preinscripcion, Profesorado
from .schemas import PreinscripcionIn
from apps.common.api_schemas import ApiResponse
from datetime import datetime

logger = logging.getLogger(__name__)
router = Router(tags=["preinscriptions"])

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
        # Usar email como clave para buscar User, o DNI si email no está disponible/es único
        user, user_created = User.objects.get_or_create(
            email=payload.alumno.email, # Asumiendo que el email es único o un buen identificador
            defaults={
                'username': payload.alumno.dni, # DNI como username por defecto
                'first_name': payload.alumno.nombres,
                'last_name': payload.alumno.apellido,
            }
        )
        if user_created:
            user.set_unusable_password()
            user.save()
        else: # Si el User ya existía, actualizamos sus datos
            user.username = payload.alumno.dni # Aseguramos que el username sea el DNI
            user.first_name = payload.alumno.nombres
            user.last_name = payload.alumno.apellido
            user.save()

        # 2. Buscar o crear el Estudiante, vinculado al User
        estudiante, estudiante_created = Estudiante.objects.get_or_create(
            user=user, # Enlazar al User que acabamos de crear/obtener
            dni=payload.alumno.dni, # DNI también en Estudiante para búsqueda
            defaults={
                'fecha_nacimiento': payload.alumno.fecha_nacimiento,
                'telefono': payload.alumno.telefono,
                'domicilio': payload.alumno.domicilio,
                # 'legajo' es nullable, no es necesario aquí
            }
        )
        # Si el estudiante ya existía, actualizamos sus datos
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
        logger.info("Preinscripción %s id=%s codigo=%s", "creada" if created else "actualizada", preinscripcion.id, preinscripcion.codigo)
        return ApiResponse(ok=True, message="Preinscripción enviada", data=res)

    except Exception as e:
        logger.exception("Fallo creando preinscripción")
        raise HttpError(500, f"No se pudo procesar la preinscripción: {e}")

