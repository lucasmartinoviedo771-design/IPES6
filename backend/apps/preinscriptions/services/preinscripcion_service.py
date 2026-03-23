from datetime import datetime
import logging
import secrets
import string
from django.db import transaction
from django.contrib.auth.models import User, Group
from core.models import Persona, Estudiante, Preinscripcion, PreinscripcionChecklist
from apps.common.date_utils import format_date
from apps.preinscriptions.schemas import PreinscripcionIn

logger = logging.getLogger(__name__)

def convert_dates_to_iso(data_dict):
    from datetime import date
    for key, value in data_dict.items():
        if isinstance(value, date):
            data_dict[key] = format_date(value)
        elif isinstance(value, dict):
            data_dict[key] = convert_dates_to_iso(value)
    return data_dict

def _generar_codigo(pk: int) -> str:
    return f"PRE-{datetime.now().year}-{pk:04d}"

def _generar_password_segura() -> str:
    """Genera una contraseña aleatoria de 12 caracteres (letras + dígitos)."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(12))

class PreinscripcionService:
    @staticmethod
    @transaction.atomic
    def create_or_update_preinscripcion(payload: PreinscripcionIn) -> Preinscripcion:
        estudiante_data = payload.estudiante
        dni = estudiante_data.dni
        data_dict = payload.dict()
        data_dict.pop("captcha_token", None)
        data_dict.pop("honeypot", None)

        # 1. Persona
        persona, _ = Persona.objects.update_or_create(
            dni=dni,
            defaults={
                "nombre": estudiante_data.nombres,
                "apellido": estudiante_data.apellido,
                "email": estudiante_data.email,
                "telefono": estudiante_data.telefono,
                "domicilio": estudiante_data.domicilio,
                "fecha_nacimiento": estudiante_data.fecha_nacimiento,
                "cuil": getattr(estudiante_data, "cuil", None),
            }
        )

        # 2. Estudiante
        estudiante = Estudiante.objects.filter(persona=persona).first()
        if not estudiante:
            user, _ = User.objects.get_or_create(username=dni, defaults={
                "email": persona.email,
                "first_name": persona.nombre,
                "last_name": persona.apellido
            })
            estudiante = Estudiante.objects.create(
                user=user,
                persona=persona,
                dni=dni,
                fecha_nacimiento=persona.fecha_nacimiento,
                telefono=persona.telefono,
                domicilio=persona.domicilio,
            )
        else:
            estudiante.fecha_nacimiento = persona.fecha_nacimiento
            estudiante.telefono = persona.telefono
            estudiante.domicilio = persona.domicilio
            if estudiante.dni != dni:
                estudiante.dni = dni
            estudiante.save()

            user = estudiante.user
            if user.first_name != persona.nombre or user.last_name != persona.apellido:
                user.first_name = persona.nombre
                user.last_name = persona.apellido
                user.save(update_fields=['first_name', 'last_name'])

        # 3. Preinscripción
        current_year = datetime.now().year
        preinscripcion, created = Preinscripcion.objects.get_or_create(
            alumno=estudiante,
            carrera_id=payload.carrera_id,
            anio=current_year,
        )

        preinscripcion.estado = "Enviada"
        preinscripcion.foto_4x4_dataurl = payload.foto_4x4_dataurl
        preinscripcion.datos_extra = convert_dates_to_iso(data_dict.copy())
        preinscripcion.cuil = estudiante_data.cuil
        
        if created or not preinscripcion.codigo:
            preinscripcion.codigo = _generar_codigo(preinscripcion.id)
            
        preinscripcion.save()
        return preinscripcion

    @staticmethod
    @transaction.atomic
    def confirm_preinscripcion(pre: Preinscripcion, checklist_payload=None) -> dict:
        if checklist_payload:
            cl, _ = PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
            for k, v in checklist_payload.items():
                if hasattr(cl, k):
                    setattr(cl, k, v)
            cl.save()
            
            # Sync to student datos_extra
            datos_extra = pre.alumno.datos_extra or {}
            docs_extra = datos_extra.get("documentacion") or {}
            for k, v in checklist_payload.items():
                if v not in (None, ""):
                    docs_extra[k] = v
            datos_extra["documentacion"] = docs_extra
            pre.alumno.datos_extra = datos_extra
            pre.alumno.save(update_fields=["datos_extra"])

        # Career assignment
        pre.alumno.asignar_profesorado(
            pre.carrera,
            anio_ingreso=pre.anio,
            cohorte=str(pre.anio) if pre.anio else None,
        )
        
        pre.estado = "Confirmada"
        pre.save(update_fields=["estado"])

        # Auth & Password
        estudiante = pre.alumno
        user = estudiante.user
        default_password = _generar_password_segura()
        user.set_password(default_password)
        user.save(update_fields=["password"])

        estudiante_group, _ = Group.objects.get_or_create(name="estudiante")
        user.groups.add(estudiante_group)

        estudiante.must_change_password = True
        estudiante.save(update_fields=["must_change_password"])

        return {
            "codigo": pre.codigo,
            "estado": pre.estado,
            "legajo": getattr(pre.checklist, "estado_legajo", "PEN"),
            "password_inicial": default_password,
        }

    @staticmethod
    def get_by_codigo(codigo: str):
        from core.models import Preinscripcion
        from ninja.errors import HttpError
        pre = Preinscripcion.objects.filter(codigo__iexact=codigo).select_related("alumno", "carrera").first()
        if not pre:
            raise HttpError(404, "Preinscripción no encontrada")
        return pre

    @staticmethod
    def sync_curso_intro_flag(estudiante, nuevo_valor) -> None:
        if nuevo_valor is None:
            return
        aprobado = bool(nuevo_valor)
        if estudiante.curso_introductorio_aprobado != aprobado:
            estudiante.curso_introductorio_aprobado = aprobado
            estudiante.save(update_fields=["curso_introductorio_aprobado"])

    @staticmethod
    @transaction.atomic
    def cambiar_carrera(pre, carrera_id: int) -> dict | tuple:
        from core.models import InscripcionMateriaEstudiante, Regularidad, InscripcionMesa
        from ninja.errors import HttpError
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
            return None, (
                "No se puede cambiar el profesorado porque el estudiante ya registra inscripciones o notas en esta carrera."
            )

        pre.carrera_id = carrera_id
        pre.save(update_fields=["carrera"])
        return pre, None
