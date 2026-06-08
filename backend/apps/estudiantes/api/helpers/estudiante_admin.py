"""Helpers para administración de estudiantes (documentación, detalle, actualización)."""

from __future__ import annotations

from collections.abc import Iterable

from apps.common.date_utils import format_date, parse_date

from django.contrib.auth.models import User

from apps.common.api_schemas import ApiResponse
from core.models import (
    Estudiante,
    EstudianteCarrera,
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

def _extract_documentacion_from_ec(ec: EstudianteCarrera) -> dict:
    """Extrae los campos de documentación de un EstudianteCarrera."""
    return {key: getattr(ec, key) for key in DOCUMENTACION_FIELDS if hasattr(ec, key)}


def _extract_documentacion(est: Estudiante) -> dict:
    """Backward-compat: extrae docs del Estudiante (fallback si no hay EC)."""
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

    if allow_estado_legajo and payload.estado_legajo is not None:
        val = str(payload.estado_legajo).upper()
        if val in ("COM", "INC", "PEN"):
            est.estado_legajo = val
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
        est.fecha_nacimiento_temp = new_date

    # --- Documentación: se escribe en EstudianteCarrera (por carrera) ---
    has_doc_updates = (
        payload.documentacion is not None
        or payload.curso_introductorio_aprobado is not None
        or payload.libreta_entregada is not None
    )
    if has_doc_updates:
        # Resolver la EC objetivo
        profesorado_id = getattr(payload, "profesorado_id", None)
        ecs = EstudianteCarrera.objects.filter(estudiante=est)
        if profesorado_id:
            ecs = ecs.filter(profesorado_id=profesorado_id)

        ec_list = list(ecs)
        for ec in ec_list:
            ec_fields: list[str] = []

            if payload.documentacion is not None:
                if hasattr(payload.documentacion, "model_dump"):
                    doc_updates = payload.documentacion.model_dump(exclude_unset=True)
                else:
                    doc_updates = payload.documentacion if isinstance(payload.documentacion, dict) else {}
                for key, value in doc_updates.items():
                    if hasattr(ec, key):
                        setattr(ec, key, value)
                        ec_fields.append(key)

            if payload.curso_introductorio_aprobado is not None and hasattr(ec, "curso_introductorio_aprobado"):
                ec.curso_introductorio_aprobado = payload.curso_introductorio_aprobado
                ec_fields.append("curso_introductorio_aprobado")

            if payload.libreta_entregada is not None and hasattr(ec, "libreta_entregada"):
                ec.libreta_entregada = payload.libreta_entregada
                ec_fields.append("libreta_entregada")

            if ec_fields:
                ec.save(update_fields=ec_fields)
                _recalcular_estado_legajo_ec(ec)

    # Fields to store directly in models (Persona or Estudiante)
    PERSONA_KEYS = (
        "genero", "cuil", "lugar_nacimiento", "nacionalidad",
        "localidad_nac", "provincia_nac", "pais_nac",
        "estado_civil", "nombre", "apellido", "email", "telefono", "domicilio"
    )

    if est.persona:
        persona_updates = []

        if payload.dni is not None:
            est.persona.dni = str(payload.dni).strip()
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
        "cud_informado", "condicion_salud_informada", "trabaja"
    )

    for key in ESTUDIANTE_KEYS:
        value = getattr(payload, key, None)
        if value is not None:
            if key == "anio_ingreso" and value == "":
                value = None
            setattr(est, key, value)
            fields_to_update.add(key)

    if mark_profile_complete and not est.datos_extra.get("perfil_actualizado"):
        est.datos_extra["perfil_actualizado"] = True
        fields_to_update.add("datos_extra")

    if fields_to_update:
        est.save(update_fields=list(fields_to_update))

    if payload.carreras_update is not None:
        from core.models.inscripciones import InscripcionMateriaEstudiante, InscripcionMateriaMovimiento
        from django.utils import timezone

        anio_actual = timezone.now().year

        for cu in payload.carreras_update:
            profesorado_id = cu.get("profesorado_id") if isinstance(cu, dict) else getattr(cu, "profesorado_id", None)

            if profesorado_id is None:
                continue

            ec = EstudianteCarrera.objects.filter(estudiante=est, profesorado_id=profesorado_id).first()
            if ec:
                ec_updates = []
                estado_academico = cu.get("estado_academico") if isinstance(cu, dict) else getattr(cu, "estado_academico", None)
                force_baja = cu.get("force_baja_materias") if isinstance(cu, dict) else getattr(cu, "force_baja_materias", False)

                if estado_academico is not None:
                    if estado_academico == 'BAJ' and ec.estado_academico != 'BAJ':
                        inscripciones_activas = InscripcionMateriaEstudiante.objects.filter(
                            estudiante=est,
                            anio=anio_actual,
                            materia__plan_de_estudio__profesorado_id=profesorado_id,
                            estado__in=[
                                InscripcionMateriaEstudiante.Estado.CONFIRMADA,
                                InscripcionMateriaEstudiante.Estado.PENDIENTE,
                                InscripcionMateriaEstudiante.Estado.CONDICIONAL
                            ]
                        ).select_related('materia')

                        if inscripciones_activas.exists():
                            if not force_baja:
                                materias_inscriptas = [{"id": i.id, "materia": i.materia.nombre} for i in inscripciones_activas]
                                return False, (409, ApiResponse(
                                    ok=False,
                                    message="El estudiante tiene inscripciones activas.",
                                    data={"code": "ACTIVE_ENROLLMENTS", "inscripciones": materias_inscriptas}
                                ))
                            else:
                                for ins in inscripciones_activas:
                                    ins.estado = InscripcionMateriaEstudiante.Estado.BAJA
                                    ins.baja_fecha = timezone.now().date()
                                    ins.baja_motivo = "Baja automática por baja del profesorado."
                                    ins.save(update_fields=["estado", "baja_fecha", "baja_motivo", "updated_at"])
                                    InscripcionMateriaMovimiento.objects.create(
                                        inscripcion=ins,
                                        tipo=InscripcionMateriaMovimiento.Tipo.BAJA,
                                        operador="Sistema (Admin)",
                                        motivo_detalle="Baja automática en cascada."
                                    )

                    ec.estado_academico = estado_academico
                    ec_updates.append("estado_academico")

                if ec_updates:
                    ec.save(update_fields=ec_updates)

    return True, None


