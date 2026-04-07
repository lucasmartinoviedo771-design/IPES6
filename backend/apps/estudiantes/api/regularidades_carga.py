"""
API de Carga de Regularidades y Notas de Cursada.
Gestiona el proceso formal de cierre de materias (cursadas), permitiendo a los docentes y bedeles
registrar calificaciones, asistencias y situaciones académicas finales.

Características Principales:
1. Validación de Formato: Aplica reglas de asistencia mínimas diferenciadas por Formato (Taller: 80%/65% vs Estándar: 65%).
2. Sistema de Bloqueo (Locks): Permite 'cerrar' las planillas para evitar modificaciones post-entrega formal.
3. Soporte para Comisiones Virtuales: Maneja inscripciones sin comisión física asignada.
4. Integración EDI: Valida el estado del Curso Introductorio antes de permitir la aprobación de espacios EDI.
5. Control de Correlatividades Caídas: Reporta incompatibilidades en tiempo real durante la carga.
"""

from datetime import date
from decimal import Decimal
from django.db import transaction
from django.db.models import Max
from ninja import Router, Schema, Body
from ninja.errors import HttpError
from apps.common.api_schemas import ApiResponse
from apps.estudiantes.api.reportes_api import _check_correlativas_caidas
from core.permissions import ensure_profesorado_access, allowed_profesorados
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    Comision,
    Estudiante,
    InscripcionMateriaEstudiante,
    Materia,
    PlanDeEstudio,
    Regularidad,
    RegularidadPlanillaLock,
    PreinscripcionChecklist,
)
from apps.common.date_utils import format_date, format_datetime
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
    """Representa la estructura completa de una planilla de cátedra para el frontend."""
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
    fecha_cierre: str | None = None
    esta_cerrada: bool
    cerrada_en: str | None = None
    cerrada_por: str | None = None
    puede_editar: bool
    puede_cerrar: bool
    puede_reabrir: bool
    situaciones: list[dict]
    estudiantes: list["RegularidadEstudianteOut"]

class RegularidadEstudianteOut(Schema):
    """Estado académico individual de un estudiante en una planilla específica."""
    inscripcion_id: int
    estudiante_id: int
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

class RegularidadCargaEstudiante(Schema):
    """Payload para la actualización de una fila en la planilla."""
    inscripcion_id: int
    nota_tp: float | None = None
    nota_final: float | None = None
    asistencia: float | None = None
    excepcion: bool = False
    situacion: str  # Alias (REGULAR, APROBADO, etc)
    observaciones: str | None = None

class RegularidadCargaIn(Schema):
    """Input para el guardado masivo de notas."""
    comision_id: int
    fecha_cierre: str | None = None
    estudiantes: list[RegularidadCargaEstudiante]

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

RegularidadPlanillaOut.model_rebuild()
CargaNotasLookup.model_rebuild()


# ==============================================================================
# LOGIC & ENDPOINTS
# ==============================================================================

router = Router(tags=["carga_notas"])

def _build_regularidad_estudiantes(inscripciones) -> list[RegularidadEstudianteOut]:
    """Auxiliar: Enriquecimiento de la nómina con detección de correlatividades caídas."""
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

    # Optimizamos la obtención de regularidades (evitar N+1)
    insc_ids = [insc.id for insc in inscripciones]
    regs_qs = Regularidad.objects.filter(inscripcion_id__in=insc_ids).order_by("inscripcion_id", "-fecha_cierre", "-id")
    
    reg_map = {}
    for r in regs_qs:
        if r.inscripcion_id not in reg_map:
            reg_map[r.inscripcion_id] = r

    estudiantes: list[RegularidadEstudianteOut] = []
    for idx, insc in enumerate(inscripciones, start=1):
        regularidad = reg_map.get(insc.id)
        alias = alias_desde_situacion(regularidad.situacion) if regularidad else None
        
        estudiantes.append(
            RegularidadEstudianteOut(
                inscripcion_id=insc.id,
                estudiante_id=insc.estudiante_id,
                orden=idx,
                apellido_nombre=insc.estudiante.user.get_full_name() if insc.estudiante.user_id else "",
                dni=insc.estudiante.dni,
                nota_tp=float(regularidad.nota_trabajos_practicos) if regularidad and regularidad.nota_trabajos_practicos is not None else None,
                nota_final=regularidad.nota_final_cursada if regularidad else None,
                asistencia=regularidad.asistencia_porcentaje if regularidad else None,
                excepcion=regularidad.excepcion if regularidad else False,
                situacion=alias,
                observaciones=regularidad.observaciones if regularidad else None,
                correlativas_caidas=caidas_map.get(insc.estudiante_id, []),
            )
        )
    return estudiantes

