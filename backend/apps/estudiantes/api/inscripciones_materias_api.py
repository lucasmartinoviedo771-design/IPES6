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

from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.common.api_schemas import ApiResponse
from apps.common.date_utils import format_datetime
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamenEstudiante,
    Comision,
    Correlatividad,
    EquivalenciaDisposicionDetalle,
    HorarioCatedraDetalle,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Materia,
    Regularidad,
    Turno,
    VentanaHabilitacion,
)
from core.models.inscripciones import InscripcionMateriaMovimiento
from core.permissions import ensure_roles

from ..schemas import (
    AceptarResidenciaCondicionalIn,
    AutorizarCambioComisionIn,
    BajaInscripcionIn,
    CambioComisionIn,
    CambioComisionOut,
    CancelarInscripcionIn,
    InscripcionMateriaIn,
    InscripcionMateriaOut,
    MateriaInscriptaItem,
    ResidenciaCondicionalPropuestaOut,
    SolicitudCambioComisionItem,
)
from .helpers import (
    _correlatividades_qs,
    _ensure_estudiante_access,
    _resolve_estudiante,
    _tiene_aprobacion_valida,
)
from .router import estudiantes_router


def _es_materia_residencia(materia) -> bool:
    """Retorna True si la materia es Residencia (Práctica IV o Taller de Residencia de 4° año)."""
    if materia.anio_cursada != 4:
        return False
    nombre = (materia.nombre or "").upper()
    return "RESIDENCIA" in nombre or nombre.startswith("PRÁCTICA IV") or nombre.startswith("PRACTICA IV")


def _es_taller_o_practica_4_residencia(materia) -> bool:
    """
    Retorna True si la materia es un taller de residencia, residencia o práctica 4 (de 4° año)
    con base en los 5 nombres exactos provistos.
    """
    if getattr(materia, "anio_cursada", None) != 4:
        return False
    nombre = getattr(materia, "nombre", "") or ""
    nombre_norm = (
        nombre.upper()
        .replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
        .strip()
    )
    nombres_validos = {
        "PRACTICA IV: RESIDENCIA PEDAGOGICA",
        "TALLER DE RESIDENCIA DE CIENCIAS NATURALES",
        "TALLER DE RESIDENCIA DE CIENCIAS SOCIALES",
        "TALLER DE RESIDENCIA DE MATEMATICA",
        "TALLER DE RESIDENCIA DE PRACTICAS DEL LENGUAJE"
    }
    return any(nombre_norm.startswith(nv) for nv in nombres_validos)


def _permite_superposicion_residencia(m1, m2) -> bool:
    """
    Permite superponer talleres de residencia y práctica 4 del 4° año entre sí.
    """
    return _es_taller_o_practica_4_residencia(m1) and _es_taller_o_practica_4_residencia(m2)


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
        "anio_lectivo": comision.anio_lectivo,
        "turno_id": comision.turno_id,
        "turno": comision.turno.nombre if comision.turno else "No definido",
        "materia_id": comision.materia_id,
        "materia_nombre": comision.materia.nombre,
        "plan_id": plan.id if plan else None,
        "profesorado_id": profesorado.id if profesorado else None,
        "profesorado_nombre": profesorado.nombre if profesorado else None,
        "docente": f"{docente.apellido}, {docente.nombre}" if docente else None,
        "cupo_maximo": comision.cupo_maximo,
        "estado": comision.get_estado_display(),
        "horarios": detalles,
    }