def _recalcular_estado_legajo_ec(ec: EstudianteCarrera) -> None:
    """Recalcula y persiste EstudianteCarrera.estado_legajo para una carrera específica."""
    doc_data = _extract_documentacion_from_ec(ec)

    # Merge con PreinscripcionChecklist si existe uno para esta carrera
    checklist = PreinscripcionChecklist.objects.filter(
        preinscripcion__alumno=ec.estudiante,
        preinscripcion__carrera_id=ec.profesorado_id,
    ).order_by("-updated_at").first()

    # Si no hay checklist por carrera, intentar el más reciente del estudiante
    if not checklist:
        checklist = PreinscripcionChecklist.objects.filter(
            preinscripcion__alumno=ec.estudiante
        ).order_by("-updated_at").first()

    if checklist:
        checklist_map = {
            "dni_legalizado": checklist.dni_legalizado,
            "fotos_4x4": checklist.fotos_4x4,
            "certificado_salud": checklist.certificado_salud,
            "folios_oficio": checklist.folios_oficio,
            "titulo_secundario_legalizado": checklist.titulo_secundario_legalizado,
            "certificado_titulo_en_tramite": checklist.certificado_titulo_en_tramite,
            "analitico_legalizado": checklist.analitico_legalizado,
            "articulo_7": getattr(checklist, "articulo_7", False),
        }
        for k, v in checklist_map.items():
            if doc_data.get(k) in (None, False, 0, ""):
                doc_data[k] = v

    condicion = _determine_condicion(doc_data)

    CONDICION_TO_ESTADO = {
        "Regular": EstudianteCarrera.EstadoLegajo.COMPLETO,
        "Condicional": EstudianteCarrera.EstadoLegajo.INCOMPLETO,
        "Pendiente": EstudianteCarrera.EstadoLegajo.PENDIENTE,
    }
    nuevo_estado = CONDICION_TO_ESTADO.get(condicion, EstudianteCarrera.EstadoLegajo.PENDIENTE)

    if ec.estado_legajo != nuevo_estado:
        ec.estado_legajo = nuevo_estado
        ec.save(update_fields=["estado_legajo"])

    # Liberar resguardos de la carrera si el legajo pasó a COMPLETO
    if nuevo_estado == EstudianteCarrera.EstadoLegajo.COMPLETO:
        Regularidad.objects.filter(
            estudiante=ec.estudiante,
            materia__plan_de_estudio__profesorado=ec.profesorado,
            en_resguardo=True,
        ).update(en_resguardo=False)


