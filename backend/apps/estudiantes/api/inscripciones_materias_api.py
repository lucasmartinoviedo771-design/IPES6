"""
API de Inscripción a Materias (Cursadas).
Gestiona el ciclo de vida de la inscripción de alumnos a las cátedras.
Incluye un motor de validación riguroso que verifica:
1. Ventanas de habilitación temporales (fechas de inscripción).
2. Compatibilidad de régimen (1C, 2C, Anual) según el periodo activo.
3. Cumplimiento de correlatividades (Regulares y Aprobadas).
4. Detección de colisiones/superposiciones horarias entre materias.
"""

from __future__ import annotations
from datetime import datetime
from django.utils import timezone
from apps.common.date_utils import format_datetime
from apps.common.api_schemas import ApiResponse
from core.permissions import ensure_roles
from core.models import (
    ActaExamenEstudiante,
    Correlatividad,
    HorarioCatedraDetalle,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Materia,
    Regularidad,
    VentanaHabilitacion,
)
from core.models.inscripciones import InscripcionMateriaMovimiento

from ..schemas import (
    BajaInscripcionIn,
    CambioComisionIn,
    CambioComisionOut,
    CancelarInscripcionIn,
    InscripcionMateriaIn,
    InscripcionMateriaOut,
    MateriaInscriptaItem,
)
from .helpers import (
    _correlatividades_qs,
    _ensure_estudiante_access,
    _resolve_estudiante,
)
from .router import estudiantes_router


def _comision_to_resumen(comision):
    """Auxiliar: Convierte una instancia de Comisión en un resumen para el frontend."""
    if not comision:
        return None
    materia = comision.materia
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado if plan else None
    horario = comision.horario
    turno = comision.turno
    docente = comision.docente
    
    detalles: list[dict] = []
    if horario:
        detalles = [
            {
                "dia": det.bloque.get_dia_display(),
                "dia_num": det.bloque.dia,
                "desde": det.bloque.hora_desde.strftime("%H:%M"),
                "hasta": det.bloque.hora_hasta.strftime("%H:%M"),
            }
            for det in horario.detalles.select_related("bloque").all()
        ]
        
    return {
        "id": comision.id,
        "codigo": comision.codigo,
        "turno": turno.nombre if turno else None,
        "docente": f"{docente.apellido}, {docente.nombre}" if docente else None,
        "observaciones": comision.observaciones or None,
        "cupo": comision.cupo,
        "profesorado_id": profesorado.id if profesorado else None,
        "profesorado_nombre": profesorado.nombre if profesorado else None,
        "horario": detalles or None,
    }


