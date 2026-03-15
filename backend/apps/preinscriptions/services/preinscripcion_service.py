from datetime import datetime
import logging
from django.db import transaction
from django.contrib.auth.models import User, Group
from core.models import Persona, Estudiante, Preinscripcion, PreinscripcionChecklist
from apps.preinscriptions.schemas import PreinscripcionIn

logger = logging.getLogger(__name__)

def convert_dates_to_iso(data_dict):
    from datetime import date
    for key, value in data_dict.items():
        if isinstance(value, date):
            data_dict[key] = value.isoformat()
        elif isinstance(value, dict):
            data_dict[key] = convert_dates_to_iso(value)
    return data_dict

def _generar_codigo(pk: int) -> str:
    return f"PRE-{datetime.now().year}-{pk:04d}"

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
        default_password = f"Pass{estudiante.dni}"
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
