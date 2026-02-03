from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from ninja import Router, Schema, Body
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from apps.alumnos.api.reportes_api import _check_correlativas_caidas
from core.permissions import ensure_profesorado_access, allowed_profesorados
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    Comision,
    Estudiante,
    InscripcionMateriaAlumno,
    Materia,
    PlanDeEstudio,
    Regularidad,
    RegularidadPlanillaLock,
    PreinscripcionChecklist,
)
from .notas_utils import (
    normalized_user_roles,
    docente_from_user,
    format_user_display,
    user_has_privileged_planilla_access,
    regularidad_lock_for_scope,
    virtual_comision_id,
    split_virtual_comision_id,
    situaciones_para_formato,
    alias_desde_situacion,
    docente_to_string,
    FORMATOS_TALLER,
    ALIAS_TO_SITUACION,
)

# ==============================================================================
# SCHEMAS
# ==============================================================================

class RegularidadPlanillaOut(Schema):
    materia_id: int
    materia_nombre: str
    materia_anio: int | None = None
    formato: str | None = None
    regimen: str | None = None
    comision_id: int  # Id real o negativo si es virtual
    comision_codigo: str
    anio: int
    turno: str
    profesorado_id: int | None = None
    profesorado_nombre: str | None = None
    plan_id: int | None = None
    plan_resolucion: str | None = None
    docentes: list[str] = []
    fecha_cierre: date | None = None
    esta_cerrada: bool
    cerrada_en: str | None = None
    cerrada_por: str | None = None
    puede_editar: bool
    puede_cerrar: bool
    puede_reabrir: bool
    situaciones: list[dict]
    alumnos: list["RegularidadAlumnoOut"]

class RegularidadAlumnoOut(Schema):
    inscripcion_id: int
    alumno_id: int
    orden: int
    apellido_nombre: str
    dni: str
    nota_tp: float | None = None
    nota_final: float | None = None
    asistencia: float | None = None
    excepcion: bool = False
    situacion: str | None = None
    observaciones: str | None = None
    correlativas_caidas: list[str] = []

class RegularidadCargaAlumno(Schema):
    inscripcion_id: int
    nota_tp: float | None = None
    nota_final: float | None = None
    # Campo asistencia numerico (0-100)
    asistencia: float | None = None
    excepcion: bool = False
    situacion: str  # Alias (REGULAR, APROBADO, etc)
    observaciones: str | None = None

class RegularidadCargaIn(Schema):
    comision_id: int  # Id real o negativo vritual
    fecha_cierre: date | None = None
    alumnos: list[RegularidadCargaAlumno]

class RegularidadCierreIn(Schema):
    comision_id: int
    accion: str  # 'cerrar' o 'reabrir'

class CargaNotasLookup(Schema):
    materias: list["MateriaOption"]
    comisiones: list["ComisionOption"]

class MateriaOption(Schema):
    id: int
    nombre: str
    plan_id: int
    anio: int
    cuatrimestre: str | None = None
    formato: str | None = None