@estudiantes_router.post(
    "/inscripcion-materia",
    response={200: InscripcionMateriaOut, 400: ApiResponse, 404: ApiResponse},
)
def inscripcion_materia(request, payload: InscripcionMateriaIn):
    """
    Solicita la inscripción a una materia para el ciclo lectivo actual.
    
    Flujo de Validación:
    1. Identidad: Verifica que el usuario tenga permiso sobre el DNI (Alumno propio o Bedel).
    2. Ventana: Comprueba si existe una 'VentanaHabilitacion' de tipo MATERIAS activa.
    3. Régimen: Si la ventana es para 2C, bloquea materias Anuales o de 1C.
    4. Correlatividades: Consulta el motor de correlatividades consolidado (Actas + Regularidades).
    5. Colisión Horaria: Analiza los bloques horarios de la materia contra las ya inscriptas en el año.
    """
    _ensure_estudiante_access(request, getattr(payload, "dni", None))
    est = _resolve_estudiante(request, getattr(payload, "dni", None))
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no identificado.")
        
    mat = Materia.objects.filter(id=payload.materia_id).first()
    if not mat:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    anio_actual = datetime.now().year

    # --- 1. VALIDACIÓN DE VENTANA TEMPORAL ---
    hoy = timezone.now().date()
    ventana = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy
    ).first()

    if not ventana:
        return 400, ApiResponse(ok=False, message="Periodo de inscripción cerrado o no iniciado.")

    # 1.5. VALIDACIÓN DE VIGENCIA (EDIs Cerrados)
    if mat.fecha_fin and mat.fecha_fin < hoy:
        return 400, ApiResponse(
            ok=False,
            message=f"La materia '{mat.nombre}' finalizó su vigencia el {mat.fecha_fin} y no admite inscripciones en el ciclo {anio_actual}."
        )


    # Validación de régimen (Cuatrimestres)
    if ventana.periodo:
        allowed_regimens = []
        if ventana.periodo == '1C_ANUALES':
            allowed_regimens = [Materia.TipoCursada.ANUAL, Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == '1C':
            allowed_regimens = [Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == '2C':
            allowed_regimens = [Materia.TipoCursada.SEGUNDO_CUATRIMESTRE]
        
        if mat.regimen not in allowed_regimens:
             return 400, ApiResponse(ok=False, message=f"La materia {mat.nombre} no corresponde a este turno de inscripción.")

    # --- 2. VALIDACIÓN DE CORRELATIVIDADES ---
    req_reg = list(_correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, est).values_list("materia_correlativa_id", flat=True))
    req_apr = list(_correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, est).values_list("materia_correlativa_id", flat=True))

    # Consolidación de estado académico del alumno
    aprobadas_ids = set()
    regulares_ids = set()
    materias_interes = list(set(req_reg + req_apr))

    # 1. Por Regularidades (Cursadas cerradas)
    for r in Regularidad.objects.filter(estudiante=est, materia_id__in=materias_interes):
        if r.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            aprobadas_ids.add(r.materia_id)
        elif r.situacion == Regularidad.Situacion.REGULAR:
            regulares_ids.add(r.materia_id)

    # 2. Por Actas de Examen / Equivalencias (Resultado final)
    from .helpers import _acta_condicion
    for a in ActaExamenEstudiante.objects.filter(dni=est.dni, acta__materia_id__in=materias_interes).select_related("acta"):
        cond_val, _ = _acta_condicion(a.calificacion_definitiva)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        if cond_val == "APR" or is_equiv:
            aprobadas_ids.add(a.acta.materia_id)

    # 3. Por Inscripciones a Mesa (Auditoría de aprobación rápida)
    for insc in InscripcionMesa.objects.filter(
        estudiante=est, 
        mesa__materia_id__in=materias_interes,
        condicion=InscripcionMesa.Condicion.APROBADO,
        estado=InscripcionMesa.Estado.INSCRIPTO
    ):
        aprobadas_ids.add(insc.mesa.materia_id)

    # Reporte de faltantes
    faltan = []
    for mid in req_reg:
        if mid not in regulares_ids and mid not in aprobadas_ids:
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Regular en {m.nombre if m else mid}")
            
    for mid in req_apr:
        if mid not in aprobadas_ids:
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Aprobada {m.nombre if m else mid}")
            
    if faltan:
        return 400, ApiResponse(ok=False, message="No cumple correlatividades exigidas.", data={"faltantes": faltan})

    # --- 3. DETECCIÓN DE SUPERPOSICIÓN HORARIA ---
    # 5. Validar superposición horaria (solo contra inscripciones activas)
    cand_qs = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mat)
    if cand_qs.exists():
        cand = [(d.horario_catedra.turno_id, d.bloque.dia, d.bloque.hora_desde, d.bloque.hora_hasta) for d in cand_qs]
        
        # Solo chocamos contra inscripciones que no estén anuladas, rechazadas o de baja
        actuales = InscripcionMateriaEstudiante.objects.filter(
            estudiante=est, 
            anio=anio_actual
        ).exclude(
            estado__in=[
                InscripcionMateriaEstudiante.Estado.ANULADA,
                InscripcionMateriaEstudiante.Estado.RECHAZADA,
                InscripcionMateriaEstudiante.Estado.BAJA
            ]
        )
        if actuales.exists():
            det_act = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "bloque").filter(
                horario_catedra__espacio_id__in=list(actuales.values_list("materia_id", flat=True))
            )
            for d in det_act:
                for t, dia, desde, hasta in cand:
                    # Si coinciden en Turno y Día, verificamos solapamiento de horas
                    if (t == d.horario_catedra.turno_id and dia == d.bloque.dia and 
                        not (hasta <= d.bloque.hora_desde or desde >= d.bloque.hora_hasta)):
                        colision_nombre = d.horario_catedra.espacio.nombre
                        return 400, ApiResponse(
                            ok=False, 
                            message=f"Existe una superposición horaria con la materia '{colision_nombre}' del ciclo actual."
                        )

    # Registro de la inscripción (Estado CONFIRMADA por defecto, o actualizamos si ya existía como ANULADA)
    inscripcion, created = InscripcionMateriaEstudiante.objects.update_or_create(
        estudiante=est, 
        materia=mat, 
        anio=anio_actual,
        defaults={
            "estado": InscripcionMateriaEstudiante.Estado.CONFIRMADA,
            "baja_fecha": None,
            "baja_motivo": None
        }
    )

    # Registro de auditoría
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=inscripcion,
        tipo=InscripcionMateriaMovimiento.Tipo.INSCRIPCION,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle="Inscripción registrada por el sistema."
    )
    
    return {"message": "Inscripción registrada correctamente."}