@estudiantes_router.post(
    "/inscripcion-materia",
    response={200: InscripcionMateriaOut, 202: ResidenciaCondicionalPropuestaOut, 400: ApiResponse, 404: ApiResponse},
)
def inscripcion_materia(request, payload: InscripcionMateriaIn):
    """
    Solicita la inscripción a una materia para el ciclo lectivo actual.

    Flujo de Validación:
    1. Identidad: Verifica que el usuario tenga permiso sobre el DNI (Alumno propio o Bedel).
    2. Ventana: Comprueba si existe una 'VentanaHabilitacion' de tipo MATERIAS activa.
    3. Régimen: Si la ventana es para 2C, bloquea materias Anuales o de 1C.
    4. Materia ya aprobada: Bloquea si el alumno ya aprobó la materia (Regularidad, Acta, Mesa o Equivalencia).
    5. Correlatividades: Consulta el motor de correlatividades consolidado (Actas + Regularidades).
    6. Colisión Horaria: Analiza los bloques horarios de la materia contra las ya inscriptas en el año.
    """
    # Bloqueo temporal para estudiantes (solo habilitado para bedeles, secretaría y administradores)
    from core.permissions import get_user_roles

    if not (get_user_roles(request.user) & {"admin", "secretaria", "bedel"}):
        return 400, ApiResponse(
            ok=False,
            message="La inscripción por parte de estudiantes se encuentra desactivada temporalmente por mantenimiento de carga de datos. Por favor, consulte con Bedelía o Secretaría.",
        )

    _ensure_estudiante_access(request, getattr(payload, "dni", None))
    est = _resolve_estudiante(request, getattr(payload, "dni", None))
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no identificado.")

    mat = Materia.objects.filter(id=payload.materia_id).select_related("plan_de_estudio__profesorado").first()
    if not mat:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    # --- 0. VALIDACIÓN DE ESTADO ACTIVO ---
    from core.models.estudiantes import EstudianteCarrera

    profesorado_id = mat.plan_de_estudio.profesorado_id if mat.plan_de_estudio else None
    if profesorado_id:
        carrera_estado = (
            EstudianteCarrera.objects.filter(estudiante=est, profesorado_id=profesorado_id)
            .values_list("estado_academico", flat=True)
            .first()
        )
        if carrera_estado != "ACT":
            return 400, ApiResponse(
                ok=False,
                message="El alumno debe encontrarse en estado 'Activo' en el profesorado correspondiente para poder inscribirse a materias.",
            )

    anio_actual = datetime.now().year

    # --- 1. VALIDACIÓN DE VENTANA TEMPORAL ---
    hoy = timezone.now().date()
    ventana = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.MATERIAS, activo=True, desde__lte=hoy, hasta__gte=hoy
    ).first()

    if not ventana:
        return 400, ApiResponse(ok=False, message="Periodo de inscripción cerrado o no iniciado.")

    # 1.5. VALIDACIÓN DE VIGENCIA (EDIs Cerrados)
    if mat.fecha_fin and mat.fecha_fin < hoy:
        return 400, ApiResponse(
            ok=False,
            message=f"La materia '{mat.nombre}' finalizó su vigencia el {mat.fecha_fin} y no admite inscripciones en el ciclo {anio_actual}.",
        )

    # Validación de régimen (Cuatrimestres)
    if ventana.periodo:
        allowed_regimens = []
        if ventana.periodo == "1C_ANUALES":
            allowed_regimens = [Materia.TipoCursada.ANUAL, Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == "1C":
            allowed_regimens = [Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == "2C":
            allowed_regimens = [Materia.TipoCursada.SEGUNDO_CUATRIMESTRE]

        if mat.regimen not in allowed_regimens:
            return 400, ApiResponse(
                ok=False, message=f"La materia {mat.nombre} no corresponde a este turno de inscripción."
            )

    # --- 2. VALIDACIÓN: MATERIA YA APROBADA ---
    # Usa _tiene_aprobacion_valida para cubrir Regularidad, Equivalencia y Acta,
    # respetando en_resguardo en todas las fuentes.
    if _tiene_aprobacion_valida(est, mat):
        return 400, ApiResponse(
            ok=False, message=f"La materia '{mat.nombre}' ya se encuentra aprobada en su historial académico."
        )

    # --- 3. VALIDACIÓN DE CORRELATIVIDADES ---
    req_reg = list(
        _correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, est).values_list(
            "materia_correlativa_id", flat=True
        )
    )
    req_apr = list(
        _correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, est).values_list(
            "materia_correlativa_id", flat=True
        )
    )

    autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
    faltan = []
    faltan_ids = []  # IDs de materias faltantes (para lógica condicional de Residencia)

    for mid in req_reg:
        if mid in autorizadas_ids:
            continue
        m_corr = Materia.objects.filter(id=mid).first()
        nombre = m_corr.nombre if m_corr else str(mid)
        tiene_regular = Regularidad.objects.filter(
            estudiante=est,
            materia_id=mid,
            situacion=Regularidad.Situacion.REGULAR,
            en_resguardo=False,
        ).exists()
        if not tiene_regular and not (
            m_corr and _tiene_aprobacion_valida(est, m_corr, autorizadas_ids=autorizadas_ids)
        ):
            faltan.append(f"Regular en {nombre}")
            faltan_ids.append(mid)

    for mid in req_apr:
        if mid in autorizadas_ids:
            continue
        m_corr = Materia.objects.filter(id=mid).first()
        nombre = m_corr.nombre if m_corr else str(mid)
        if not m_corr or not _tiene_aprobacion_valida(est, m_corr, autorizadas_ids=autorizadas_ids):
            faltan.append(f"Aprobada {nombre}")
            if mid not in faltan_ids:
                faltan_ids.append(mid)

    if faltan:
        # Caso especial: Residencia con exactamente 1 materia faltante → inscripción condicional
        if _es_materia_residencia(mat) and len(faltan_ids) == 1:
            from datetime import date

            anio = date.today().year
            fecha_limite = date(anio, 6, 1)
            mat_pend_id = faltan_ids[0]
            mat_pend = Materia.objects.filter(id=mat_pend_id).first()
            return 202, ResidenciaCondicionalPropuestaOut(
                materia_residencia_id=mat.id,
                materia_residencia_nombre=mat.nombre,
                materia_pendiente_id=mat_pend_id,
                materia_pendiente_nombre=mat_pend.nombre if mat_pend else str(mat_pend_id),
                fecha_limite=fecha_limite.strftime("%d/%m/%Y"),
                mensaje=(
                    f"Tu inscripción a '{mat.nombre}' es condicional. "
                    f"Adeudás '{mat_pend.nombre if mat_pend else mat_pend_id}' y debés aprobarla "
                    f"en las mesas extraordinarias de mayo. "
                    f"Si al {fecha_limite.strftime('%d/%m/%Y')} no la aprobás, "
                    f"tu cursada de Residencia caerá automáticamente. ¿Aceptás esta condición?"
                ),
            )
        return 400, ApiResponse(ok=False, message="No cumple correlatividades exigidas.", data={"faltantes": faltan})

    # --- 4. DETECCIÓN DE SUPERPOSICIÓN HORARIA ---
    # 5. Validar superposición horaria (solo contra inscripciones activas)
    cand_qs = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mat)
    if cand_qs.exists():
        cand = [(d.horario_catedra.turno_id, d.bloque.dia, d.bloque.hora_desde, d.bloque.hora_hasta) for d in cand_qs]

        # Solo chocamos contra inscripciones que no estén anuladas, rechazadas o de baja
        actuales = InscripcionMateriaEstudiante.objects.filter(estudiante=est, anio=anio_actual).exclude(
            estado__in=[
                InscripcionMateriaEstudiante.Estado.ANULADA,
                InscripcionMateriaEstudiante.Estado.RECHAZADA,
                InscripcionMateriaEstudiante.Estado.BAJA,
            ]
        )
        if actuales.exists():
            det_act = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "horario_catedra__espacio", "bloque").filter(
                horario_catedra__espacio_id__in=list(actuales.values_list("materia_id", flat=True))
            )
            for d in det_act:
                for t, dia, desde, hasta in cand:
                    # Si coinciden en Turno y Día, verificamos solapamiento de horas
                    if (
                        t == d.horario_catedra.turno_id
                        and dia == d.bloque.dia
                        and not (hasta <= d.bloque.hora_desde or desde >= d.bloque.hora_hasta)
                    ):
                        # Omitir si ambas materias permiten superposición (talleres/práctica 4 del 2C)
                        if _permite_superposicion_residencia(mat, d.horario_catedra.espacio):
                            continue
                        colision_nombre = d.horario_catedra.espacio.nombre
                        return 400, ApiResponse(
                            ok=False,
                            message=f"Existe una superposición horaria con la materia '{colision_nombre}' del ciclo actual.",
                        )

    # --- 4. ASIGNACIÓN DE COMISIÓN (AUTO-ASSIGNMENT) ---
    comision_id = getattr(payload, "comision_id", None)
    comision_obj = None

    if comision_id:
        comision_obj = Comision.objects.filter(id=comision_id).first()

    if not comision_obj:
        # Intentar buscar comisiones activas para la materia en el año lectivo actual
        comisiones_qs = Comision.objects.filter(materia=mat, anio_lectivo=anio_actual).order_by("orden", "id")

        comision_obj = comisiones_qs.first()

        # Si no existe NINGUNA comisión para el año actual, crear una por defecto (Placeholder)
        if not comision_obj:
            # Buscamos datos del plan para heredar (Turno por defecto)
            turno_def = Turno.objects.first()
            if not turno_def:
                turno_def = Turno.objects.create(nombre="No definido")

            comision_obj = Comision.objects.create(
                materia=mat,
                anio_lectivo=anio_actual,
                codigo="A",  # Código por defecto histórico
                turno=turno_def,
                estado=Comision.Estado.ABIERTA,
                observaciones="Asignada automáticamente por el sistema de inscripciones.",
            )

    # Registro de la inscripción
    inscripcion, created = InscripcionMateriaEstudiante.objects.update_or_create(
        estudiante=est,
        materia=mat,
        anio=anio_actual,
        defaults={
            "comision": comision_obj,
            "estado": InscripcionMateriaEstudiante.Estado.CONFIRMADA,
            "baja_fecha": None,
            "baja_motivo": None,
        },
    )

    # Registro de auditoría
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=inscripcion,
        tipo=InscripcionMateriaMovimiento.Tipo.INSCRIPCION,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle="Inscripción registrada por el sistema.",
    )

    return {"message": "Inscripción registrada correctamente."}


