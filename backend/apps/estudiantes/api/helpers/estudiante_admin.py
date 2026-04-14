"""Helpers para administración de estudiantes (documentación, detalle, actualización)."""

from __future__ import annotations

from collections.abc import Iterable

from apps.common.date_utils import format_date, parse_date

from django.contrib.auth.models import User

from apps.common.api_schemas import ApiResponse
from core.models import (
    Estudiante,
    PlanDeEstudio,
    PreinscripcionChecklist,
    Profesorado,
    Regularidad,
)

from apps.estudiantes.schemas import (
    EstudianteAdminDetail,
    EstudianteAdminDocumentacion,
    EstudianteAdminUpdateIn,
    RegularidadResumen,
)
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada

from apps.estudiantes.api.helpers.user_utils import ADMIN_ALLOWED_ROLES

DOCUMENTACION_FIELDS = {
    "dni_legalizado",
    "fotos_4x4",
    "certificado_salud",
    "folios_oficio",
    "titulo_secundario_legalizado",
    "certificado_titulo_en_tramite",
    "analitico_legalizado",
    "certificado_alumno_regular_sec",
    "adeuda_materias",
    "adeuda_materias_detalle",
    "escuela_secundaria",
    "es_certificacion_docente",
    "titulo_terciario_univ",
    "incumbencia",
    "articulo_7",
}


def _extract_documentacion(est: Estudiante) -> dict:
    if not est:
        return {}
    return {key: getattr(est, key) for key in DOCUMENTACION_FIELDS if hasattr(est, key)}


def _listar_carreras_detalle(est: Estudiante, carreras: Iterable[Profesorado] | None = None) -> list[dict]:
    carreras_list = list(carreras) if carreras is not None else list(est.carreras.all())
    if not carreras_list:
        return []

    planes_qs = PlanDeEstudio.objects.filter(profesorado__in=carreras_list).order_by(
        "profesorado_id", "-vigente", "-anio_inicio", "resolucion"
    )
    planes_por_prof: dict[int, list[PlanDeEstudio]] = {}
    for plan in planes_qs:
        planes_por_prof.setdefault(plan.profesorado_id, []).append(plan)

    detalle: list[dict] = []
    for prof in carreras_list:
        planes = planes_por_prof.get(prof.id, [])
        detalle.append(
            {
                "profesorado_id": prof.id,
                "nombre": prof.nombre,
                "planes": [
                    {
                        "id": plan.id,
                        "resolucion": plan.resolucion or "",
                        "vigente": bool(getattr(plan, "vigente", False)),
                    }
                    for plan in planes
                ],
            }
        )
    return detalle