def _max_regularidad_fecha(inscripciones) -> date | None:
    """Retorna la fecha de cierre más reciente registrada en la nómina."""
    inscripcion_ids = [insc.id for insc in inscripciones if getattr(insc, "id", None)]
    if not inscripcion_ids:
        return None
    aggregate = Regularidad.objects.filter(inscripcion_id__in=inscripcion_ids).aggregate(max_fecha=Max("fecha_cierre"))
    return aggregate.get("max_fecha")


@router.get("/comisiones", response=CargaNotasLookup, auth=JWTAuth())
def listar_comisiones(request, profesorado_id: int | None = None, materia_id: int | None = None, plan_id: int | None = None, anio: int | None = None, cuatrimestre: str | None = None):
    """
    Retorna el catálogo de comisiones y materias disponibles para carga de notas.
    Filtra según el rol del usuario (Los docentes solo ven sus propias cátedras).
    """
    if not plan_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
    if not plan:
        return CargaNotasLookup(materias=[], comisiones=[])

    roles = normalized_user_roles(request.user)
    is_privileged = bool(roles.intersection({"admin", "secretaria", "bedel", "titulos", "coordinador"}))
    docente_profile = docente_from_user(request.user) if "docente" in roles and not is_privileged else None

    comisiones_qs = Comision.objects.select_related("materia__plan_de_estudio__profesorado", "turno").filter(materia__plan_de_estudio=plan).order_by("-anio_lectivo", "materia__nombre", "codigo")
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
    
    materias_out: list[MateriaOption] = [
        MateriaOption(id=m.id, nombre=m.nombre, plan_id=plan.id, anio=m.anio_cursada, cuatrimestre=m.regimen, formato=getattr(m, "formato", None))
        for m in materias_qs.order_by("anio_cursada", "nombre")
    ]

    comisiones_out: list[ComisionOption] = []
    for com in comisiones_qs:
        comisiones_out.append(
            ComisionOption(
                id=com.id, materia_id=com.materia.id, materia_nombre=com.materia.nombre,
                profesorado_id=plan.profesorado_id, profesorado_nombre=plan.profesorado.nombre,
                plan_id=plan.id, plan_resolucion=plan.resolucion,
                anio=com.anio_lectivo, cuatrimestre=com.materia.regimen,
                turno=com.turno.nombre if com.turno else "", codigo=com.codigo,
            )
        )

    # Lógica de Comisiones Virtuales (Solo para Staff)
    if not docente_profile:
        inscripciones_libres = InscripcionMateriaEstudiante.objects.filter(materia__plan_de_estudio=plan, comision__isnull=True)
        if materia_id: inscripciones_libres = inscripciones_libres.filter(materia_id=materia_id)
        if anio: inscripciones_libres = inscripciones_libres.filter(anio=anio)
        
        libres_distintos = inscripciones_libres.values("materia_id", "materia__nombre", "materia__regimen", "materia__formato", "anio").distinct()
        for row in libres_distintos:
            mid = row["materia_id"]
            anio_row = row["anio"]
            comisiones_out.append(
                ComisionOption(
                    id=virtual_comision_id(mid, anio_row), materia_id=mid, materia_nombre=row["materia__nombre"],
                    profesorado_id=plan.profesorado_id, profesorado_nombre=plan.profesorado.nombre,
                    plan_id=plan.id, plan_resolucion=plan.resolucion, anio=anio_row or 0,
                    cuatrimestre=row["materia__regimen"], turno="Sin turno", codigo="Sin comision",
                )
            )

    return CargaNotasLookup(materias=materias_out, comisiones=comisiones_out)