class ComisionOption(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    anio: int
    cuatrimestre: str | None = None
    turno: str
    codigo: str

# Rebuild schemas to resolve forward refs
RegularidadPlanillaOut.model_rebuild()
CargaNotasLookup.model_rebuild()


# ==============================================================================
# LOGIC & ENDPOINTS
# ==============================================================================

router = Router(tags=["carga_notas"])

def _build_regularidad_alumnos(inscripciones) -> list[RegularidadAlumnoOut]:
    if not inscripciones:
        return []

    first_insc = inscripciones[0]
    materia_id = first_insc.materia_id
    anio_cursada = first_insc.anio
    
    caidas_report = _check_correlativas_caidas(anio_cursada, materia_id=materia_id)
    
    caidas_map = {}
    for item in caidas_report:
        est_id = item["estudiante_id"]
        if est_id not in caidas_map:
            caidas_map[est_id] = []
        msg = f"{item['materia_correlativa']}: {item['motivo']}"
        caidas_map[est_id].append(msg)

    alumnos: list[RegularidadAlumnoOut] = []
    for idx, insc in enumerate(inscripciones, start=1):
        regularidad = (
            Regularidad.objects.filter(
                inscripcion=insc,
            )
            .order_by("-fecha_cierre", "-id")
            .first()
        )

        alias = alias_desde_situacion(regularidad.situacion) if regularidad else None
        alumnos.append(
            RegularidadAlumnoOut(
                inscripcion_id=insc.id,
                alumno_id=insc.estudiante_id,
                orden=idx,
                apellido_nombre=insc.estudiante.user.get_full_name() if insc.estudiante.user_id else "",
                dni=insc.estudiante.dni,
                nota_tp=float(regularidad.nota_trabajos_practicos)
                if regularidad and regularidad.nota_trabajos_practicos is not None
                else None,
                nota_final=regularidad.nota_final_cursada if regularidad else None,
                asistencia=regularidad.asistencia_porcentaje if regularidad else None,
                excepcion=regularidad.excepcion if regularidad else False,
                situacion=alias,
                observaciones=regularidad.observaciones if regularidad else None,
                correlativas_caidas=caidas_map.get(insc.estudiante_id, []),
            )
        )
    return alumnos

def _max_regularidad_fecha(inscripciones) -> date | None:
    inscripcion_ids = [insc.id for insc in inscripciones if getattr(insc, "id", None)]
    if not inscripcion_ids:
        return None
    aggregate = Regularidad.objects.filter(inscripcion_id__in=inscripcion_ids).aggregate(max_fecha=Max("fecha_cierre"))
    return aggregate.get("max_fecha")


@router.get(
    "/comisiones",
    response=CargaNotasLookup,
    auth=JWTAuth(),
)
def listar_comisiones(
    request,
    profesorado_id: int | None = None,
    materia_id: int | None = None,
    plan_id: int | None = None,
    anio: int | None = None,
    cuatrimestre: str | None = None,
):
    if not plan_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
    if not plan:
        return CargaNotasLookup(materias=[], comisiones=[])

    if profesorado_id and profesorado_id != plan.profesorado_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    roles = normalized_user_roles(request.user)
    is_privileged = bool(roles.intersection({"admin", "secretaria", "bedel", "titulos", "coordinador"}))
    docente_profile = docente_from_user(request.user) if "docente" in roles and not is_privileged else None

    comisiones_qs = (
        Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
        )
        .filter(materia__plan_de_estudio=plan)
        .order_by("-anio_lectivo", "materia__nombre", "codigo")
    )

    if docente_profile:
        comisiones_qs = comisiones_qs.filter(docente=docente_profile)

    if materia_id:
        comisiones_qs = comisiones_qs.filter(materia_id=materia_id)
    if anio:
        comisiones_qs = comisiones_qs.filter(anio_lectivo=anio)
    if cuatrimestre:
        comisiones_qs = comisiones_qs.filter(materia__regimen=cuatrimestre)

    materias_qs = Materia.objects.filter(plan_de_estudio=plan)
    if docente_profile:
        materias_qs = materias_qs.filter(comision__docente=docente_profile).distinct()
    if materia_id:
        materias_qs = materias_qs.filter(id=materia_id)
    materias_qs = materias_qs.order_by("anio_cursada", "nombre")

    materias_out: list[MateriaOption] = [
        MateriaOption(
            id=m.id,
            nombre=m.nombre,
            plan_id=plan.id,
            anio=m.anio_cursada,
            cuatrimestre=m.regimen,
            formato=getattr(m, "formato", None),
        )
        for m in materias_qs
    ]

    comisiones_out: list[ComisionOption] = []
    for com in comisiones_qs:
        materia_obj = com.materia
        plan_obj = materia_obj.plan_de_estudio
        profesorado = plan_obj.profesorado
        comisiones_out.append(
            ComisionOption(
                id=com.id,
                materia_id=materia_obj.id,
                materia_nombre=materia_obj.nombre,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan_obj.id,
                plan_resolucion=plan_obj.resolucion,
                anio=com.anio_lectivo,
                cuatrimestre=materia_obj.regimen,
                turno=com.turno.nombre if com.turno else "",
                codigo=com.codigo,
            )
        )

    if not docente_profile:
        inscripciones_libres = InscripcionMateriaAlumno.objects.filter(materia__plan_de_estudio=plan, comision__isnull=True)
        if materia_id:
            inscripciones_libres = inscripciones_libres.filter(materia_id=materia_id)
        if anio:
            inscripciones_libres = inscripciones_libres.filter(anio=anio)
        if cuatrimestre:
            inscripciones_libres = inscripciones_libres.filter(materia__regimen=cuatrimestre)

        libres_distintos = inscripciones_libres.values(
            "materia_id",
            "materia__nombre",
            "materia__regimen",
            "materia__formato",
            "anio",
        ).distinct()

        for row in libres_distintos:
            materia_row_id = row["materia_id"]
            materia_nombre = row["materia__nombre"]
            regimen = row["materia__regimen"]
            anio_row = row["anio"]
            comisiones_out.append(
                ComisionOption(
                    id=virtual_comision_id(materia_row_id, anio_row),
                    materia_id=materia_row_id,
                    materia_nombre=materia_nombre,
                    profesorado_id=plan.profesorado_id,
                    profesorado_nombre=plan.profesorado.nombre,
                    plan_id=plan.id,
                    plan_resolucion=plan.resolucion,
                    anio=anio_row or 0,
                    cuatrimestre=regimen,
                    turno="Sin turno",
                    codigo="Sin comision",
                )
            )

    return CargaNotasLookup(materias=materias_out, comisiones=comisiones_out)