def _apply_estudiante_updates(
    est: Estudiante,
    payload: EstudianteAdminUpdateIn,
    allow_estado_legajo: bool,
    allow_force_password: bool,
    mark_profile_complete: bool = False,
):
    fields_to_update: set[str] = set()
    user = est.user if est.user_id else None

    if payload.dni is not None:
        new_dni = payload.dni.strip()
        if new_dni and new_dni != est.dni:
            if Estudiante.objects.filter(persona__dni=new_dni).exclude(id=est.id).exists():
                return False, (400, ApiResponse(ok=False, message=f"El DNI {new_dni} ya está registrado."))

            if user:
                if User.objects.filter(username=new_dni).exclude(id=user.id).exists():
                     return False, (400, ApiResponse(ok=False, message=f"El usuario {new_dni} ya existe."))
                user.username = new_dni
                user.save(update_fields=["username"])

    if payload.email is not None and user:
        user.email = payload.email or ""
        user.save(update_fields=["email"])

    if user:
        user_updates = []
        if payload.nombre is not None:
            user.first_name = payload.nombre.strip()
            user_updates.append("first_name")
        if payload.apellido is not None:
            user.last_name = payload.apellido.strip()
            user_updates.append("last_name")
        if payload.activo is not None:
            user.is_active = payload.activo
            user_updates.append("is_active")
        if user_updates:
            user.save(update_fields=user_updates)

    if payload.telefono is not None:
        est.telefono = payload.telefono or ""
        # est.telefono is a property, so it won't be in fields_to_update for Estudiante
        # but we handle it in Persona block below

    if payload.domicilio is not None:
        est.domicilio = payload.domicilio
        # Same here

    if allow_estado_legajo and payload.estado_legajo is not None:
        est.estado_legajo = payload.estado_legajo.upper()
        fields_to_update.add("estado_legajo")

    if allow_force_password and payload.must_change_password is not None:
        est.must_change_password = payload.must_change_password
        fields_to_update.add("must_change_password")

    if payload.fecha_nacimiento is not None:
        raw_fecha = payload.fecha_nacimiento or ""
        new_date = parse_date(raw_fecha)
        if new_date is None and raw_fecha.strip():
            return False, (
                400,
                ApiResponse(
                    ok=False,
                    message="Formato de fecha invalido. Usa DD/MM/AAAA o AAAA-MM-DD.",
                ),
            )
        est.fecha_nacimiento_temp = new_date # Temporary storage for persona sync

    if payload.documentacion is not None:
        doc_updates = payload.documentacion.model_dump(exclude_unset=True)
        for key, value in doc_updates.items():
            if hasattr(est, key):
                setattr(est, key, value)
                fields_to_update.add(key)

    # Fields to store directly in models (Persona or Estudiante)
    PERSONA_KEYS = (
        "genero", "cuil", "lugar_nacimiento", "nacionalidad",
        "localidad_nac", "provincia_nac", "pais_nac",
        "estado_civil", "nombre", "apellido", "email", "telefono", "domicilio"
    )

    if est.persona:
        persona_updates = []
        
        # Sincronización de Identidad
        if payload.dni is not None:
            est.persona.dni = payload.dni.strip()
            persona_updates.append("dni")
        
        if payload.fecha_nacimiento is not None:
            est.persona.fecha_nacimiento = getattr(est, "fecha_nacimiento_temp", None)
            persona_updates.append("fecha_nacimiento")

        for key in PERSONA_KEYS:
            value = getattr(payload, key, None)
            if value is not None:
                if key == "estado_civil" and value:
                    value = value[:3].upper()
                setattr(est.persona, key, value)
                persona_updates.append(key)

        # Especial handling for emergency contact in Persona
        if payload.emergencia_telefono is not None:
            est.persona.telefono_emergencia = payload.emergencia_telefono
            persona_updates.append("telefono_emergencia")
        if payload.emergencia_parentesco is not None:
            est.persona.parentesco_emergencia = payload.emergencia_parentesco
            persona_updates.append("parentesco_emergencia")

        if persona_updates:
            est.persona.save(update_fields=persona_updates)

    ESTUDIANTE_KEYS = (
        "anio_ingreso", "cohorte", "observaciones",
        "sec_titulo", "sec_establecimiento", "sec_fecha_egreso", "sec_localidad", "sec_provincia", "sec_pais",
        "sup1_titulo", "sup1_establecimiento", "sup1_fecha_egreso", "sup1_localidad", "sup1_provincia", "sup1_pais",
        "condicion_salud_detalle", "empleador", "horario_trabajo", "domicilio_trabajo",
        "curso_introductorio_aprobado", "libreta_entregada",
        "cud_informado", "condicion_salud_informada", "trabaja"
    )

    for key in ESTUDIANTE_KEYS:
        value = getattr(payload, key, None)
        if value is not None:
            setattr(est, key, value)
            fields_to_update.add(key)

    if mark_profile_complete and not est.datos_extra.get("perfil_actualizado"):
        est.datos_extra["perfil_actualizado"] = True
        fields_to_update.add("datos_extra")

    if fields_to_update:
        est.save(update_fields=list(fields_to_update))

    if payload.carreras_update is not None:
        from core.models import EstudianteCarrera
        for cu in payload.carreras_update:
            ec = EstudianteCarrera.objects.filter(estudiante=est, profesorado_id=cu.profesorado_id).first()
            if ec:
                ec_updates = []
                if cu.estado_academico is not None:
                    ec.estado_academico = cu.estado_academico
                    ec_updates.append("estado_academico")
                if cu.estado_legajo is not None:
                    ec.estado_legajo = cu.estado_legajo
                    ec_updates.append("estado_legajo")
                if ec_updates:
                    ec.save(update_fields=ec_updates)

    return True, None