@estudiantes_router.get(
    "/materias-inscriptas",
    response={200: list[MateriaInscriptaItem], 400: ApiResponse},
)
def materias_inscriptas(request, anio: int | None = None, dni: str | None = None):
    """Retorna la lista de inscripciones (cursadas) históricas o del ciclo actual del alumno."""
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no encontrado.")

    qs = (
        InscripcionMateriaEstudiante.objects.filter(estudiante=est)
        .select_related(
            "materia__plan_de_estudio__profesorado",
            "comision__turno",
            "comision__docente",
            "comision__horario",
            "comision_solicitada__turno",
            "comision_solicitada__docente",
            "comision_solicitada__horario",
        )
        .order_by("-anio", "-created_at")
    )
    if anio:
        qs = qs.filter(anio=anio)

    items: list[MateriaInscriptaItem] = []
    for ins in qs:
        materia = ins.materia
        plan = materia.plan_de_estudio
        profesorado = plan.profesorado if plan else None
        comision_visible = ins.comision or ins.comision_solicitada
        items.append(
            MateriaInscriptaItem(
                inscripcion_id=ins.id,
                materia_id=materia.id,
                materia_nombre=materia.nombre,
                plan_id=plan.id if plan else None,
                profesorado_id=profesorado.id if profesorado else None,
                profesorado_nombre=profesorado.nombre if profesorado else None,
                anio_plan=materia.anio_cursada,
                anio_academico=ins.anio,
                estado=ins.estado,
                estado_display=ins.get_estado_display(),
                comision_actual=_comision_to_resumen(comision_visible),
                comision_solicitada=_comision_to_resumen(ins.comision_solicitada),
                fecha_creacion=format_datetime(ins.created_at),
                fecha_actualizacion=format_datetime(ins.updated_at or ins.created_at),
            )
        )
    return items


def _ejecutar_cancelacion(request, inscripcion_id: int, dni: str | None):
    """
    Lógica compartida de cancelación de inscripción.
    - El alumno puede cancelar su propia inscripción (sin restricción de rol).
    - Bedel/Secretaría/Admin pueden cancelar la de cualquier estudiante.
    """
    # 0. Determinar si la ventana de inscripción está activa
    hoy = timezone.now().date()
    ventana_abierta = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy,
    ).exists()

    from core.permissions import get_user_roles
    es_gestion = bool(get_user_roles(request.user) & {"admin", "secretaria", "bedel"})

    est = _resolve_estudiante(request, dni)
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no encontrado.")

    inscripcion = (
        InscripcionMateriaEstudiante.objects.filter(id=inscripcion_id, estudiante=est)
        .select_related("materia", "comision")
        .first()
    )
    if not inscripcion:
        return 404, ApiResponse(ok=False, message="Inscripción no encontrada.")

    if inscripcion.estado not in (
        InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        InscripcionMateriaEstudiante.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(ok=False, message="Solo se pueden cancelar inscripciones activas (Confirmadas o Pendientes).")

    # Si no es gestión, verificar que la ventana esté abierta para que el alumno pueda cancelar
    if not es_gestion:
        if not ventana_abierta:
            return 400, ApiResponse(
                ok=False, 
                message="El período de inscripción ha finalizado. Si ya iniciaste la cursada y deseas salir, debes solicitar la 'Baja Voluntaria' del espacio curricular."
            )

    inscripcion.estado = InscripcionMateriaEstudiante.Estado.ANULADA
    inscripcion.comision = None
    inscripcion.comision_solicitada = None
    inscripcion.save(update_fields=["estado", "comision", "comision_solicitada", "updated_at"])

    # Registro de auditoría
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=inscripcion,
        tipo=InscripcionMateriaMovimiento.Tipo.CANCELACION,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle="Cancelación manual de inscripción."
    )

    return 200, ApiResponse(ok=True, message="Inscripción anulada correctamente.")