@router.get(
    "/regularidad",
    response={200: RegularidadPlanillaOut, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def obtener_planilla_regularidad(request, comision_id: int):
    can_override_lock = user_has_privileged_planilla_access(request.user)
    if comision_id >= 0:
        comision = (
            Comision.objects.select_related("materia__plan_de_estudio__profesorado", "turno", "docente")
            .filter(id=comision_id)
            .first()
        )
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")

        situaciones = situaciones_para_formato(comision.materia.formato)
        materia = comision.materia
        plan = materia.plan_de_estudio if materia else None
        profesorado = plan.profesorado if plan else None

        inscripciones_qs = (
            InscripcionMateriaAlumno.objects.filter(
                comision_id=comision.id,
                anio=comision.anio_lectivo,
            )
            .select_related("estudiante__user", "materia")
            .order_by(
                "estudiante__user__last_name",
                "estudiante__user__first_name",
                "estudiante__dni",
            )
        )

        inscripciones = list(inscripciones_qs)
        alumnos = _build_regularidad_alumnos(inscripciones)
        turno_nombre = comision.turno.nombre if comision.turno else ""
        fecha_cierre = _max_regularidad_fecha(inscripciones)
        docente_principal = docente_to_string(comision.docente)
        docentes = [docente_principal] if docente_principal else []
        lock = regularidad_lock_for_scope(comision=comision)
        esta_cerrada = lock is not None

        return RegularidadPlanillaOut(
            materia_id=comision.materia_id,
            materia_nombre=comision.materia.nombre,
            materia_anio=materia.anio_cursada if materia else None,
            formato=comision.materia.formato,
            regimen=materia.regimen if materia else None,
            comision_id=comision.id,
            comision_codigo=comision.codigo,
            anio=comision.anio_lectivo,
            turno=turno_nombre,
            profesorado_id=profesorado.id if profesorado else None,
            profesorado_nombre=profesorado.nombre if profesorado else None,
            plan_id=plan.id if plan else None,
            plan_resolucion=plan.resolucion if plan else None,
            docentes=docentes,
            fecha_cierre=fecha_cierre,
            esta_cerrada=esta_cerrada,
            cerrada_en=lock.cerrado_en.isoformat() if lock else None,
            cerrada_por=format_user_display(lock.cerrado_por) if lock else None,
            puede_editar=(not esta_cerrada) or can_override_lock,
            puede_cerrar=not esta_cerrada,
            puede_reabrir=esta_cerrada and can_override_lock,
            situaciones=situaciones,
            alumnos=alumnos,
        )

    materia_id, anio_virtual = split_virtual_comision_id(comision_id)

    materia = Materia.objects.select_related("plan_de_estudio__profesorado").filter(id=materia_id).first()
    if not materia:
        return 404, ApiResponse(
            ok=False,
            message="Materia no encontrada para la comision virtual.",
        )

    situaciones = situaciones_para_formato(materia.formato)

    inscripciones_qs = (
        InscripcionMateriaAlumno.objects.filter(
            materia_id=materia.id,
            comision__isnull=True,
        )
        .select_related("estudiante__user", "materia")
        .order_by(
            "estudiante__user__last_name",
            "estudiante__user__first_name",
            "estudiante__dni",
        )
    )
    if anio_virtual is not None:
        inscripciones_qs = inscripciones_qs.filter(anio=anio_virtual)

    inscripciones = list(inscripciones_qs)
    alumnos = _build_regularidad_alumnos(inscripciones)
    fecha_cierre = _max_regularidad_fecha(inscripciones)
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado if plan else None
    lock_anio = anio_virtual if anio_virtual is not None else 0
    lock = regularidad_lock_for_scope(materia=materia, anio_virtual=lock_anio)
    esta_cerrada = lock is not None

    return RegularidadPlanillaOut(
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        materia_anio=materia.anio_cursada,
        formato=materia.formato,
        regimen=materia.regimen,
        comision_id=comision_id,
        comision_codigo="Sin comision",
        anio=anio_virtual if anio_virtual is not None else date.today().year,
        turno="Sin turno",
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        plan_id=plan.id if plan else None,
        plan_resolucion=plan.resolucion if plan else None,
        docentes=[],
        fecha_cierre=fecha_cierre,
        esta_cerrada=esta_cerrada,
        cerrada_en=lock.cerrado_en.isoformat() if lock else None,
        cerrada_por=format_user_display(lock.cerrado_por),
        puede_editar=(not esta_cerrada) or can_override_lock,
        puede_cerrar=not esta_cerrada,
        puede_reabrir=esta_cerrada and can_override_lock,
        situaciones=situaciones,
        alumnos=alumnos,
    )


@router.post(
    "/regularidad",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def guardar_planilla_regularidad(request, payload: RegularidadCargaIn = Body(...)):
    is_virtual = payload.comision_id < 0
    comision = None
    materia = None
    anio_virtual = None
    lock = None
    can_override_lock = user_has_privileged_planilla_access(request.user)

    if is_virtual:
        materia_id, anio_virtual = split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia:
            return 404, ApiResponse(
                ok=False,
                message="Materia no encontrada para la comision virtual.",
            )
        lock_key = anio_virtual if anio_virtual is not None else 0
        lock = regularidad_lock_for_scope(materia=materia, anio_virtual=lock_key)
    else:
        comision = Comision.objects.select_related("materia").filter(id=payload.comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        materia = comision.materia
        lock = regularidad_lock_for_scope(comision=comision)

        if not can_override_lock:
            if not comision.docente:
                 return 403, ApiResponse(ok=False, message="La comisión no tiene docente asignado. Solo admin puede editar.")
            
            user_dni = getattr(request.user, "username", "")
            if comision.docente.dni != user_dni:
                 return 403, ApiResponse(ok=False, message="No tienes permiso para editar esta comisión.")

    if lock and not can_override_lock:
        return 403, ApiResponse(
            ok=False,
            message="La planilla ya fue cerrada. Solo secretaría o admin pueden modificarla.",
        )

    situaciones_validas = {item["alias"] for item in situaciones_para_formato(materia.formato)}

    if not payload.alumnos:
        return 400, ApiResponse(ok=False, message="No se enviaron alumnos para guardar.")

    fecha = payload.fecha_cierre or date.today()

    with transaction.atomic():
        for alumno in payload.alumnos:
            if alumno.situacion not in situaciones_validas:
                return 400, ApiResponse(
                    ok=False,
                    message=f"Situacion '{alumno.situacion}' no permitida para el formato de la materia.",
                )

            situacion_codigo = ALIAS_TO_SITUACION.get(alumno.situacion)
            if not situacion_codigo:
                return 400, ApiResponse(ok=False, message=f"Situacion desconocida: {alumno.situacion}")

            if alumno.situacion == "PROMOCION" and alumno.nota_final is not None and alumno.nota_final < 8:
                return 400, ApiResponse(
                    ok=False,
                    message="La nota final debe ser >= 8 para registrar PROMOCION.",
                )

            inscripcion_qs = InscripcionMateriaAlumno.objects.filter(
                id=alumno.inscripcion_id,
            )

            if is_virtual:
                inscripcion_qs = inscripcion_qs.filter(
                    materia_id=materia.id,
                    comision__isnull=True,
                )
                if anio_virtual is not None:
                    inscripcion_qs = inscripcion_qs.filter(anio=anio_virtual)
            else:
                inscripcion_qs = inscripcion_qs.filter(comision_id=comision.id)

            inscripcion = inscripcion_qs.select_related("estudiante", "materia").first()

            if not inscripcion:
                if is_virtual:
                    message = f"Inscripcion {alumno.inscripcion_id} no corresponde a la materia sin comision."
                else:
                    message = f"Inscripcion {alumno.inscripcion_id} no pertenece a la comision."
                return 400, ApiResponse(ok=False, message=message)

            if materia.nombre.startswith("EDI: "):
                estudiante = inscripcion.estudiante
                try:
                    checklist = PreinscripcionChecklist.objects.get(preinscripcion__alumno=estudiante)
                    if not checklist.curso_introductorio_aprobado and situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                            raise HttpError(
                                400,
                                f"El estudiante {estudiante.dni} no tiene el curso introductorio aprobado. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'. Debe ser 'Condicional' o similar.",
                            )
                except PreinscripcionChecklist.DoesNotExist:
                    if situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                        raise HttpError(
                            400,
                            (
                                f"El estudiante {estudiante.dni} no tiene un checklist de preinscripción. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'."
                            ),
                        ) from None
            
            asistencia = alumno.asistencia or 0
            excepcion = alumno.excepcion or False
            
            es_aprobatoria = situacion_codigo in [
                Regularidad.Situacion.APROBADO,
                Regularidad.Situacion.PROMOCIONADO,
                Regularidad.Situacion.REGULAR,
            ]
            
            if es_aprobatoria:
                 formato_up = (materia.formato or "").upper()
                 if formato_up in FORMATOS_TALLER:
                      piso = 65 if excepcion else 80
                      if asistencia < piso:
                           raise HttpError(
                               400, 
                               f"El alumno {alumno.dni} no cumple con la asistencia mínima ({piso}%) "
                               f"requerida para {materia.nombre} ({'con' if excepcion else 'sin'} excepción)."
                           )
                 else:
                      if asistencia < 65:
                           raise HttpError(
                               400,
                               f"El alumno {alumno.dni} no cumple con la asistencia mínima (65%) "
                               f"requerida para {materia.nombre}."
                           )

            Regularidad.objects.update_or_create(
                inscripcion=inscripcion,
                defaults={
                    "estudiante": inscripcion.estudiante,
                    "materia": inscripcion.materia,
                    "fecha_cierre": fecha,
                    "nota_trabajos_practicos": Decimal(str(alumno.nota_tp)) if alumno.nota_tp is not None else None,
                    "nota_final_cursada": alumno.nota_final,
                    "asistencia_porcentaje": alumno.asistencia,
                    "excepcion": alumno.excepcion,
                    "situacion": situacion_codigo,
                    "observaciones": alumno.observaciones or "",
                },
            )

    return ApiResponse(ok=True, message="Notas de regularidad guardadas correctamente.")


@router.post(
    "/regularidad/cierre",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def gestionar_regularidad_cierre(request, payload: RegularidadCierreIn = Body(...)):
    is_virtual = payload.comision_id < 0
    comision: Comision | None = None
    materia: Materia | None = None
    anio_virtual: int | None = None
    lock = None

    if is_virtual:
        materia_id, anio_virtual = split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia:
            return 404, ApiResponse(ok=False, message="Materia no encontrada para el cierre solicitado.")
        lock_key = anio_virtual if anio_virtual is not None else 0
        lock = regularidad_lock_for_scope(materia=materia, anio_virtual=lock_key)
    else:
        comision = Comision.objects.filter(id=payload.comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        lock = regularidad_lock_for_scope(comision=comision)

    accion = payload.accion.lower()
    can_override = user_has_privileged_planilla_access(request.user)

    if accion == "cerrar":
        if lock:
            return ApiResponse(ok=True, message="La planilla ya se encontraba cerrada.")
        RegularidadPlanillaLock.objects.create(
            comision=comision,
            materia=None if comision else materia,
            anio_virtual=None if comision else (anio_virtual if anio_virtual is not None else 0),
            cerrado_por=request.user if getattr(request.user, "is_authenticated", False) else None,
        )
        return ApiResponse(ok=True, message="Planilla cerrada correctamente.")

    if accion == "reabrir":
        if not can_override:
            return 403, ApiResponse(
                ok=False,
                message="Solo secretaría o admin pueden reabrir una planilla cerrada.",
            )
        if lock:
            lock.delete()
        return ApiResponse(ok=True, message="Planilla reabierta correctamente.")

    return 400, ApiResponse(ok=False, message="Accion de cierre no reconocida.")