@router.get("/regularidad", response={200: RegularidadPlanillaOut, 400: ApiResponse, 404: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def obtener_planilla_regularidad(request, comision_id: int):
    """Retorna los datos completos de una planilla (real o virtual) incluyendo el estado del bloqueo."""
    can_override_lock = user_has_privileged_planilla_access(request.user)
    
    if comision_id >= 0:
        comision = Comision.objects.select_related("materia__plan_de_estudio__profesorado", "turno", "docente").filter(id=comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comisión no encontrada.")

        materia = comision.materia
        situaciones = situaciones_para_formato(materia.formato)
        inscripciones = list(InscripcionMateriaEstudiante.objects.filter(comision_id=comision.id, anio=comision.anio_lectivo).select_related("estudiante__user", "materia").order_by("estudiante__user__last_name", "estudiante__user__first_name", "estudiante__persona__dni"))
        
        estudiantes = _build_regularidad_estudiantes(inscripciones)
        lock = regularidad_lock_for_scope(comision=comision)
        esta_cerrada = lock is not None

        return RegularidadPlanillaOut(
            materia_id=materia.id, materia_nombre=materia.nombre, materia_anio=materia.anio_cursada,
            formato=materia.formato, regimen=materia.regimen, comision_id=comision.id, comision_codigo=comision.codigo,
            anio=comision.anio_lectivo, turno=comision.turno.nombre if comision.turno else "",
            profesorado_id=materia.plan_de_estudio.profesorado_id, profesorado_nombre=materia.plan_de_estudio.profesorado.nombre,
            plan_id=materia.plan_de_estudio.id, plan_resolucion=materia.plan_de_estudio.resolucion,
            docentes=[docente_to_string(comision.docente)] if comision.docente else [],
            fecha_cierre=format_date(_max_regularidad_fecha(inscripciones)),
            esta_cerrada=esta_cerrada, cerrada_en=format_datetime(lock.cerrado_en) if lock else None,
            cerrada_por=format_user_display(lock.cerrado_por) if lock else None,
            puede_editar=(not esta_cerrada) or can_override_lock,
            puede_cerrar=not esta_cerrada, puede_reabrir=esta_cerrada and can_override_lock,
            situaciones=situaciones, estudiantes=estudiantes,
        )

    # Resolución Virtual
    materia_id, anio_virtual = split_virtual_comision_id(comision_id)
    materia = Materia.objects.select_related("plan_de_estudio__profesorado").filter(id=materia_id).first()
    if not materia:
        return 404, ApiResponse(ok=False, message="Materia virtual no encontrada.")

    inscripciones = list(InscripcionMateriaEstudiante.objects.filter(materia_id=materia.id, comision__isnull=True, anio=anio_virtual if anio_virtual is not None else 0).select_related("estudiante__user", "materia").order_by("estudiante__user__last_name", "estudiante__user__first_name", "estudiante__persona__dni"))
    lock = regularidad_lock_for_scope(materia=materia, anio_virtual=anio_virtual if anio_virtual is not None else 0)
    esta_cerrada = lock is not None

    return RegularidadPlanillaOut(
        materia_id=materia.id, materia_nombre=materia.nombre, materia_anio=materia.anio_cursada,
        formato=materia.formato, regimen=materia.regimen, comision_id=comision_id, comision_codigo="Sin comision",
        anio=anio_virtual if anio_virtual is not None else date.today().year, turno="Sin turno",
        profesorado_id=materia.plan_de_estudio.profesorado_id, profesorado_nombre=materia.plan_de_estudio.profesorado.nombre,
        plan_id=materia.plan_de_estudio.id, plan_resolucion=materia.plan_de_estudio.resolucion,
        docentes=[], fecha_cierre=format_date(_max_regularidad_fecha(inscripciones)),
        esta_cerrada=esta_cerrada, cerrada_en=format_datetime(lock.cerrado_en) if lock else None,
        cerrada_por=format_user_display(lock.cerrado_por) if lock else None,
        puede_editar=(not esta_cerrada) or can_override_lock,
        puede_cerrar=not esta_cerrada, puede_reabrir=esta_cerrada and can_override_lock,
        situaciones=situaciones_para_formato(materia.formato), estudiantes=_build_regularidad_estudiantes(inscripciones),
    )


@router.post("/regularidad", response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def guardar_planilla_regularidad(request, payload: RegularidadCargaIn = Body(...)):
    """
    Guarda masivamente las notas y estados de regularidad de la cátedra.
    Aplica validaciones críticas de negocio: asistencia mínima, prerrequisitos EDI e integridad de roles.
    """
    is_virtual = payload.comision_id < 0
    can_override_lock = user_has_privileged_planilla_access(request.user)
    
    # 1. Resolución de ámbito y validación de Lock
    if is_virtual:
        materia_id, anio_virtual = split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia: return 404, ApiResponse(ok=False, message="Materia no encontrada.")
        lock = regularidad_lock_for_scope(materia=materia, anio_virtual=anio_virtual if anio_virtual is not None else 0)
    else:
        comision = Comision.objects.select_related("materia", "docente").filter(id=payload.comision_id).first()
        if not comision: return 404, ApiResponse(ok=False, message="Comisión no encontrada.")
        materia = comision.materia
        lock = regularidad_lock_for_scope(comision=comision)
        # Auditoría de acceso docente
        if not can_override_lock:
            if not comision.docente or comision.docente.dni != getattr(request.user, "username", ""):
                 return 403, ApiResponse(ok=False, message="Permiso denegado para esta cátedra.")

    if lock and not can_override_lock:
        return 403, ApiResponse(ok=False, message="La planilla está cerrada y no admite modificaciones.")

    situaciones_validas = {item["alias"] for item in situaciones_para_formato(materia.formato)}
    fecha_base = payload.fecha_cierre or date.today()
    user_dni = getattr(request.user, "username", "")

    with transaction.atomic():
        for est_payload in payload.estudiantes:
            # A. Validación de Situación (Codificada vs Alias)
            if est_payload.situacion not in situaciones_validas:
                return 400, ApiResponse(ok=False, message=f"Situación '{est_payload.situacion}' no válida para el formato {materia.formato}.")
            
            situ_cod = ALIAS_TO_SITUACION.get(est_payload.situacion)
            if not situ_cod: return 400, ApiResponse(ok=False, message="Situación académica desconocida.")

            # B. Validación de Promoción
            if est_payload.situacion == "PROMOCION" and (est_payload.nota_final or 0) < 8:
                return 400, ApiResponse(ok=False, message="La promoción requiere una nota final >= 8.")

            # C. Integridad e Identidad
            insc = InscripcionMateriaEstudiante.objects.filter(id=est_payload.inscripcion_id).select_related("estudiante").first()
            if not insc: return 400, ApiResponse(ok=False, message="Inscripción inválida.")
            if insc.estudiante.dni == user_dni:
                 return 403, ApiResponse(ok=False, message="No puede calificar su propio legajo.")

            # D. Bloqueo Institucional EDI
            if (materia.nombre or "").startswith("EDI: "):
                try:
                    checklist = PreinscripcionChecklist.objects.get(preinscripcion__estudiante=insc.estudiante)
                    if not checklist.curso_introductorio_aprobado and situ_cod in [Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO, Regularidad.Situacion.REGULAR]:
                             raise HttpError(400, f"Alumno {insc.estudiante.dni}: Requiere curso introductorio aprobado para cerrar EDI.")
                except PreinscripcionChecklist.DoesNotExist:
                    raise HttpError(400, f"Alumno {insc.estudiante.dni}: Sin checklist de ingreso (Requerido para EDI).")

            # E. Validación de Asistencia según Formato
            # Reglas: Talleres requieren 80% (65% con excepción). Materias estándar requieren 65%.
            asistencia = est_payload.asistencia or 0
            if situ_cod in [Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO, Regularidad.Situacion.REGULAR]:
                 formato_up = (materia.formato or "").upper()
                 piso = (65 if est_payload.excepcion else 80) if formato_up in FORMATOS_TALLER else 65
                 
                 if asistencia < piso:
                       raise HttpError(400, f"Asistencia insuficiente para {est_payload.situacion} ({asistencia}% < min {piso}%).")
                 
                 # Validación de consistencia: No permitir estados aprobatorios sin datos
                 if est_payload.asistencia is None and est_payload.nota_tp is None and est_payload.nota_final is None:
                      raise HttpError(400, f"Faltan datos obligatorios para registrar regularidad del alumno {insc.estudiante.dni}.")

            # F. Persistencia
            Regularidad.objects.update_or_create(
                inscripcion=insc,
                defaults={
                    "estudiante": insc.estudiante, "materia": materia, "fecha_cierre": fecha_base,
                    "nota_trabajos_practicos": Decimal(str(est_payload.nota_tp)) if est_payload.nota_tp is not None else None,
                    "nota_final_cursada": est_payload.nota_final, "asistencia_porcentaje": est_payload.asistencia,
                    "excepcion": est_payload.excepcion, "situacion": situ_cod, "observaciones": est_payload.observaciones or "",
                },
            )

    return ApiResponse(ok=True, message="Planilla guardada formalmente.")


@router.post("/regularidad/cierre", response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse}, auth=JWTAuth())
@ensure_roles(["admin", "secretaria", "bedel", "docente"])
def gestionar_regularidad_cierre(request, payload: RegularidadCierreIn = Body(...)):
    """Gestiona el bloqueo (Cierre) o reapertura de una planilla de cátedra."""
    is_virtual = payload.comision_id < 0
    comision = None
    materia = None
    anio_virtual = 0
    
    if is_virtual:
        mid, anio_virtual = split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=mid).first()
        if not materia: return 404, ApiResponse(ok=False, message="Materia no encontrada.")
        lock = regularidad_lock_for_scope(materia=materia, anio_virtual=anio_virtual or 0)
    else:
        comision = Comision.objects.filter(id=payload.comision_id).first()
        if not comision: return 404, ApiResponse(ok=False, message="Comisión no encontrada.")
        lock = regularidad_lock_for_scope(comision=comision)

    accion = payload.accion.lower()
    can_override = user_has_privileged_planilla_access(request.user)

    if accion == "cerrar":
        if not lock:
            RegularidadPlanillaLock.objects.create(
                comision=comision, materia=None if comision else materia,
                anio_virtual=None if comision else (anio_virtual or 0),
                cerrado_por=request.user if getattr(request.user, "is_authenticated", False) else None,
            )
        return ApiResponse(ok=True, message="La planilla ha sido bloqueada correctamente.")

    if accion == "reabrir":
        if not can_override:
            return 403, ApiResponse(ok=False, message="Privilegios insuficientes para reabrir planillas.")
        if lock: lock.delete()
        return ApiResponse(ok=True, message="La planilla ha sido habilitada para edición.")

    return 400, ApiResponse(ok=False, message="Acción de gestión no válida.")