from .helpers.horarios_utils import obtener_horarios_materia


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
                horarios=obtener_horarios_materia(materia),
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

    es_gestion = bool(get_user_roles(request.user) & {"admin", "secretaria", "bedel", "attp"})

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
        return 400, ApiResponse(
            ok=False, message="Solo se pueden cancelar inscripciones activas (Confirmadas o Pendientes)."
        )

    # Si no es gestión, verificar que la ventana esté abierta para que el alumno pueda cancelar
    if not es_gestion:
        if not ventana_abierta:
            return 400, ApiResponse(
                ok=False,
                message="El período de inscripción ha finalizado. Si ya iniciaste la cursada y deseas salir, debes solicitar la 'Baja Voluntaria' del espacio curricular.",
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
        motivo_detalle="Cancelación manual de inscripción.",
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


from core.models.estudiantes import EstudianteCarrera


@estudiantes_router.get("/cambio-comision/pendientes", response=list[SolicitudCambioComisionItem], auth=JWTAuth())
def listar_cambios_comision_pendientes(request, dni: str | None = None, profesorado_id: int | None = None):
    """Lista inscripciones en estado CONDICIONAL (solicitudes de cambio de comisión pendientes)."""
    ensure_roles(request.user, {"admin", "secretaria", "bedel", "tutor", "attp"})
    qs = (
        InscripcionMateriaEstudiante.objects.filter(estado=InscripcionMateriaEstudiante.Estado.CONDICIONAL)
        .select_related(
            "estudiante__user",
            "estudiante__persona",
            "materia__plan_de_estudio__profesorado",
            "comision",
            "comision_solicitada",
        )
        .order_by("created_at")
    )
    if dni:
        qs = qs.filter(estudiante__persona__dni__icontains=dni)
    if profesorado_id:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    result = []
    for ins in qs:
        prof = getattr(getattr(getattr(ins.materia, "plan_de_estudio", None), "profesorado", None), "nombre", None)
        result.append(
            SolicitudCambioComisionItem(
                id=ins.id,
                estudiante_dni=ins.estudiante.persona.dni if ins.estudiante.persona_id else "",
                estudiante_nombre=ins.estudiante.user.get_full_name()
                if ins.estudiante.user_id
                else str(ins.estudiante),
                materia_nombre=ins.materia.nombre if ins.materia_id else "",
                anio=ins.anio,
                profesorado_nombre=prof,
                comision_actual=ins.comision.codigo if ins.comision_id else None,
                comision_solicitada=ins.comision_solicitada.codigo if ins.comision_solicitada_id else "",
                motivo=ins.get_motivo_cambio_display() if ins.motivo_cambio else "",
                created_at=format_datetime(ins.created_at),
            )
        )
    return result


@estudiantes_router.post("/cambio-comision", response={200: CambioComisionOut, 400: ApiResponse, 404: ApiResponse})
def cambio_comision(request, payload: CambioComisionIn):
    """
    Registra una solicitud de cambio de comisión por parte del alumno.

    Reglas de Negocio:
    1. El alumno debe ser Graduado/Regular (ACTIVO).
    2. Solo materias de Formación General (FGN).
    3. Misma carga horaria y formato.
    4. El estado queda en CONDICIONAL hasta aprobación manual.
    """
    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado.")

    # 1. VALIDAR ESTUDIANTE REGULAR / ACTIVO
    # Verificamos si tiene al menos una carrera activa
    es_regular = EstudianteCarrera.objects.filter(
        estudiante=est, estado_academico=EstudianteCarrera.EstadoAcademico.ACTIVO
    ).exists()

    if not es_regular:
        return 400, ApiResponse(
            ok=False, message="El alumno debe ser estudiante regular para solicitar cambios de comisión."
        )

    # 2. VALIDAR COMISIÓN DESTINO Y MATERIA
    com_dest = Comision.objects.select_related("materia").filter(id=payload.comision_id).first()
    if not com_dest:
        return 404, ApiResponse(ok=False, message="Comisión de destino no encontrada.")

    mat = com_dest.materia
    anio_actual = datetime.now().year

    # 3. REGLA: Solo Formación General
    if mat.tipo_formacion != Materia.TipoFormacion.FORMACION_GENERAL:
        return 400, ApiResponse(
            ok=False, message="Solo se permiten cambios de comisión para materias de Formación General."
        )

    # 4. RESOLVER INSCRIPCIÓN PREVIA O NUEVA (CASO LABORAL)
    ins = None
    if payload.inscripcion_id:
        ins = InscripcionMateriaEstudiante.objects.filter(id=payload.inscripcion_id, estudiante=est).first()
    else:
        # Caso Trabajo: si no está inscripto, buscamos si existe una para la materia en el año
        ins = (
            InscripcionMateriaEstudiante.objects.filter(estudiante=est, materia=mat, anio=anio_actual)
            .exclude(estado__in=[InscripcionMateriaEstudiante.Estado.ANULADA, InscripcionMateriaEstudiante.Estado.BAJA])
            .first()
        )

    # Si es inscripción nueva (Laboral), verificamos compatibilidades de la materia base (si la hubiera)
    # o simplemente validamos que sea FGN (ya validado arriba).

    if ins:
        # Si ya estaba inscripto, validar que sea la misma materia (por las dudas)
        if ins.materia_id != mat.id:
            # En cambio de comisión riguroso, solo permitimos cambiar si mm.id == ins.materia_id
            # (o si son equivalentes y tienen mismo formato/carga)
            m_orig = ins.materia
            if m_orig.horas_semana != mat.horas_semana or m_orig.formato != mat.formato:
                return 400, ApiResponse(
                    ok=False,
                    message="La materia de destino no tiene la misma carga horaria o formato que su inscripción actual.",
                )
    else:
        # Es una solicitud de inscripción "de cero" por motivos laborales
        if payload.motivo_cambio != "WORK":
            return 400, ApiResponse(ok=False, message="No se encontró una inscripción previa para realizar el cambio.")

        # Creamos la inscripción como CONDICIONAL (Solicitud)
        ins = InscripcionMateriaEstudiante(estudiante=est, materia=mat, anio=anio_actual)

    # 5. ACTUALIZAR A ESTADO CONDICIONAL Y GUARDAR METADATOS
    ins.estado = InscripcionMateriaEstudiante.Estado.CONDICIONAL
    ins.comision_solicitada = com_dest
    ins.motivo_cambio = payload.motivo_cambio
    ins.horario_laboral_metadata = payload.horario_laboral
    ins.save()

    # 6. REGISTRO DE MOVIMIENTO (AUDITORÍA)
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=ins,
        tipo=InscripcionMateriaMovimiento.Tipo.SOLICITUD_CAMBIO,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle=f"Solicitud de cambio a comisión {com_dest.codigo} ({payload.motivo_cambio}).",
    )

    return {"message": "Solicitud registrada en carácter CONDICIONAL. Será revisada por un tutor o bedel."}


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
    from django.utils.timezone import now

    from core.permissions import allowed_profesorados, get_user_roles

    roles = get_user_roles(request.user)
    es_gestion = bool(roles & {"admin", "secretaria", "attp"})
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
            message="Mientras el periodo de inscripción esté abierto, el sistema solo permite 'Cancelar Inscripción' para mantener la integridad de los datos de cursada. La 'Baja Voluntaria' se habilita al cerrar la inscripción.",
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
            profesorado_materia = (
                inscripcion.materia.plan_de_estudio.profesorado_id if (inscripcion.materia.plan_de_estudio_id) else None
            )
            if profesorado_materia not in profesorados_permitidos:
                return 403, ApiResponse(
                    ok=False, message="No tiene permiso para dar de baja estudiantes de este profesorado."
                )

    # Solo se puede dar de baja si la inscripción está activa
    if inscripcion.estado not in (
        InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        InscripcionMateriaEstudiante.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(
            ok=False,
            message=f"No se puede dar de baja: la inscripción está en estado '{inscripcion.get_estado_display()}'.",
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
        motivo_detalle=f"Baja voluntaria. Motivo: {payload.motivo.strip()}",
    )

    return 200, ApiResponse(
        ok=True,
        message=f"Baja de '{inscripcion.materia.nombre}' registrada correctamente para el ciclo {inscripcion.anio}.",
    )


@estudiantes_router.patch(
    "/inscripcion-materia/{inscripcion_id}/autorizar-cambio-comision", response=ApiResponse, auth=JWTAuth()
)
def autorizar_cambio_comision(request, inscripcion_id: int, payload: AutorizarCambioComisionIn):
    """
    Autoriza o rechaza una solicitud de cambio de comisión.
    Solo accesible para admin, secretaria, bedel o tutor.
    """
    from apps.estudiantes.services.notificaciones_service import NotificacionesService

    ensure_roles(request.user, {"admin", "secretaria", "bedel", "tutor", "attp"})

    ins = get_object_or_404(InscripcionMateriaEstudiante, id=inscripcion_id)

    if ins.estado != InscripcionMateriaEstudiante.Estado.CONDICIONAL:
        return 400, ApiResponse(
            ok=False, message="La inscripción no tiene una solicitud de cambio pendiente (estado CONDICIONAL)."
        )

    if payload.aprobado:
        if not ins.comision_solicitada:
            return 400, ApiResponse(ok=False, message="No hay una comisión de destino solicitada.")

        materia_destino = ins.comision_solicitada.materia
        # Si la comisión de destino corresponde a una materia distinta (inter-profesorado),
        # guardamos la materia de origen para que la planilla genere la Regularidad correctamente.
        if materia_destino.id != ins.materia_id:
            ins.materia_origen = ins.materia
        else:
            ins.materia_origen = None

        ins.comision = ins.comision_solicitada
        ins.materia = materia_destino
        ins.comision_solicitada = None
        ins.estado = InscripcionMateriaEstudiante.Estado.CONFIRMADA
        ins.cambio_comision_estado = InscripcionMateriaEstudiante.CambioComisionEstado.APROBADO
        ins.disposicion_numero = payload.disposicion_numero
        msg_auditoria = f"Cambio de comisión aprobado. Disp Nº {payload.disposicion_numero}."
    else:
        ins.comision_solicitada = None
        # Volvemos a CONFIRMADA pero con la comisión original (que nunca se borró de .comision)
        # Si era una inscripción "de cero" laboral y se rechaza, tal vez debería quedar en RECHAZADA
        if not ins.comision:
            ins.estado = InscripcionMateriaEstudiante.Estado.RECHAZADA
        else:
            ins.estado = InscripcionMateriaEstudiante.Estado.CONFIRMADA

        ins.cambio_comision_estado = InscripcionMateriaEstudiante.CambioComisionEstado.RECHAZADO
        msg_auditoria = f"Cambio de comisión rechazado. Motivo: {payload.observaciones or 'S/D'}."

    ins.save()

    # Registro de auditoría
    InscripcionMateriaMovimiento.objects.create(
        inscripcion=ins,
        tipo=InscripcionMateriaMovimiento.Tipo.OTRO,
        operador=request.user.username,
        motivo_detalle=msg_auditoria,
    )

    # Notificación automática
    try:
        NotificacionesService.notificar_cambio_comision(ins)
    except Exception as e:
        print(f"Error enviando notificación de cambio comisión: {e}")

    return ApiResponse(ok=True, message="Trámite de cambio de comisión procesado y estudiante notificado.")


@estudiantes_router.post(
    "/inscripcion-materia/residencia-condicional/aceptar",
    response={200: InscripcionMateriaOut, 400: ApiResponse, 404: ApiResponse},
)
def aceptar_residencia_condicional(request, payload: AceptarResidenciaCondicionalIn):
    """
    Confirma la inscripción condicional a Residencia.
    El estudiante aceptó la condición de aprobar la materia pendiente antes del 01/06.
    Crea la InscripcionMateriaEstudiante y registra el ResidenciaCondicional.
    """
    from datetime import date

    from core.models import ResidenciaCondicional

    # Bloqueo temporal para estudiantes (solo habilitado para bedeles, secretaría y administradores)
    from core.permissions import get_user_roles

    if not (get_user_roles(request.user) & {"admin", "secretaria", "bedel"}):
        return 400, ApiResponse(
            ok=False,
            message="La inscripción por parte de estudiantes se encuentra desactivada temporalmente por mantenimiento de carga de datos. Por favor, consulte con Bedelía o Secretaría.",
        )

    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, ApiResponse(ok=False, message="Estudiante no identificado.")

    mat = Materia.objects.filter(id=payload.materia_residencia_id).first()
    if not mat or not _es_materia_residencia(mat):
        return 404, ApiResponse(ok=False, message="Materia de Residencia no encontrada.")

    mat_pend = Materia.objects.filter(id=payload.materia_pendiente_id).first()
    if not mat_pend:
        return 404, ApiResponse(ok=False, message="Materia pendiente no encontrada.")

    anio_actual = date.today().year
    fecha_limite = date(anio_actual, 6, 1)

    # Si ya existe un ResidenciaCondicional, permitir re-inscripción solo si la inscripción fue cancelada/dada de baja
    rc_existente = ResidenciaCondicional.objects.filter(
        estudiante=est, materia_residencia=mat, ciclo_lectivo=anio_actual
    ).first()
    if rc_existente:
        insc_activa = InscripcionMateriaEstudiante.objects.filter(
            estudiante=est,
            materia=mat,
            anio=anio_actual,
            estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        ).exists()
        if insc_activa:
            return 400, ApiResponse(
                ok=False, message="Ya existe una inscripción condicional activa a esta Residencia para el ciclo actual."
            )
        # La inscripción fue cancelada — resetear el registro condicional para permitir re-inscripción
        rc_existente.resuelta = False
        rc_existente.caida = False
        rc_existente.materia_pendiente = mat_pend
        rc_existente.fecha_limite = date(anio_actual, 6, 1)
        rc_existente.autorizado_por = request.user if request.user.is_authenticated else None
        rc_existente.save()

    # Crear la inscripción a la materia (mismo flujo que inscripcion_materia pero sin chequeo de correlativas)
    comision_obj = Comision.objects.filter(materia=mat, anio_lectivo=anio_actual).order_by("orden", "id").first()
    if not comision_obj:
        turno_def = Turno.objects.first() or Turno.objects.create(nombre="No definido")
        comision_obj = Comision.objects.create(
            materia=mat,
            anio_lectivo=anio_actual,
            codigo="A",
            turno=turno_def,
            estado=Comision.Estado.ABIERTA,
            observaciones="Asignada automáticamente — inscripción condicional de Residencia.",
        )

    inscripcion, _ = InscripcionMateriaEstudiante.objects.update_or_create(
        estudiante=est,
        materia=mat,
        anio=anio_actual,
        defaults={
            "comision": comision_obj,
            "estado": InscripcionMateriaEstudiante.Estado.CONFIRMADA,
            "baja_fecha": None,
            "baja_motivo": None,
        },
    )

    InscripcionMateriaMovimiento.objects.create(
        inscripcion=inscripcion,
        tipo=InscripcionMateriaMovimiento.Tipo.INSCRIPCION,
        operador=request.user.username if request.user.is_authenticated else "Anon",
        motivo_detalle=f"Inscripción condicional a Residencia. Materia pendiente: {mat_pend.nombre}. Límite: {fecha_limite}.",
    )

    # Registrar la condición (si no se actualizó un registro existente)
    if not rc_existente:
        ResidenciaCondicional.objects.create(
            estudiante=est,
            materia_residencia=mat,
            materia_pendiente=mat_pend,
            ciclo_lectivo=anio_actual,
            fecha_limite=fecha_limite,
            autorizado_por=request.user if request.user.is_authenticated else None,
        )

    return 200, InscripcionMateriaOut(
        message=f"Inscripción condicional a '{mat.nombre}' registrada. Debés aprobar '{mat_pend.nombre}' antes del {fecha_limite.strftime('%d/%m/%Y')}.",
    )