@estudiantes_router.post(
    "/cancelar-inscripcion",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def cancelar_inscripcion_materia(request, inscripcion_id: int, payload: CancelarInscripcionIn):
    """Ruta legacy. Cancela una inscripción vigente (PENDIENTE o CONFIRMADA)."""
    return _ejecutar_cancelacion(request, inscripcion_id, payload.dni)


@estudiantes_router.post(
    "/inscripcion-materia/{inscripcion_id}/cancelar",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def cancelar_inscripcion_materia_rest(request, inscripcion_id: int, payload: CancelarInscripcionIn):
    """Ruta REST. Cancela una inscripción vigente (PENDIENTE o CONFIRMADA)."""
    return _ejecutar_cancelacion(request, inscripcion_id, payload.dni)


@estudiantes_router.post("/cambio-comision", response=CambioComisionOut)
def cambio_comision(request, payload: CambioComisionIn):
    """Registra una solicitud de cambio de comisión por parte del alumno."""
    return {"message": "Solicitud de cambio de comisión recibida."}


@estudiantes_router.post(
    "/inscripcion-materia/{inscripcion_id}/baja",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def baja_inscripcion_materia(request, inscripcion_id: int, payload: BajaInscripcionIn):
    """
    Registra la baja voluntaria de un estudiante de un espacio curricular.

    RBAC:
    - Estudiante: puede darse de baja de sus propias inscripciones.
    - Bedel: puede dar de baja a estudiantes de los profesorados que tiene asignados.
    - Secretaría / Admin: puede dar de baja a cualquier estudiante.

    La baja es definitiva para el ciclo lectivo actual. El estudiante no podrá
    volver a inscribirse hasta la próxima ventana de inscripción.
    """
    from core.permissions import get_user_roles, allowed_profesorados
    from django.utils.timezone import now

    roles = get_user_roles(request.user)
    es_gestion = bool(roles & {"admin", "secretaria"})
    es_bedel = "bedel" in roles

    # Resolver el estudiante según el payload
    dni_solicitado = payload.dni
    est = _resolve_estudiante(request, dni_solicitado)
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no identificado.")

    # 0. Determinar si la ventana de inscripción está activa
    hoy = timezone.now().date()
    ventana_abierta = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy,
    ).exists()

    # El alumno NO puede darse de baja si la ventana todavía está abierta (regla institucional)
    # Se aplica a todos para mantener la consistencia del dato: en ventana se CANCELA, fuera de ventana se da de BAJA.
    if ventana_abierta:
        return 400, ApiResponse(
            ok=False, 
            message="Mientras el periodo de inscripción esté abierto, el sistema solo permite 'Cancelar Inscripción' para mantener la integridad de los datos de cursada. La 'Baja Voluntaria' se habilita al cerrar la inscripción."
        )

    # Si no es gestión ni bedel, solo puede actuar sobre sí mismo y debe validar acceso
    if not es_gestion and not es_bedel:
        _ensure_estudiante_access(request, dni_solicitado)

    inscripcion = (
        InscripcionMateriaEstudiante.objects.filter(id=inscripcion_id, estudiante=est)
        .select_related("materia__plan_de_estudio__profesorado")
        .first()
    )
    if not inscripcion:
        return 404, ApiResponse(ok=False, message="Inscripción no encontrada.")

    # Bedel: verificar que el profesorado de la materia esté dentro de su asignación
    if es_bedel and not es_gestion:
        profesorados_permitidos = allowed_profesorados(request.user)
        if profesorados_permitidos is not None:
            profesorado_materia = inscripcion.materia.plan_de_estudio.profesorado_id if (
                inscripcion.materia.plan_de_estudio_id
            ) else None
            if profesorado_materia not in profesorados_permitidos:
                return 403, ApiResponse(ok=False, message="No tiene permiso para dar de baja estudiantes de este profesorado.")

    # Solo se puede dar de baja si la inscripción está activa
    if inscripcion.estado not in (
        InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        InscripcionMateriaEstudiante.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(
            ok=False,
            message=f"No se puede dar de baja: la inscripción está en estado '{inscripcion.get_estado_display()}'."
        )

    if not payload.motivo or not payload.motivo.strip():
        return 400, ApiResponse(ok=False, message="El motivo de la baja es obligatorio.")

    inscripcion.estado = InscripcionMateriaEstudiante.Estado.BAJA
    inscripcion.baja_fecha = now().date()
    inscripcion.baja_motivo = payload.motivo.strip()
    inscripcion.save(update_fields=["estado", "baja_fecha", "baja_motivo", "updated_at"])

    # Registro de auditoría
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=inscripcion,
        tipo=InscripcionMateriaMovimiento.Tipo.BAJA,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle=f"Baja voluntaria. Motivo: {payload.motivo.strip()}"
    )

    return 200, ApiResponse(
        ok=True,
        message=f"Baja de '{inscripcion.materia.nombre}' registrada correctamente para el ciclo {inscripcion.anio}."
    )