def _recalcular_estado_legajo(est: Estudiante) -> None:
    """Backward-compat: recalcula el estado en todas las carreras del estudiante."""
    for ec in EstudianteCarrera.objects.filter(estudiante=est):
        _recalcular_estado_legajo_ec(ec)


def _determine_condicion(documentacion: dict | None) -> str:
    if not documentacion:
        return "Pendiente"
    requisito_basico = all(
        (
            bool(documentacion.get("dni_legalizado")),
            bool(documentacion.get("fotos_4x4")),
            bool(documentacion.get("certificado_salud")),
            (documentacion.get("folios_oficio") or 0) >= 1,
        )
    )
    titulo_ok = bool(documentacion.get("titulo_secundario_legalizado"))
    es_articulo_7 = bool(documentacion.get("articulo_7"))

    if requisito_basico and (titulo_ok or es_articulo_7):
        return "Regular"

    indicadores_actividad = any(
        [
            bool(documentacion.get("dni_legalizado")),
            bool(documentacion.get("fotos_4x4")),
            bool(documentacion.get("certificado_salud")),
            bool(documentacion.get("folios_oficio")),
            bool(documentacion.get("titulo_secundario_legalizado")),
            bool(documentacion.get("certificado_titulo_en_tramite")),
            bool(documentacion.get("analitico_legalizado")),
            bool(documentacion.get("articulo_7")),
            bool(documentacion.get("certificado_alumno_regular_sec")),
            bool(documentacion.get("adeuda_materias")),
            bool(documentacion.get("es_certificacion_docente")),
        ]
    )

    if indicadores_actividad:
        return "Condicional"

    return "Pendiente"


