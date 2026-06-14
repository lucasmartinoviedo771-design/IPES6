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


_ESTADO_CIVIL_MAP = {
    "soltero/a": "SOL", "soltero": "SOL", "soltera": "SOL", "sol": "SOL",
    "casado/a": "CAS", "casado": "CAS", "casada": "CAS", "cas": "CAS",
    "divorciado/a": "DIV", "divorciado": "DIV", "divorciada": "DIV", "div": "DIV",
    "viudo/a": "VIU", "viudo": "VIU", "viuda": "VIU", "viu": "VIU",
    "conviviente": "CON", "con": "CON",
    "otro": "OTR", "otr": "OTR",
}

_GENERO_MAP = {
    "masculino": "M", "m": "M",
    "femenino": "F", "f": "F",
    "no binario / otro": "X", "no binario": "X", "no binarie": "X", "otro": "X", "x": "X",
}


def map_estado_civil(value: str | None) -> str | None:
    if not value:
        return None
    return _ESTADO_CIVIL_MAP.get(value.strip().lower(), None)


def map_genero(value: str | None) -> str | None:
    if not value:
        return None
    return _GENERO_MAP.get(value.strip().lower(), None)

class PreinscripcionService:
    @staticmethod
    @transaction.atomic
    def create_or_update_preinscripcion(payload: PreinscripcionIn) -> Preinscripcion:
        estudiante_data = payload.estudiante
        dni = estudiante_data.dni
        data_dict = payload.dict()
        data_dict.pop("captcha_token", None)
        data_dict.pop("honeypot", None)

        # 1. Persona — solo datos básicos de identidad y contacto
        # Los campos adicionales (nacimiento, emergencia, etc.) se copian al CONFIRMAR
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
            user, _ = User.objects.get_or_create(username=dni)
            estudiante = Estudiante.objects.create(
                user=user,
                persona=persona,
            )
        else:
            estudiante.save()

        # 3. Preinscripción
        current_year = datetime.now().year
        
        if getattr(payload, "codigo", None):
            preinscripcion = Preinscripcion.objects.filter(codigo__iexact=payload.codigo).first()
            if not preinscripcion:
                from ninja.errors import HttpError
                raise HttpError(404, "Preinscripción no encontrada para el código provisto.")
            if preinscripcion.estado == "Confirmada":
                from ninja.errors import HttpError
                raise HttpError(400, "La preinscripción ya ha sido confirmada y no puede ser modificada.")
            if preinscripcion.alumno.persona.dni != estudiante_data.dni:
                from ninja.errors import HttpError
                raise HttpError(400, "El DNI no coincide con el código de preinscripción.")
            created = False
        else:
            existing = Preinscripcion.objects.filter(
                alumno=estudiante,
                carrera_id=payload.carrera_id,
                anio=current_year,
            ).first()
            if existing:
                if existing.activa:
                    from ninja.errors import HttpError
                    raise HttpError(400, "Ya existe una preinscripción activa para esta carrera en el ciclo lectivo actual.")
                else:
                    preinscripcion = existing
                    preinscripcion.activa = True
                    created = False
            else:
                preinscripcion = Preinscripcion(
                    alumno=estudiante,
                    carrera_id=payload.carrera_id,
                    anio=current_year,
                )
                created = True

        preinscripcion.estado = "Enviada"
        preinscripcion.foto_4x4_dataurl = payload.foto_4x4_dataurl
        preinscripcion.datos_extra = convert_dates_to_iso(data_dict.copy())
        preinscripcion.cuil = estudiante_data.cuil
        
        if created or not preinscripcion.codigo:
            preinscripcion.save()
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

        # Copiar datos_extra → Persona + Estudiante al confirmar
        extra = pre.datos_extra or {}
        persona = pre.alumno.persona
        if persona:
            persona_updates = {}
            if extra.get("nacionalidad"):
                persona_updates["nacionalidad"] = extra["nacionalidad"]
            if extra.get("estado_civil"):
                persona_updates["estado_civil"] = map_estado_civil(extra["estado_civil"])
            if extra.get("genero"):
                persona_updates["genero"] = map_genero(extra["genero"])
            if extra.get("localidad_nac"):
                persona_updates["localidad_nac"] = extra["localidad_nac"]
            if extra.get("provincia_nac"):
                persona_updates["provincia_nac"] = extra["provincia_nac"]
            if extra.get("pais_nac"):
                persona_updates["pais_nac"] = extra["pais_nac"]
            if extra.get("emergencia_telefono"):
                persona_updates["telefono_emergencia"] = extra["emergencia_telefono"]
            if extra.get("emergencia_parentesco"):
                persona_updates["parentesco_emergencia"] = extra["emergencia_parentesco"]
            if persona_updates:
                for k, v in persona_updates.items():
                    setattr(persona, k, v)
                persona.save(update_fields=list(persona_updates.keys()))

        estudiante = pre.alumno
        est_updates = {}
        for field in ("sec_titulo", "sec_establecimiento", "sec_fecha_egreso",
                      "sec_localidad", "sec_provincia", "sec_pais",
                      "trabaja", "empleador", "horario_trabajo", "domicilio_trabajo"):
            if extra.get(field) is not None:
                est_updates[field] = extra[field]
        for field in ("cud_informado", "condicion_salud_informada", "condicion_salud_detalle"):
            if extra.get(field) is not None:
                est_updates[field] = extra[field]
        if est_updates:
            for k, v in est_updates.items():
                setattr(estudiante, k, v)
            estudiante.save(update_fields=list(est_updates.keys()))

        # Career assignment
        inscripcion = pre.alumno.asignar_profesorado(
            pre.carrera,
            anio_ingreso=pre.anio,
            cohorte=str(pre.anio) if pre.anio else None,
        )
        
        # Sync legajo status from checklist to student
        if hasattr(pre, "checklist") and pre.checklist and hasattr(pre.checklist, "estado_legajo"):
            pre.alumno.estado_legajo = pre.checklist.estado_legajo
            pre.alumno.save(update_fields=["estado_legajo"])
        
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