def _determine_condicion(documentacion: dict | None) -> str:
    if not documentacion:
        return "Pendiente"
    requisito_basico = all(
        (
            bool(documentacion.get("dni_legalizado")),
            bool(documentacion.get("fotos_4x4")),
            bool(documentacion.get("certificado_salud")),
            (documentacion.get("folios_oficio") or 0) >= 3,
        )
    )
    # Requisito de titulación (Solo título completo o Analítico Legalizado cuentan para COM)
    # Según usuario: "titulo en tramite no habilita legajo completo"
    # "legajo completo es DNI true, folio true, fotos true certificado true y titulo secundario true"
    # Exception: articulo_7
    titulo_ok = bool(documentacion.get("titulo_secundario_legalizado"))
    es_articulo_7 = bool(documentacion.get("articulo_7"))

    # Para ser Regular (Legajo Completo) debe tener básicos y (Título Secundario o Art 7)
    if requisito_basico and (titulo_ok or es_articulo_7):
        return "Regular"

    # Si tiene lo básico o algo de documentación, es Condicional
    # (Incluye títulos en trámite que antes daban Regular)
    indicadores_actividad = (
        requisito_basico or
        bool(documentacion.get("titulo_secundario_legalizado")) or
        bool(documentacion.get("certificado_titulo_en_tramite")) or
        bool(documentacion.get("analitico_legalizado")) or
        es_articulo_7
    )
    if indicadores_actividad:
        return "Condicional"

    return "Pendiente"