def _build_admin_detail(estudiante: Estudiante, allowed_carrera_ids: set[int] | None = None) -> EstudianteAdminDetail:
    user = estudiante.user if estudiante.user_id else None
    persona = estudiante.persona

    ecs_list = list(estudiante.carreras_detalle.select_related("profesorado").all())
    ecs_by_prof: dict[int, EstudianteCarrera] = {ec.profesorado_id: ec for ec in ecs_list}

    # Pre-cachear el checklist global (fallback cuando no hay uno específico por carrera)
    global_checklist = PreinscripcionChecklist.objects.filter(
        preinscripcion__alumno=estudiante
    ).order_by("-updated_at").first()

    carreras_det = []
    carreras_nombres = []

    for cd in ecs_list:
        if allowed_carrera_ids is not None and cd.profesorado_id not in allowed_carrera_ids:
            continue

        ec = ecs_by_prof.get(cd.profesorado_id)
        ec_doc_data = _extract_documentacion_from_ec(ec) if ec else {}

        checklist = PreinscripcionChecklist.objects.filter(
            preinscripcion__alumno=estudiante,
            preinscripcion__carrera_id=cd.profesorado_id,
        ).order_by("-updated_at").first() or global_checklist

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
                if ec_doc_data.get(k) in (None, False, 0, ""):
                    ec_doc_data[k] = v

        condicion = _determine_condicion(ec_doc_data)
        ec_estado_legajo = ec.estado_legajo if ec else "PEN"
        ec_curso_intro = ec.curso_introductorio_aprobado if ec else False
        if checklist and not ec_curso_intro:
            ec_curso_intro = bool(checklist.curso_introductorio_aprobado)
        ec_libreta = ec.libreta_entregada if ec else False

        carreras_det.append({
            "profesorado_id": cd.profesorado_id,
            "nombre": cd.profesorado.nombre,
            "estado_academico": cd.estado_academico,
            "estado_academico_display": cd.get_estado_academico_display(),
            "condicion": condicion,
            "estado_legajo": ec_estado_legajo,
            "documentacion": EstudianteAdminDocumentacion(**ec_doc_data) if ec_doc_data else None,
            "curso_introductorio_aprobado": ec_curso_intro,
            "libreta_entregada": ec_libreta,
        })
        carreras_nombres.append(cd.profesorado.nombre)

    # Para los campos de nivel superior, usamos la primera carrera como referencia
    if carreras_det:
        first_det = carreras_det[0]
        documentacion = first_det["documentacion"]
        condicion_calculada = first_det["condicion"]
        curso_introductorio_aprobado = first_det["curso_introductorio_aprobado"]
        libreta_entregada = first_det["libreta_entregada"]
        estado_legajo = first_det["estado_legajo"]
    else:
        documentacion = None
        condicion_calculada = "Pendiente"
        curso_introductorio_aprobado = False
        libreta_entregada = False
        estado_legajo = estudiante.estado_legajo

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

    # Fallback: si los campos están vacíos, usar datos_extra de preinscripción pendiente
    pre_extra = {}
    from core.models import Preinscripcion as _Preinscripcion
    pre_pendiente = (
        _Preinscripcion.objects.filter(alumno=estudiante, estado__in=["Enviada", "Observada"])
        .order_by("-updated_at")
        .first()
    )
    if pre_pendiente:
        pre_extra = pre_pendiente.datos_extra or {}

    def _fb(value, key, default=None):
        """Devuelve value si no es None/vacío, sino el fallback de pre_extra."""
        if value not in (None, "", False, 0):
            return value
        return pre_extra.get(key, default)

    from apps.preinscriptions.services.preinscripcion_service import map_genero

    extra_data = {
        "anio_ingreso": estudiante.anio_ingreso,
        "cohorte": estudiante.cohorte,
        "observaciones": estudiante.observaciones,
        "lugar_nacimiento": persona.lugar_nacimiento if persona else None,
        "genero": map_genero(_fb(persona.genero if persona else None, "genero")),
        "cuil": _fb(persona.cuil if persona else None, "cuil"),
        "nacionalidad": _fb(persona.nacionalidad if persona else None, "nacionalidad"),
        "estado_civil": _fb(persona.estado_civil if persona else None, "estado_civil"),
        "localidad_nac": _fb(persona.localidad_nac if persona else None, "localidad_nac"),
        "provincia_nac": _fb(persona.provincia_nac if persona else None, "provincia_nac"),
        "pais_nac": _fb(persona.pais_nac if persona else None, "pais_nac"),
        "emergencia_telefono": _fb(persona.telefono_emergencia if persona else None, "emergencia_telefono"),
        "emergencia_parentesco": _fb(persona.parentesco_emergencia if persona else None, "emergencia_parentesco"),
        "trabaja": _fb(estudiante.trabaja, "trabaja", False),
        "empleador": _fb(estudiante.empleador, "empleador"),
        "horario_trabajo": _fb(estudiante.horario_trabajo, "horario_trabajo"),
        "domicilio_trabajo": _fb(estudiante.domicilio_trabajo, "domicilio_trabajo"),
        "cud_informado": _fb(estudiante.cud_informado, "cud_informado", False),
        "condicion_salud_informada": _fb(estudiante.condicion_salud_informada, "condicion_salud_informada", False),
        "condicion_salud_detalle": _fb(estudiante.condicion_salud_detalle, "condicion_salud_detalle"),
        "sec_titulo": _fb(estudiante.sec_titulo, "sec_titulo"),
        "sec_establecimiento": _fb(estudiante.sec_establecimiento, "sec_establecimiento"),
        "sec_fecha_egreso": format_date(_fb(estudiante.sec_fecha_egreso, "sec_fecha_egreso")),
        "sec_localidad": _fb(estudiante.sec_localidad, "sec_localidad"),
        "sec_provincia": _fb(estudiante.sec_provincia, "sec_provincia"),
        "sec_pais": _fb(estudiante.sec_pais, "sec_pais"),
    }

    return EstudianteAdminDetail(
        dni=estudiante.dni,
        apellido=estudiante.apellido,
        nombre=estudiante.nombre,
        email=estudiante.email,
        telefono=estudiante.telefono,
        domicilio=estudiante.domicilio,
        fecha_nacimiento=format_date(estudiante.fecha_nacimiento),
        estado_legajo=estado_legajo,
        estado_legajo_display=dict(EstudianteCarrera.EstadoLegajo.choices).get(estado_legajo, estado_legajo),
        must_change_password=estudiante.must_change_password,
        activo=user.is_active if user else False,
        carreras=carreras_nombres,
        carreras_detalle=carreras_det,
        legajo=estudiante.legajo or None,
        datos_extra=extra_data,
        documentacion=documentacion,
        condicion_calculada=condicion_calculada,
        curso_introductorio_aprobado=curso_introductorio_aprobado,
        libreta_entregada=libreta_entregada,
        autorizado_rendir=estudiante.autorizado_rendir,
        autorizado_rendir_observacion=estudiante.autorizado_rendir_observacion,
        materias_autorizadas=list(estudiante.materias_autorizadas.values_list("id", flat=True)),
        regularidades=regularidades_resumen,
        lugar_nacimiento=persona.lugar_nacimiento if persona else None,
        genero=persona.genero if persona else None,
    )