def _build_admin_detail(estudiante: Estudiante, allowed_carrera_ids: set[int] | None = None) -> EstudianteAdminDetail:
    user = estudiante.user if estudiante.user_id else None
    persona = estudiante.persona
    carreras_det = []
    carreras_nombres = []
    for cd in estudiante.carreras_detalle.select_related("profesorado").all():
        if allowed_carrera_ids is not None and cd.profesorado_id not in allowed_carrera_ids:
            continue
        carreras_det.append({
            "profesorado_id": cd.profesorado_id,
            "nombre": cd.profesorado.nombre,
            "estado_academico": cd.estado_academico,
            "estado_academico_display": cd.get_estado_academico_display(),
            "estado_legajo": cd.estado_legajo,
            "estado_legajo_display": cd.get_estado_legajo_display()
        })
        carreras_nombres.append(cd.profesorado.nombre)
    documentacion_data = _extract_documentacion(estudiante)

    # --- Check documentation from PreinscripcionChecklist if available ---
    checklist = PreinscripcionChecklist.objects.filter(preinscripcion__alumno=estudiante).order_by("-updated_at").first()
    if checklist:
        checklist_map = {
            "dni_legalizado": checklist.dni_legalizado,
            "fotos_4x4": checklist.fotos_4x4,
            "certificado_salud": checklist.certificado_salud,
            "folios_oficio": checklist.folios_oficio,
            "titulo_secundario_legalizado": checklist.titulo_secundario_legalizado,
            "certificado_titulo_en_tramite": checklist.certificado_titulo_en_tramite,
            "analitico_legalizado": checklist.analitico_legalizado,
            "certificado_alumno_regular_sec": checklist.certificado_alumno_regular_sec,
            "adeuda_materias": checklist.adeuda_materias,
            "adeuda_materias_detalle": checklist.adeuda_materias_detalle,
            "escuela_secundaria": checklist.escuela_secundaria,
            "es_certificacion_docente": getattr(checklist, "es_certificacion_docente", False),
            "titulo_terciario_univ": getattr(checklist, "titulo_terciario_univ", False),
            "incumbencia": getattr(checklist, "incumbencia", False),
            "articulo_7": getattr(checklist, "articulo_7", False),
        }
        for k, v in checklist_map.items():
            if documentacion_data.get(k) in (None, False, 0, ""):
                documentacion_data[k] = v

        curso_introductorio_aprobado = estudiante.curso_introductorio_aprobado or (checklist and checklist.curso_introductorio_aprobado)
    else:
        curso_introductorio_aprobado = estudiante.curso_introductorio_aprobado

    documentacion = EstudianteAdminDocumentacion(**documentacion_data) if documentacion_data else None
    condicion = _determine_condicion(documentacion_data)

    regularidades_resumen = [
        RegularidadResumen(
            id=reg.id,
            materia_id=reg.materia_id,
            materia_nombre=reg.materia.nombre if reg.materia_id and reg.materia else "",
            situacion=reg.situacion,
            situacion_display=reg.get_situacion_display(),
            fecha_cierre=format_date(reg.fecha_cierre),
            nota_tp=(float(reg.nota_trabajos_practicos) if reg.nota_trabajos_practicos is not None else None),
            nota_final=reg.nota_final_cursada,
            asistencia=reg.asistencia_porcentaje,
            excepcion=reg.excepcion,
            observaciones=reg.observaciones or None,
            aprobada=estudiante_tiene_materia_aprobada(estudiante, reg.materia),
        )
        for reg in Regularidad.objects.filter(estudiante=estudiante).select_related("materia").order_by("-fecha_cierre")
    ]

    extra_data = {
        "anio_ingreso": estudiante.anio_ingreso,
        "cohorte": estudiante.cohorte,
        "observaciones": estudiante.observaciones,
        "lugar_nacimiento": persona.lugar_nacimiento if persona else None,
        "genero": persona.genero if persona else None,
        "cuil": persona.cuil if persona else None,
        "nacionalidad": persona.nacionalidad if persona else None,
        "estado_civil": persona.estado_civil if persona else None,
        "localidad_nac": persona.localidad_nac if persona else None,
        "provincia_nac": persona.provincia_nac if persona else None,
        "pais_nac": persona.pais_nac if persona else None,
        "emergencia_telefono": persona.telefono_emergencia if persona else None,
        "emergencia_parentesco": persona.parentesco_emergencia if persona else None,
        "trabaja": estudiante.trabaja,
        "empleador": estudiante.empleador,
        "horario_trabajo": estudiante.horario_trabajo,
        "domicilio_trabajo": estudiante.domicilio_trabajo,
        "cud_informado": estudiante.cud_informado,
        "condicion_salud_informada": estudiante.condicion_salud_informada,
        "condicion_salud_detalle": estudiante.condicion_salud_detalle,
        "sec_titulo": estudiante.sec_titulo,
        "sec_establecimiento": estudiante.sec_establecimiento,
        "sec_fecha_egreso": format_date(estudiante.sec_fecha_egreso),
        "sec_localidad": estudiante.sec_localidad,
        "sec_provincia": estudiante.sec_provincia,
        "sec_pais": estudiante.sec_pais,
    }

    return EstudianteAdminDetail(
        dni=estudiante.dni,
        apellido=estudiante.apellido,
        nombre=estudiante.nombre,
        email=estudiante.email,
        telefono=estudiante.telefono,
        domicilio=estudiante.domicilio,
        fecha_nacimiento=format_date(estudiante.fecha_nacimiento),
        estado_legajo=estudiante.estado_legajo,
        estado_legajo_display=estudiante.get_estado_legajo_display(),
        must_change_password=estudiante.must_change_password,
        activo=user.is_active if user else False,
        carreras=carreras_nombres,
        carreras_detalle=carreras_det,
        legajo=estudiante.legajo or None,
        datos_extra=extra_data,
        documentacion=documentacion,
        condicion_calculada=condicion,
        curso_introductorio_aprobado=curso_introductorio_aprobado,
        libreta_entregada=estudiante.libreta_entregada,
        autorizado_rendir=estudiante.autorizado_rendir,
        autorizado_rendir_observacion=estudiante.autorizado_rendir_observacion,
        materias_autorizadas=list(estudiante.materias_autorizadas.values_list("id", flat=True)),
        regularidades=regularidades_resumen,
        lugar_nacimiento=persona.lugar_nacimiento if persona else None,
        genero=persona.genero if persona else None,
    )
