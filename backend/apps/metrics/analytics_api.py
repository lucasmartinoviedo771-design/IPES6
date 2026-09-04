import csv
from datetime import datetime, timedelta

from django.db.models import Avg, Case, CharField, Count, Max, Q, Sum, Value, When
from django.db.models.functions import ExtractHour, ExtractWeekDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from ninja import Query, Router, Schema
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.asistencia.models import AsistenciaDocente, ClaseProgramada
from apps.estudiantes.api.helpers.user_utils import _resolve_docente_from_user
from apps.metrics.cache_utils import cache_endpoint
from apps.metrics.models import (
    AsistenciaSnapshot,
    AusentismoSnapshot,
    MatriculaSnapshot,
)
from core.models import (
    ActaExamen,
    ActaExamenEstudiante,
    AuditLog,
    Comision,
    Docente,
    Estudiante,
    EstudianteCarrera,
    InscripcionMateriaEstudiante,
    Materia,
    MesaExamen,
    PedidoAnalitico,
    PedidoEquivalencia,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    Preinscripcion,
    Profesorado,
    Regularidad,
    RiesgoAcademicoEstudiante,
    SystemLog,
)
from core.permissions import can, require

router = Router(tags=["Analytics"])


# ==========================================
# 1. ESQUEMAS (SCHEMAS)
# ==========================================


class SemáforoBreakdown(Schema):
    rojo: int
    amarillo: int
    verde: int
    total_evaluados: int


class StudentsSummaryOut(Schema):
    total_matriculados: int
    por_estado_academico: dict[str, int]
    promedio_general_notas: float | None
    promedio_asistencia: float | None
    regularidades_por_situacion: dict[str, int]
    semaforo: SemáforoBreakdown
    fecha_actualizacion: str | None = None


class StudentAtRiskItem(Schema):
    estudiante_id: int
    dni: str
    nombre_completo: str
    profesorado: str | None
    email: str | None
    telefono: str | None
    nivel_riesgo: str
    motivos: list[str]
    fecha_calculo: str


class ComisionWorkloadItem(Schema):
    comision_id: int
    codigo: str
    materia: str
    profesorado: str
    anio_lectivo: int
    horas_semanales: int
    inscriptos_activos: int
    rol_en_comision: str  # 'titular/interino' o 'suplente'


class TeacherWorkloadOut(Schema):
    docente_id: int
    dni: str
    nombre_completo: str
    horas_semanales_totales: int
    total_estudiantes_a_cargo: int
    comisiones_activas: list[ComisionWorkloadItem]
    participacion_tribunales: int
    asistencia_resumen: dict[str, int]
    nota_historica: str


class TeacherAttendanceOut(Schema):
    docente_id: int | None
    comision_id: int | None
    por_docente_individual: dict[str, int]
    por_catedra_comision: dict[str, int] | None


class PreinscripcionCarreraItem(Schema):
    profesorado_id: int
    profesorado_nombre: str
    total: int


class PreinscripcionesSummaryOut(Schema):
    total: int
    por_estado: dict[str, int]
    por_profesorado: list[PreinscripcionCarreraItem]


class PreinscripcionEvolucionItem(Schema):
    periodo: str
    total: int


class MatriculaEvolucionItem(Schema):
    fecha: str
    total_matriculados: int
    promedio_notas: float | None
    promedio_asistencia: float | None
    por_estado: dict[str, int]


class AsistenciaEvolucionItem(Schema):
    fecha: str
    total_registros: int
    presentes: int
    ausentes: int
    tardias: int
    justificadas: int
    porcentaje_asistencia: float | None


class EvolucionOut(Schema):
    items: list
    fecha_inicio: str | None
    fecha_fin: str | None
    periodo: str


class RendimientoMateriaItem(Schema):
    materia_id: int
    materia_nombre: str
    profesorado: str
    total_estudiantes: int
    promedio_nota: float | None
    tasa_aprobacion: float  # %
    tasa_desaprobacion: float  # %
    distribucion_notas: dict[str, int]  # {0-4: N, 5-6: N, 7-8: N, 9-10: N}


class RendimientoPorMateriaOut(Schema):
    items: list[RendimientoMateriaItem]
    profesorado_id: int | None
    profesorado_nombre: str | None
    promedio_general: float | None
    tasa_aprobacion_general: float


class RendimientoCohortesItem(Schema):
    cohorte: int
    total_estudiantes: int
    promedio_general: float | None
    tasa_aprobacion: float
    distribucion: dict[str, int]


class RendimientoCohortesOut(Schema):
    items: list[RendimientoCohortesItem]
    profesorado_id: int | None
    comparacion_historica: dict[str, float]  # {2022: 7.5, 2023: 7.3, ...}


class RendimientoComisionItem(Schema):
    comision_codigo: str
    materia_nombre: str
    docentes: list[str]
    total_inscritos: int
    promedio_nota: float | None
    tasa_aprobacion: float
    tasa_desaprobacion: float
    estudiantes_riesgo: int


class RendimientoComisionesOut(Schema):
    items: list[RendimientoComisionItem]
    profesorado_id: int | None
    total_comisiones: int
    promedio_general_notas: float | None


class LoginPorDiaItem(Schema):
    fecha: str
    total_logins: int
    usuarios_unicos: int


class TopAccionesItem(Schema):
    accion: str
    cantidad: int
    porcentaje: float


class TopUsuariosItem(Schema):
    usuario: str
    total_acciones: int
    ultimos_accesos: str


class AlertaCriticaItem(Schema):
    id: int
    fecha: str
    tipo: str  # SECURITY, DATA_INTEGRITY, ERROR, etc
    mensaje: str
    entidad_afectada: str | None
    resuelto: bool


class AuditoriaResumenOut(Schema):
    total_eventos_7d: int
    logins_7d: int
    acciones_crud_7d: int
    alertas_sin_resolver: int
    eventos_hoy: int
    hora_pico: str | None


class AuditoriaEvolucionItem(Schema):
    fecha: str
    logins: int
    acciones_crud: int
    errores: int


class AuditoriaDashboardOut(Schema):
    resumen: AuditoriaResumenOut
    logins_por_dia: list[LoginPorDiaItem]
    top_acciones: list[TopAccionesItem]
    top_usuarios: list[TopUsuariosItem]
    alertas_criticas: list[AlertaCriticaItem]
    evolucion_7d: list[AuditoriaEvolucionItem]


class AusentismoEvolucionItem(Schema):
    fecha: str
    tasa_ausentismo: float
    total_clases: int
    ausencias: int
    tardias: int
    estudiantes_sin_registro: int


class AusentismoCatedraItem(Schema):
    codigo_comision: str
    materia: str
    docentes: list[str]
    tasa_ausentismo_actual: float
    tasa_ausentismo_promedio_7d: float
    estudiantes_en_riesgo: int
    total_estudiantes: int
    tendencia: str  # "estable" | "mejorando" | "empeorando"


class AusentismoConsolidadoOut(Schema):
    profesorado_id: int | None
    profesorado_nombre: str | None
    resumen: dict  # tasa_promedio, tasa_maxima, catedras_criticas
    evolucion: list[AusentismoEvolucionItem]
    catedras: list[AusentismoCatedraItem]
    estudiantes_criticos: int
    fecha_inicio: str | None
    fecha_fin: str | None
    # Igual que en desgranamiento-catedra: no publicar una métrica sin muestra representativa.
    muestra_suficiente: bool
    cobertura_marcacion: float  # % de registros efectivamente marcados (no-ausente por defecto)
    nota_metodologica: str


class MesaPorTipoItem(Schema):
    tipo_mesa: str  # "Oral", "Escrita", "Mixta"
    cantidad: int
    promedio_nota: float | None
    tasa_aprobacion: float


class MesaPorResultadoItem(Schema):
    resultado: str  # "Aprobado", "Desaprobado", "Ausente", "Cancelada"
    cantidad: int
    porcentaje: float


class MesasDashboardOut(Schema):
    total_mesas: int
    mesas_pendientes: int
    promedio_general_notas: float | None
    tasa_aprobacion_general: float
    por_tipo: list[MesaPorTipoItem]
    por_resultado: list[MesaPorResultadoItem]
    ultimas_mesas: list[dict]  # Últimas 10 mesas cargadas


class PedidoItem(Schema):
    id: int
    tipo: str  # "Analitico", "Equivalencia"
    estado: str  # "Pendiente", "Aprobado", "Rechazado"
    estudiante_nombre: str
    dias_transcurridos: int
    fecha_solicitud: str
    observaciones: str | None


class TramitesDashboardOut(Schema):
    total_pendientes: int
    total_finalizados: int
    tiempo_promedio_resolucion: float  # días
    tiempo_maximo: int  # días
    por_estado: dict[str, int]
    pedidos_recientes: list[PedidoItem]


class TeacherAttendanceSummaryOut(Schema):
    docente_id: int | None
    total_registros: int
    presentes: int
    ausentes: int
    tardes: int
    justificadas: int
    porcentaje_asistencia: float


class WeekdayAbsenceItem(Schema):
    dia_numero: int  # 1: Domingo / Lunes según convención
    dia_nombre: str
    ausencias: int


class DesgranamientoCatedraItem(Schema):
    materia_id: int
    materia_nombre: str
    anio_cursada: int
    profesorado_nombre: str
    comision_codigo: str | None
    docentes: list[str]
    hubo_suplencia: bool
    total_inscriptos: int
    muestra_suficiente: bool  # True si inscriptos >= 15
    tasa_desgranamiento: float | None
    promedio_desgranamiento_anio: float | None
    diferencia_vs_promedio: float | None


class DesgranamientoCatedraOut(Schema):
    items: list[DesgranamientoCatedraItem]
    comisiones_sin_muestra_suficiente: int
    total_comisiones_analizadas: int
    nota_metodologica: str


# ==========================================
# 2. HELPERS DE PERMISOS
# ==========================================


def _check_metrics_access(request, target_docente_id: int | None = None) -> Docente | None:
    """
    Verifica que el usuario tenga permiso de ver métricas ampliadas,
    o restringe estrictamente la consulta al propio perfil docente autenticado.
    """
    tiene_acceso_ampliado = (
        request.user.is_superuser or can(request.user, "ver_metricas") or can(request.user, "ver_dashboard")
    )

    docente_autenticado = _resolve_docente_from_user(request.user)

    if not tiene_acceso_ampliado:
        if not docente_autenticado:
            raise HttpError(403, "No tiene permisos para consultar métricas institucionales.")
        if target_docente_id and target_docente_id != docente_autenticado.id:
            raise HttpError(403, "Acceso denegado: solo puede consultar su propia carga horaria y asistencia.")
        return docente_autenticado

    if target_docente_id:
        return Docente.objects.filter(id=target_docente_id).first()
    return docente_autenticado


# ==========================================
# 3. ENDPOINTS
# ==========================================


@router.get("/students/summary/", response=StudentsSummaryOut)
@cache_endpoint(timeout=600, prefix="students_summary")
def students_summary(request, anio: int | None = None, profesorado_id: int | None = None):
    """
    Métricas ejecutivas de estudiantes para el Dashboard.
    Lee del último snapshot de RiesgoAcademicoEstudiante para no recalcular en el request.
    """
    require(request.user, "ver_metricas")

    ciclo = anio or timezone.now().year

    # 1. Matriculados (EstudianteCarrera)
    ec_qs = EstudianteCarrera.objects.all()
    if profesorado_id:
        ec_qs = ec_qs.filter(profesorado_id=profesorado_id)

    total_matriculados = ec_qs.count()
    estados_agg = ec_qs.values("estado_academico").annotate(total=Count("id"))
    por_estado_academico = {row["estado_academico"]: row["total"] for row in estados_agg}

    # 2. Notas y Asistencias históricas/recientes desde Regularidad cerrada
    reg_qs = Regularidad.objects.all()
    if profesorado_id:
        reg_qs = reg_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    promedio_notas = reg_qs.aggregate(avg_nota=Avg("nota_final_cursada"))["avg_nota"]
    promedio_asistencia = reg_qs.aggregate(avg_asis=Avg("asistencia_porcentaje"))["avg_asis"]

    situaciones_agg = reg_qs.values("situacion").annotate(total=Count("id"))
    regularidades_por_situacion = {row["situacion"]: row["total"] for row in situaciones_agg}

    # 3. Distribución del Semáforo (Snapshot más reciente)
    ultimo_snapshot = RiesgoAcademicoEstudiante.objects.aggregate(max_f=Max("fecha_calculo"))["max_f"]
    riesgos_qs = RiesgoAcademicoEstudiante.objects.all()
    if ultimo_snapshot:
        riesgos_qs = riesgos_qs.filter(fecha_calculo=ultimo_snapshot)
    if profesorado_id:
        riesgos_qs = riesgos_qs.filter(profesorado_id=profesorado_id)

    conteo_riesgos = {
        row["nivel_riesgo"]: row["total"] for row in riesgos_qs.values("nivel_riesgo").annotate(total=Count("id"))
    }

    r_count = conteo_riesgos.get(RiesgoAcademicoEstudiante.NivelRiesgo.ROJO, 0)
    a_count = conteo_riesgos.get(RiesgoAcademicoEstudiante.NivelRiesgo.AMARILLO, 0)
    v_count = conteo_riesgos.get(RiesgoAcademicoEstudiante.NivelRiesgo.VERDE, 0)

    return {
        "total_matriculados": total_matriculados,
        "por_estado_academico": por_estado_academico,
        "promedio_general_notas": round(promedio_notas, 2) if promedio_notas else None,
        "promedio_asistencia": round(promedio_asistencia, 2) if promedio_asistencia else None,
        "regularidades_por_situacion": regularidades_por_situacion,
        "semaforo": {
            "rojo": r_count,
            "amarillo": a_count,
            "verde": v_count,
            "total_evaluados": r_count + a_count + v_count,
        },
        "fecha_actualizacion": ultimo_snapshot.isoformat() if ultimo_snapshot else None,
    }


@router.get("/students/at-risk/", response=list[StudentAtRiskItem])
@paginate(PageNumberPagination, page_size=20)
def students_at_risk(
    request,
    nivel: str = "rojo",
    profesorado_id: int | None = None,
    motivo: str | None = None,
    export: str | None = None,
):
    """
    Grilla paginada de estudiantes en un nivel de riesgo (rojo, amarillo, verde),
    con opción de filtrar por tipo de motivo (recursa, finales, inscripcion, aplazos)
    y exportar a CSV para Secretaría o Tutorías.
    """
    require(request.user, "ver_metricas")

    ultimo_snapshot = RiesgoAcademicoEstudiante.objects.aggregate(max_f=Max("fecha_calculo"))["max_f"]
    qs = (
        RiesgoAcademicoEstudiante.objects.filter(nivel_riesgo=nivel.lower())
        .select_related("estudiante__persona", "profesorado")
        .order_by("estudiante__persona__apellido", "estudiante__persona__nombre")
    )

    if ultimo_snapshot:
        qs = qs.filter(fecha_calculo=ultimo_snapshot)
    if profesorado_id:
        qs = qs.filter(profesorado_id=profesorado_id)
    if motivo:
        motivo_clean = motivo.lower().strip()
        if motivo_clean == "recursa":
            qs = qs.filter(motivos__icontains="recursando")
        elif motivo_clean == "finales":
            qs = qs.filter(motivos__icontains="finales")
        elif motivo_clean == "inscripcion":
            qs = qs.filter(motivos__icontains="inscripciones")
        elif motivo_clean == "aplazos":
            qs = qs.filter(motivos__icontains="aplazo")

    # Si se pide exportación a CSV
    if export == "csv":
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="alumnos_riesgo_{nivel}_{timezone.now().date()}.csv"'
        writer = csv.writer(response)
        writer.writerow(["DNI", "Apellido y Nombre", "Profesorado", "Email", "Teléfono", "Nivel", "Motivos"])

        for r in qs:
            p = getattr(r.estudiante, "persona", None)
            nom = f"{p.apellido}, {p.nombre}" if p else str(r.estudiante.dni)
            email = getattr(p, "email", "")
            tel = getattr(p, "telefono", "")
            carrera = r.profesorado.nombre if r.profesorado else ""
            motivos_str = " | ".join(r.motivos)
            writer.writerow([r.estudiante.dni, nom, carrera, email, tel, r.nivel_riesgo, motivos_str])

        return response

    resultados = []
    for r in qs:
        p = getattr(r.estudiante, "persona", None)
        resultados.append(
            {
                "estudiante_id": r.estudiante_id,
                "dni": r.estudiante.dni,
                "nombre_completo": f"{p.apellido}, {p.nombre}" if p else str(r.estudiante.dni),
                "profesorado": r.profesorado.nombre if r.profesorado else None,
                "email": getattr(p, "email", None),
                "telefono": getattr(p, "telefono", None),
                "nivel_riesgo": r.nivel_riesgo,
                "motivos": r.motivos,
                "fecha_calculo": r.fecha_calculo.isoformat(),
            }
        )

    return resultados


@router.get("/teachers/workload/", response=TeacherWorkloadOut)
def teacher_workload(request, docente_id: int | None = None, anio: int | None = None):
    """
    Carga horaria y comisiones activas aplicando la regla de interinos y suplentes vigentes.
    """
    docente = _check_metrics_access(request, docente_id)
    if not docente:
        raise HttpError(404, "Docente no encontrado.")

    ciclo = anio or timezone.now().year

    # Buscar todas las comisiones del año donde el docente interviene
    comisiones_qs = (
        Comision.objects.filter(anio_lectivo=ciclo)
        .filter(
            Q(docente=docente)
            | Q(suplente=docente)
            | Q(suplente_2=docente)
            | Q(suplente_3=docente)
            | Q(suplente_4=docente)
        )
        .select_related("materia__plan_de_estudio__profesorado")
    )

    comisiones_activas = []
    horas_totales = 0
    estudiantes_ids = set()

    for c in comisiones_qs:
        # Regla de suplentes: resolver quién es el docente activo HOY
        docente_activo = None
        rol_activo = "titular/interino"

        if c.estado != Comision.Estado.LICENCIA and c.docente_id == docente.id:
            docente_activo = c.docente
            rol_activo = "titular/interino"
        elif c.estado == Comision.Estado.LICENCIA:
            # Revisa la cadena de suplencias activa
            if c.suplente and c.estado_suplente == Comision.Estado.ABIERTA:
                docente_activo = c.suplente
                rol_activo = "suplente"
            elif c.suplente_2 and c.estado_suplente_2 == Comision.Estado.ABIERTA:
                docente_activo = c.suplente_2
                rol_activo = "suplente_2"
            elif c.suplente_3 and c.estado_suplente_3 == Comision.Estado.ABIERTA:
                docente_activo = c.suplente_3
                rol_activo = "suplente_3"
            elif c.suplente_4 and c.estado_suplente_4 == Comision.Estado.ABIERTA:
                docente_activo = c.suplente_4
                rol_activo = "suplente_4"

        # Si el docente evaluado es quien está activo efectivamente en este momento:
        if docente_activo and docente_activo.id == docente.id:
            hs = c.materia.horas_semana or 0
            horas_totales += hs

            inscriptos_comision = InscripcionMateriaEstudiante.objects.filter(
                comision=c,
                estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA,
            )
            count_inscriptos = inscriptos_comision.count()
            for alu_id in inscriptos_comision.values_list("estudiante_id", flat=True):
                estudiantes_ids.add(alu_id)

            comisiones_activas.append(
                {
                    "comision_id": c.id,
                    "codigo": c.codigo,
                    "materia": c.materia.nombre,
                    "profesorado": c.materia.plan_de_estudio.profesorado.nombre if c.materia.plan_de_estudio_id else "",
                    "anio_lectivo": c.anio_lectivo,
                    "horas_semanales": hs,
                    "inscriptos_activos": count_inscriptos,
                    "rol_en_comision": rol_activo,
                }
            )

    # Participación en tribunales del ciclo
    tribunales_count = (
        MesaExamen.objects.filter(fecha__year=ciclo)
        .filter(Q(docente_presidente=docente) | Q(docente_vocal1=docente) | Q(docente_vocal2=docente))
        .count()
    )

    # Asistencia docente
    asist_qs = AsistenciaDocente.objects.filter(docente=docente, clase__fecha__year=ciclo)
    asist_resumen = {row["estado"]: row["total"] for row in asist_qs.values("estado").annotate(total=Count("id"))}

    p = getattr(docente, "persona", None)
    nombre = f"{p.apellido}, {p.nombre}" if p else f"{docente.apellido}, {docente.nombre}"

    return {
        "docente_id": docente.id,
        "dni": docente.dni,
        "nombre_completo": nombre,
        "horas_semanales_totales": horas_totales,
        "total_estudiantes_a_cargo": len(estudiantes_ids),
        "comisiones_activas": comisiones_activas,
        "participacion_tribunales": tribunales_count,
        "asistencia_resumen": asist_resumen,
        "nota_historica": (
            "La carga horaria calculada refleja el estado vigente de licencias y suplencias. "
            "El sistema no historiza fechas de inicio/fin de suplencias pasadas."
        ),
    }


@router.get("/teachers/attendance/", response=TeacherAttendanceOut)
def teacher_attendance(request, docente_id: int | None = None, comision_id: int | None = None):
    """
    Asistencia docente calculada de dos formas:
    1. Por docente individual (todas las clases que dictó).
    2. Por cátedra/comisión (todas las clases de esa comisión, independiente del docente).
    """
    docente = _check_metrics_access(request, docente_id)

    res_individual = {}
    if docente:
        individual_qs = AsistenciaDocente.objects.filter(docente=docente)
        res_individual = {
            row["estado"]: row["total"] for row in individual_qs.values("estado").annotate(total=Count("id"))
        }

    res_comision = None
    if comision_id:
        require(request.user, "ver_metricas")
        comision_qs = AsistenciaDocente.objects.filter(clase__comision_id=comision_id)
        res_comision = {row["estado"]: row["total"] for row in comision_qs.values("estado").annotate(total=Count("id"))}

    return {
        "docente_id": docente.id if docente else None,
        "comision_id": comision_id,
        "por_docente_individual": res_individual,
        "por_catedra_comision": res_comision,
    }


# ==========================================
# 5. ENDPOINTS DE PREINSCRIPCIONES
# ==========================================


@router.get("/preinscripciones/summary/", response=PreinscripcionesSummaryOut)
def preinscripciones_summary(
    request,
    anio: int | None = None,
    profesorado_id: int | None = None,
):
    """
    Resumen de preinscripciones con estado normalizado y desglose por profesorado.
    Permiso requerido: ver_metricas o ver_dashboard.
    """
    if not (request.user.is_superuser or can(request.user, "ver_metricas") or can(request.user, "ver_dashboard")):
        raise HttpError(403, "No tiene permisos para ver métricas de preinscripciones.")

    qs = Preinscripcion.objects.all()
    if anio:
        qs = qs.filter(anio=anio)
    if profesorado_id:
        qs = qs.filter(carrera_id=profesorado_id)

    # Normalización del estado con Case/When
    qs_norm = qs.annotate(
        estado_norm=Case(
            When(estado__in=["Confirmada", "finalizada"], then=Value("Confirmada")),
            When(estado__in=["Enviada", "PEN"], then=Value("Enviada")),
            When(estado="Borrador", then=Value("Borrador")),
            When(estado="Observada", then=Value("Observada")),
            When(estado="Rechazada", then=Value("Rechazada")),
            default=Value("Enviada"),
            output_field=CharField(),
        )
    )

    por_estado_raw = qs_norm.values("estado_norm").annotate(total=Count("id"))
    por_estado = {row["estado_norm"]: row["total"] for row in por_estado_raw}

    # Desglose por carrera
    por_carrera_raw = qs.values("carrera_id", "carrera__nombre").annotate(total=Count("id")).order_by("-total")
    por_profesorado = [
        PreinscripcionCarreraItem(
            profesorado_id=row["carrera_id"],
            profesorado_nombre=row["carrera__nombre"],
            total=row["total"],
        )
        for row in por_carrera_raw
        if row["carrera_id"] is not None
    ]

    return {
        "total": qs.count(),
        "por_estado": por_estado,
        "por_profesorado": por_profesorado,
    }


@router.get("/preinscripciones/evolucion/", response=list[PreinscripcionEvolucionItem])
def preinscripciones_evolucion(
    request,
    anio: int | None = None,
    profesorado_id: int | None = None,
    agrupacion: str = "semana",
):
    """
    Serie temporal de evolución de preinscripciones agrupada por semana o mes según created_at.
    """
    if not (request.user.is_superuser or can(request.user, "ver_metricas") or can(request.user, "ver_dashboard")):
        raise HttpError(403, "No tiene permisos para ver métricas de preinscripciones.")

    qs = Preinscripcion.objects.filter(created_at__isnull=False)
    if anio:
        qs = qs.filter(anio=anio)
    if profesorado_id:
        qs = qs.filter(carrera_id=profesorado_id)

    trunc_func = TruncMonth if agrupacion.lower() == "mes" else TruncWeek

    evol_raw = (
        qs.annotate(periodo_trunc=trunc_func("created_at"))
        .values("periodo_trunc")
        .annotate(total=Count("id"))
        .order_by("periodo_trunc")
    )

    items = []
    for row in evol_raw:
        dt = row["periodo_trunc"]
        periodo_str = dt.strftime("%Y-%m-%d") if dt else "S/F"
        items.append(
            PreinscripcionEvolucionItem(
                periodo=periodo_str,
                total=row["total"],
            )
        )
    return items


# ==========================================
# 6. ENDPOINTS DE DOCENTES Y CÁTEDRAS
# ==========================================


@router.get("/teachers/attendance-summary/", response=TeacherAttendanceSummaryOut)
def teacher_attendance_summary(
    request,
    anio: int | None = None,
    profesorado_id: int | None = None,
    docente_id: int | None = None,
):
    """
    Asistencia general docente agrupada por año (presente, ausente, tarde, justificada).
    Si no se especifica docente_id y tiene ver_metricas, computa todo el cuerpo docente.
    Permite filtrar por profesorado_id.
    """
    docente = _check_metrics_access(request, docente_id)

    qs = AsistenciaDocente.objects.all()
    if docente:
        qs = qs.filter(docente=docente)
    if anio:
        qs = qs.filter(clase__fecha__year=anio)
    if profesorado_id:
        qs = qs.filter(clase__comision__materia__plan_de_estudio__profesorado_id=profesorado_id)

    counts = {row["estado"]: row["total"] for row in qs.values("estado").annotate(total=Count("id"))}

    presentes = counts.get("presente", 0)
    ausentes = counts.get("ausente", 0)
    tardes = counts.get("tarde", 0)
    justificadas = counts.get("ausente_justificado", 0) + counts.get("licencia", 0)
    total_registros = sum(counts.values())

    porcentaje = 0.0
    if total_registros > 0:
        # Los presentes y tardes suman asistencia institucional
        porcentaje = round(((presentes + tardes) / total_registros) * 100, 1)

    return {
        "docente_id": docente.id if docente else None,
        "total_registros": total_registros,
        "presentes": presentes,
        "ausentes": ausentes,
        "tardes": tardes,
        "justificadas": justificadas,
        "porcentaje_asistencia": porcentaje,
    }


@router.get("/teachers/attendance-by-weekday/", response=list[WeekdayAbsenceItem])
def teacher_attendance_by_weekday(
    request,
    anio: int | None = None,
    profesorado_id: int | None = None,
    docente_id: int | None = None,
):
    """
    Patrón de ausencias de docentes agrupadas por día de la semana (1: Domingo, 2: Lunes ... 7: Sábado).
    Permite detectar concentración de inasistencias en días clave y filtrar por carrera.
    """
    docente = _check_metrics_access(request, docente_id)

    qs = AsistenciaDocente.objects.filter(estado__in=["ausente", "ausente_justificado", "licencia"]).filter(
        clase__fecha__isnull=False
    )

    if docente:
        qs = qs.filter(docente=docente)
    if anio:
        qs = qs.filter(clase__fecha__year=anio)
    if profesorado_id:
        qs = qs.filter(clase__comision__materia__plan_de_estudio__profesorado_id=profesorado_id)

    # Agrupación por día de la semana (Django ExtractWeekDay: 1=Sunday, 2=Monday, ..., 7=Saturday)
    by_weekday_raw = (
        qs.annotate(dia=ExtractWeekDay("clase__fecha")).values("dia").annotate(total=Count("id")).order_by("dia")
    )

    dias_nombres = {
        1: "Domingo",
        2: "Lunes",
        3: "Martes",
        4: "Miércoles",
        5: "Jueves",
        6: "Viernes",
        7: "Sábado",
    }

    weekday_map = {row["dia"]: row["total"] for row in by_weekday_raw}

    resultado = []
    # De Lunes (2) a Viernes (6) o Sábado (7)
    for dia_num in range(2, 7):
        resultado.append(
            WeekdayAbsenceItem(
                dia_numero=dia_num,
                dia_nombre=dias_nombres[dia_num],
                ausencias=weekday_map.get(dia_num, 0),
            )
        )
    return resultado


@router.get("/teachers/desgranamiento-catedra/", response=DesgranamientoCatedraOut)
def teachers_desgranamiento_catedra(
    request,
    anio: int | None = None,
    profesorado_id: int | None = None,
    materia_id: int | None = None,
):
    """
    Tasa de desgranamiento por cátedra calculada desde PlanillaRegularidad -> PlanillaRegularidadFila.
    Reglas obligatorias:
    - Excluye planillas borrador (solo estado 'final').
    - Comisiones con < 15 alumnos se marcan con muestra_suficiente = False y sin porcentaje de tasa.
    - Se compara cada comisión contra el promedio de desgranamiento de su mismo año de cursada (1°, 2°, 3°, 4°).
    - Detecta y marca si hubo suplencia.
    """
    if not (request.user.is_superuser or can(request.user, "ver_metricas") or can(request.user, "ver_dashboard")):
        raise HttpError(403, "No tiene permisos para ver métricas de cátedras.")

    planillas_qs = (
        PlanillaRegularidad.objects.filter(estado=PlanillaRegularidad.Estado.FINAL)
        .select_related("materia", "materia__plan_de_estudio", "profesorado", "comision")
        .prefetch_related("docentes__docente", "filas")
    )

    if anio:
        planillas_qs = planillas_qs.filter(anio_academico=anio)
    if profesorado_id:
        planillas_qs = planillas_qs.filter(profesorado_id=profesorado_id)
    if materia_id:
        planillas_qs = planillas_qs.filter(materia_id=materia_id)

    # 1. Primero agrupamos inscriptos y abandonos (LAT, LBI) por año de cursada para calcular promedios
    totales_por_anio_cursada = {
        1: {"inscriptos": 0, "desgranados": 0},
        2: {"inscriptos": 0, "desgranados": 0},
        3: {"inscriptos": 0, "desgranados": 0},
        4: {"inscriptos": 0, "desgranados": 0},
    }

    planillas_data = []
    sin_muestra_count = 0

    for p in planillas_qs:
        filas = list(p.filas.all())
        total_inscr = len(filas)
        if total_inscr == 0:
            continue

        desgranados_count = sum(1 for f in filas if f.situacion in ["LAT", "LBI"])
        anio_cursada = getattr(p.materia, "anio_cursada", 1)

        # Si tiene muestra suficiente (>= 15), aporta al promedio de su año
        if total_inscr >= 15:
            if anio_cursada not in totales_por_anio_cursada:
                totales_por_anio_cursada[anio_cursada] = {"inscriptos": 0, "desgranados": 0}
            totales_por_anio_cursada[anio_cursada]["inscriptos"] += total_inscr
            totales_por_anio_cursada[anio_cursada]["desgranados"] += desgranados_count
        else:
            sin_muestra_count += 1

        # Docentes vinculados y chequeo de suplencia (excluyendo bedeles)
        docentes_list = []
        hubo_suplencia = False
        for d in p.docentes.all():
            rol_doc = (d.rol or "").lower()
            if "bedel" in rol_doc:
                continue
            nombre_doc = d.nombre or (str(d.docente) if d.docente else "Docente no registrado")
            if "suplente" in rol_doc:
                hubo_suplencia = True
            docentes_list.append(f"{nombre_doc} ({d.rol or 'Profesor'})")

        if not docentes_list and p.comision:
            for staff in p.comision.staff.all():
                rol_staff = (staff.rol or "").lower()
                if "bedel" in rol_staff:
                    continue
                if staff.es_suplente:
                    hubo_suplencia = True
                docentes_list.append(f"{staff.docente} ({staff.rol})")

        planillas_data.append(
            {
                "materia_id": p.materia_id,
                "materia_nombre": p.materia.nombre,
                "anio_cursada": anio_cursada,
                "profesorado_nombre": p.profesorado.nombre if p.profesorado else "",
                "comision_codigo": p.comision.codigo if p.comision else f"Comisión {p.numero}",
                "docentes": docentes_list,
                "hubo_suplencia": hubo_suplencia,
                "total_inscriptos": total_inscr,
                "desgranados_count": desgranados_count,
                "muestra_suficiente": total_inscr >= 15,
            }
        )

    # Calcular tasas promedio por año de cursada
    promedios_por_anio = {}
    for anio_c, vals in totales_por_anio_cursada.items():
        if vals["inscriptos"] > 0:
            promedios_por_anio[anio_c] = round((vals["desgranados"] / vals["inscriptos"]) * 100, 1)
        else:
            promedios_por_anio[anio_c] = None

    items = []
    for item_data in planillas_data:
        anio_c = item_data["anio_cursada"]
        promedio_anio = promedios_por_anio.get(anio_c)

        if item_data["muestra_suficiente"]:
            tasa = round((item_data["desgranados_count"] / item_data["total_inscriptos"]) * 100, 1)
            diff = round(tasa - promedio_anio, 1) if promedio_anio is not None else None
        else:
            tasa = None
            diff = None

        items.append(
            DesgranamientoCatedraItem(
                materia_id=item_data["materia_id"],
                materia_nombre=item_data["materia_nombre"],
                anio_cursada=anio_c,
                profesorado_nombre=item_data["profesorado_nombre"],
                comision_codigo=item_data["comision_codigo"],
                docentes=item_data["docentes"],
                hubo_suplencia=item_data["hubo_suplencia"],
                total_inscriptos=item_data["total_inscriptos"],
                muestra_suficiente=item_data["muestra_suficiente"],
                tasa_desgranamiento=tasa,
                promedio_desgranamiento_anio=promedio_anio,
                diferencia_vs_promedio=diff,
            )
        )

    return {
        "items": items,
        "comisiones_sin_muestra_suficiente": sin_muestra_count,
        "total_comisiones_analizadas": len(items),
        "nota_metodologica": (
            "El desgranamiento por cátedra refleja la tasa de alumnos que no continuaron la cursada "
            "(Libres por Inasistencia o Abandono Temprano) sobre planillas consolidadas. "
            "Se requiere un mínimo de 15 estudiantes inscriptos para que el valor sea estadísticamente representativo."
        ),
    }


# ==========================================
# 4. SERIES TEMPORALES (EVOLUCIÓN DE MÉTRICAS)
# ==========================================


def _snapshots_por_fecha(model, dias, **filtros):
    """
    Agrupa los snapshots del período por fecha.

    Los snapshots se guardan con granularidad por profesorado/comisión, así que
    para una misma fecha hay varias filas. Si no se filtra por una de esas
    dimensiones hay que CONSOLIDARLAS, si no cada profesorado aparecería como un
    punto distinto del eje temporal.

    Devuelve (dict fecha -> lista de snapshots, fecha_inicio, fecha_fin).
    """
    desde = timezone.now().date() - timedelta(days=dias)
    qs = model.objects.filter(fecha_snapshot__gte=desde)
    for campo, valor in filtros.items():
        if valor is not None:
            qs = qs.filter(**{campo: valor})

    agrupado: dict = {}
    for snap in qs.order_by("fecha_snapshot"):
        agrupado.setdefault(snap.fecha_snapshot, []).append(snap)

    if not agrupado:
        return {}, None, None

    fechas = sorted(agrupado)
    return agrupado, fechas[0].isoformat(), fechas[-1].isoformat()


def _promedio(valores):
    limpios = [v for v in valores if v is not None]
    return round(sum(limpios) / len(limpios), 2) if limpios else None


@router.get("/matricula/evolucion/", response=EvolucionOut)
def matricula_evolucion(request, profesorado_id: int | None = None, dias: int | None = None):
    """Evolución de matrícula a lo largo del tiempo, desde snapshots precalculados."""
    require(request.user, "ver_metricas")

    dias = dias or 90
    por_fecha, f_ini, f_fin = _snapshots_por_fecha(MatriculaSnapshot, dias, profesorado_id=profesorado_id)

    items = []
    for fecha in sorted(por_fecha):
        grupo = por_fecha[fecha]
        estados: dict[str, int] = {}
        for snap in grupo:
            for clave, valor in (snap.por_estado or {}).items():
                estados[clave] = estados.get(clave, 0) + valor

        items.append(
            {
                "fecha": fecha.isoformat(),
                "total_matriculados": sum(s.total_matriculados for s in grupo),
                "promedio_notas": _promedio([s.promedio_notas for s in grupo]),
                "promedio_asistencia": _promedio([s.promedio_asistencia for s in grupo]),
                "por_estado": estados,
            }
        )

    return {
        "items": items,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "periodo": f"últimos {dias} días",
    }


@router.get("/asistencia/evolucion/", response=EvolucionOut)
def asistencia_evolucion(request, profesorado_id: int | None = None, dias: int | None = None):
    """Evolución de asistencia agregada de estudiantes por profesorado."""
    require(request.user, "ver_metricas")

    dias = dias or 90
    por_fecha, f_ini, f_fin = _snapshots_por_fecha(AsistenciaSnapshot, dias, profesorado_id=profesorado_id)

    items = []
    for fecha in sorted(por_fecha):
        grupo = por_fecha[fecha]
        total = sum(s.total_registros for s in grupo)
        presentes = sum(s.presentes for s in grupo)

        items.append(
            {
                "fecha": fecha.isoformat(),
                "total_registros": total,
                "presentes": presentes,
                "ausentes": sum(s.ausentes for s in grupo),
                "tardias": sum(s.tardias for s in grupo),
                "justificadas": sum(s.justificadas for s in grupo),
                "porcentaje_asistencia": round(presentes / total * 100, 2) if total else None,
            }
        )

    return {
        "items": items,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "periodo": f"últimos {dias} días",
    }


@router.get("/ausentismo/evolucion/", response=EvolucionOut)
def ausentismo_evolucion(
    request,
    comision_id: int | None = None,
    profesorado_id: int | None = None,
    dias: int | None = None,
):
    """Evolución de ausentismo por comisión/cátedra."""
    require(request.user, "ver_metricas")

    dias = dias or 90
    filtros = {"comision_id": comision_id} if comision_id else {"profesorado_id": profesorado_id}
    por_fecha, f_ini, f_fin = _snapshots_por_fecha(AusentismoSnapshot, dias, **filtros)

    items = []
    for fecha in sorted(por_fecha):
        grupo = por_fecha[fecha]
        # La tasa se recalcula sobre los totales; promediar porcentajes de
        # comisiones de tamaños distintos daría un número engañoso.
        registros = sum((s.detalles or {}).get("total_registros", 0) for s in grupo)
        ausencias = sum((s.detalles or {}).get("ausencias", 0) for s in grupo)

        items.append(
            {
                "fecha": fecha.isoformat(),
                "tasa_ausentismo": round(ausencias / registros * 100, 2) if registros else 0.0,
                "total_estudiantes": sum(s.total_estudiantes for s in grupo),
                "estudiantes_criticos": sum(s.estudiantes_críticos for s in grupo),
            }
        )

    return {
        "items": items,
        "fecha_inicio": f_ini,
        "fecha_fin": f_fin,
        "periodo": f"últimos {dias} días",
    }


# ==========================================
# 5. RENDIMIENTO ACADÉMICO DESGLOSADO
# ==========================================
#
# Fuente de notas: ActaExamenEstudiante.calificacion_numerica (nota final de
# cada estudiante en un acta). ActaExamen es la cabecera del acta y da acceso
# a materia/profesorado. Se considera aprobado con nota >= 6.


def _distribucion(notas: list[int]) -> dict[str, int]:
    return {
        "0-4": sum(1 for n in notas if n < 5),
        "5-6": sum(1 for n in notas if 5 <= n < 7),
        "7-8": sum(1 for n in notas if 7 <= n < 9),
        "9-10": sum(1 for n in notas if n >= 9),
    }


@router.get("/academic-performance/por-materia/", response=RendimientoPorMateriaOut)
@cache_endpoint(timeout=900, prefix="academic_performance_materia")
def rendimiento_por_materia(request, profesorado_id: int | None = None):
    """Rendimiento académico desglosado por materia."""
    require(request.user, "ver_metricas")

    qs = ActaExamenEstudiante.objects.filter(calificacion_numerica__isnull=False).select_related(
        "acta__materia", "acta__profesorado"
    )

    if profesorado_id:
        qs = qs.filter(acta__profesorado_id=profesorado_id)

    por_materia: dict[int, dict] = {}
    for fila in qs.values(
        "acta__materia_id",
        "acta__materia__nombre",
        "acta__profesorado__nombre",
        "calificacion_numerica",
    ):
        mid = fila["acta__materia_id"]
        if mid is None:
            continue
        if mid not in por_materia:
            por_materia[mid] = {
                "materia_id": mid,
                "materia_nombre": fila["acta__materia__nombre"] or "Sin nombre",
                "profesorado": fila["acta__profesorado__nombre"] or "N/A",
                "notas": [],
            }
        por_materia[mid]["notas"].append(fila["calificacion_numerica"])

    items = []
    notas_globales: list[int] = []
    aprobados_global = 0

    for datos in por_materia.values():
        notas = datos["notas"]
        total = len(notas)
        aprobados = sum(1 for n in notas if n >= 6)

        items.append(
            RendimientoMateriaItem(
                materia_id=datos["materia_id"],
                materia_nombre=datos["materia_nombre"],
                profesorado=datos["profesorado"],
                total_estudiantes=total,
                promedio_nota=round(sum(notas) / total, 2),
                tasa_aprobacion=round(aprobados / total * 100, 1),
                tasa_desaprobacion=round((total - aprobados) / total * 100, 1),
                distribucion_notas=_distribucion(notas),
            )
        )
        notas_globales.extend(notas)
        aprobados_global += aprobados

    items.sort(key=lambda i: i.promedio_nota or 0)

    prof_nombre = None
    if profesorado_id:
        prof = Profesorado.objects.filter(id=profesorado_id).first()
        prof_nombre = prof.nombre if prof else None

    total_global = len(notas_globales)

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "profesorado_nombre": prof_nombre,
        "promedio_general": round(sum(notas_globales) / total_global, 2) if total_global else None,
        "tasa_aprobacion_general": round(aprobados_global / total_global * 100, 1) if total_global else 0,
    }


@router.get("/academic-performance/por-comisiones/", response=RendimientoComisionesOut)
@cache_endpoint(timeout=900, prefix="academic_performance_comisiones")
def rendimiento_por_comisiones(request, profesorado_id: int | None = None):
    """
    Rendimiento por comisión/cátedra.

    ADVERTENCIA METODOLÓGICA: no existe un vínculo directo entre una comisión de
    cursada y las actas de examen final. Las notas se atribuyen por MATERIA y
    AÑO LECTIVO, así que dos comisiones de la misma materia en el mismo año
    comparten las mismas notas. Sirve para comparar materias entre sí, no para
    comparar el desempeño de dos comisiones de una misma materia.
    """
    require(request.user, "ver_metricas")

    comisiones = Comision.objects.select_related("materia", "docente", "suplente").order_by("materia__nombre", "codigo")

    if profesorado_id:
        comisiones = comisiones.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    # Notas por (materia, año) en una sola pasada
    notas_qs = ActaExamenEstudiante.objects.filter(calificacion_numerica__isnull=False)
    if profesorado_id:
        notas_qs = notas_qs.filter(acta__profesorado_id=profesorado_id)

    notas_por_materia_anio: dict[tuple, list[int]] = {}
    for fila in notas_qs.values("acta__materia_id", "acta__anio_academico", "calificacion_numerica"):
        clave = (fila["acta__materia_id"], fila["acta__anio_academico"])
        notas_por_materia_anio.setdefault(clave, []).append(fila["calificacion_numerica"])

    items = []
    notas_globales: list[int] = []

    for comision in comisiones:
        notas = notas_por_materia_anio.get((comision.materia_id, comision.anio_lectivo), [])
        if not notas:
            continue

        total = len(notas)
        aprobados = sum(1 for n in notas if n >= 6)

        docentes = []
        if comision.docente:
            docentes.append(str(comision.docente))
        if comision.suplente:
            docentes.append(f"{comision.suplente} (suplente)")

        items.append(
            RendimientoComisionItem(
                comision_codigo=f"{comision.codigo} ({comision.anio_lectivo})",
                materia_nombre=comision.materia.nombre,
                docentes=docentes or ["Sin asignar"],
                total_inscritos=total,
                promedio_nota=round(sum(notas) / total, 2),
                tasa_aprobacion=round(aprobados / total * 100, 1),
                tasa_desaprobacion=round((total - aprobados) / total * 100, 1),
                estudiantes_riesgo=sum(1 for n in notas if n < 5),
            )
        )
        notas_globales.extend(notas)

    items.sort(key=lambda i: i.promedio_nota or 0)

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "total_comisiones": len(items),
        "promedio_general_notas": (round(sum(notas_globales) / len(notas_globales), 2) if notas_globales else None),
    }


@router.get("/academic-performance/comparacion-cohortes/", response=RendimientoCohortesOut)
@cache_endpoint(timeout=900, prefix="academic_performance_cohortes")
def comparacion_cohortes(request, profesorado_id: int | None = None):
    """
    Comparación de rendimiento entre cohortes (año de ingreso).

    NOTA: ActaExamenEstudiante identifica al estudiante por DNI (no por FK), así
    que el cruce cohorte↔notas se hace por DNI. Estudiantes sin anio_ingreso
    cargado quedan excluidos.
    """
    require(request.user, "ver_metricas")

    ec_qs = EstudianteCarrera.objects.select_related("estudiante").filter(estudiante__anio_ingreso__isnull=False)
    if profesorado_id:
        ec_qs = ec_qs.filter(profesorado_id=profesorado_id)

    # DNI -> cohorte
    dni_cohorte: dict[str, int] = {}
    estudiantes_por_cohorte: dict[int, set] = {}
    for ec in ec_qs:
        est = ec.estudiante
        cohorte = est.anio_ingreso
        if not est.dni:
            continue
        dni_cohorte[est.dni] = cohorte
        estudiantes_por_cohorte.setdefault(cohorte, set()).add(est.dni)

    if not dni_cohorte:
        return {"items": [], "profesorado_id": profesorado_id, "comparacion_historica": {}}

    notas_por_cohorte: dict[int, list[int]] = {}
    notas_qs = ActaExamenEstudiante.objects.filter(
        calificacion_numerica__isnull=False, dni__in=list(dni_cohorte.keys())
    ).values("dni", "calificacion_numerica")

    for fila in notas_qs:
        cohorte = dni_cohorte.get(fila["dni"])
        if cohorte is not None:
            notas_por_cohorte.setdefault(cohorte, []).append(fila["calificacion_numerica"])

    items = []
    for cohorte in sorted(notas_por_cohorte.keys(), reverse=True):
        notas = notas_por_cohorte[cohorte]
        total = len(notas)
        aprobados = sum(1 for n in notas if n >= 6)

        items.append(
            RendimientoCohortesItem(
                cohorte=cohorte,
                total_estudiantes=len(estudiantes_por_cohorte.get(cohorte, [])),
                promedio_general=round(sum(notas) / total, 2),
                tasa_aprobacion=round(aprobados / total * 100, 1),
                distribucion=_distribucion(notas),
            )
        )

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "comparacion_historica": {str(i.cohorte): i.promedio_general for i in items},
    }


# ==========================================
# 6. AUDITORÍA Y ACTIVIDAD DEL SISTEMA
# ==========================================


@router.get("/auditoria/dashboard/", response=AuditoriaDashboardOut)
def auditoria_dashboard(request):
    """
    Panel de auditoría: actividad del sistema, logins y alertas sin resolver.
    Fuentes: AuditLog (campo de fecha: timestamp) y SystemLog.
    """
    require(request.user, "ver_metricas")

    hoy = timezone.now().date()
    desde = hoy - timedelta(days=7)

    logs = AuditLog.objects.filter(timestamp__date__gte=desde)
    sys_logs = SystemLog.objects.filter(created_at__date__gte=desde)

    # Tipos de SystemLog considerados "alerta crítica" (choices reales del modelo)
    TIPOS_CRITICOS = ["SECURITY_ALERT", "SYSTEM_ERROR", "IMPORT_ERROR"]
    alertas_qs = SystemLog.objects.filter(resuelto=False, tipo__in=TIPOS_CRITICOS)

    acciones_crud = [AuditLog.Accion.CREATE, AuditLog.Accion.UPDATE, AuditLog.Accion.DELETE]

    # Hora pico de logins de hoy
    hora_pico = None
    pico = (
        logs.filter(accion=AuditLog.Accion.LOGIN, timestamp__date=hoy)
        .annotate(hora=ExtractHour("timestamp"))
        .values("hora")
        .annotate(total=Count("id"))
        .order_by("-total")
        .first()
    )
    if pico and pico["hora"] is not None:
        hora_pico = f"{pico['hora']:02d}:00"

    resumen = {
        "total_eventos_7d": logs.count(),
        "logins_7d": logs.filter(accion=AuditLog.Accion.LOGIN).count(),
        "acciones_crud_7d": logs.filter(accion__in=acciones_crud).count(),
        "alertas_sin_resolver": alertas_qs.count(),
        "eventos_hoy": logs.filter(timestamp__date=hoy).count(),
        "hora_pico": hora_pico,
    }

    # Logins y evolución por día (una pasada por fecha)
    logins_por_dia = []
    evolucion_7d = []
    for i in range(7, -1, -1):
        fecha = hoy - timedelta(days=i)
        del_dia = logs.filter(timestamp__date=fecha)
        logins_dia = del_dia.filter(accion=AuditLog.Accion.LOGIN)

        logins_por_dia.append(
            {
                "fecha": fecha.isoformat(),
                "total_logins": logins_dia.count(),
                "usuarios_unicos": logins_dia.values("usuario_id").distinct().count(),
            }
        )
        evolucion_7d.append(
            {
                "fecha": fecha.isoformat(),
                "logins": logins_dia.count(),
                "acciones_crud": del_dia.filter(accion__in=acciones_crud).count(),
                "errores": sys_logs.filter(created_at__date=fecha, tipo__in=["SYSTEM_ERROR", "IMPORT_ERROR"]).count(),
            }
        )

    # Top acciones
    total_acciones = logs.count()
    top_acciones = [
        {
            "accion": fila["accion"],
            "cantidad": fila["total"],
            "porcentaje": round(fila["total"] / total_acciones * 100, 1) if total_acciones else 0,
        }
        for fila in logs.values("accion").annotate(total=Count("id")).order_by("-total")[:10]
    ]

    # Top usuarios (nombre_usuario es el texto; usuario es FK y puede ser NULL)
    top_usuarios = [
        {
            "usuario": fila["nombre_usuario"] or "Sistema",
            "total_acciones": fila["total"],
            "ultimos_accesos": fila["ultimo"].isoformat() if fila["ultimo"] else None,
        }
        for fila in logs.values("nombre_usuario")
        .annotate(total=Count("id"), ultimo=Max("timestamp"))
        .order_by("-total")[:5]
    ]

    # Alertas críticas (SystemLog NO tiene entidad_afectada; se usa metadata)
    alertas_criticas = [
        {
            "id": a.id,
            "fecha": a.created_at.isoformat(),
            "tipo": a.tipo,
            "mensaje": a.mensaje[:300],
            "entidad_afectada": (a.metadata or {}).get("entidad") if isinstance(a.metadata, dict) else None,
            "resuelto": a.resuelto,
        }
        for a in alertas_qs.order_by("-created_at")[:10]
    ]

    return {
        "resumen": resumen,
        "logins_por_dia": logins_por_dia,
        "top_acciones": top_acciones,
        "top_usuarios": top_usuarios,
        "alertas_criticas": alertas_criticas,
        "evolucion_7d": evolucion_7d,
    }


# ==========================================
# 7. AUSENTISMO CONSOLIDADO
# ==========================================


@router.get("/ausentismo/consolidado/", response=AusentismoConsolidadoOut)
@cache_endpoint(timeout=600, prefix="ausentismo_consolidado")
def ausentismo_consolidado(
    request,
    profesorado_id: int | None = None,
    dias: int | None = None,
):
    """
    Ausentismo consolidado por profesorado/comisión con tendencias.
    Utiliza snapshots de AusentismoSnapshot para detectar cátedras con problemas emergentes.
    """
    require(request.user, "ver_metricas")

    dias = dias or 90
    fecha_limite = timezone.now().date() - timedelta(days=dias)

    # 1. EVOLUCIÓN TEMPORAL (últimos N días)
    snapshots = AusentismoSnapshot.objects.filter(fecha_snapshot__gte=fecha_limite).order_by("fecha_snapshot")

    if profesorado_id:
        snapshots = snapshots.filter(profesorado_id=profesorado_id)
        prof = Profesorado.objects.filter(id=profesorado_id).first()
        prof_name = prof.nombre if prof else None
    else:
        prof_name = None

    # Agregar por fecha
    evolucion_dict = {}
    for snap in snapshots:
        if snap.fecha_snapshot not in evolucion_dict:
            evolucion_dict[snap.fecha_snapshot] = {
                "total_clases": 0,
                "ausencias": 0,
                "tardias": 0,
                "estudiantes_sin_registro": 0,
            }

        evolucion_dict[snap.fecha_snapshot]["ausencias"] += snap.detalles.get("ausencias", 0)
        evolucion_dict[snap.fecha_snapshot]["tardias"] += snap.detalles.get("tardias", 0)
        evolucion_dict[snap.fecha_snapshot]["total_clases"] += snap.detalles.get("total_registros", 0)
        evolucion_dict[snap.fecha_snapshot]["estudiantes_sin_registro"] += snap.estudiantes_sin_registro

    evolucion = []
    for fecha in sorted(evolucion_dict.keys()):
        data = evolucion_dict[fecha]
        total = data["total_clases"]
        tasa = (data["ausencias"] / total * 100) if total > 0 else 0

        evolucion.append(
            {
                "fecha": fecha.isoformat(),
                "tasa_ausentismo": round(tasa, 1),
                "total_clases": total,
                "ausencias": data["ausencias"],
                "tardias": data["tardias"],
                "estudiantes_sin_registro": data["estudiantes_sin_registro"],
            }
        )

    # 2. RESUMEN GENERAL
    tasa_promedio = round(sum(e["tasa_ausentismo"] for e in evolucion) / len(evolucion), 1) if evolucion else 0
    tasa_maxima = max((e["tasa_ausentismo"] for e in evolucion), default=0)

    # 3. POR COMISIÓN (snapshot más reciente + histórico)
    comisiones_dict = {}
    for snap in snapshots:
        if snap.comision_id not in comisiones_dict:
            comisiones_dict[snap.comision_id] = {
                "snapshots": [],
                "comision": snap.comision,
                "profesorado": snap.profesorado,
                "total_estudiantes": snap.total_estudiantes,
            }

        comisiones_dict[snap.comision_id]["snapshots"].append(snap)

    catedras = []
    estudiantes_criticos_total = 0

    for _com_id, com_data in comisiones_dict.items():
        snapshots_com = com_data["snapshots"]
        comision = com_data["comision"]
        prof = com_data["profesorado"]

        if not comision or not snapshots_com:
            continue

        # Datos actuales (último snapshot)
        ultimo_snap = snapshots_com[-1]
        tasa_actual = ultimo_snap.tasa_ausentismo
        estudiantes_criticos_total += ultimo_snap.estudiantes_críticos

        # Histórico 7 últimos days
        fecha_hace_7d = timezone.now().date() - timedelta(days=7)
        snapshots_7d = [s for s in snapshots_com if s.fecha_snapshot >= fecha_hace_7d]
        tasa_promedio_7d = (
            (sum(s.tasa_ausentismo for s in snapshots_7d) / len(snapshots_7d)) if snapshots_7d else tasa_actual
        )

        # Tendencia
        if len(snapshots_7d) >= 2:
            tasa_primera = snapshots_7d[0].tasa_ausentismo
            tasa_ultima = snapshots_7d[-1].tasa_ausentismo
            diff = tasa_ultima - tasa_primera
            if diff > 2:
                tendencia = "empeorando"
            elif diff < -2:
                tendencia = "mejorando"
            else:
                tendencia = "estable"
        else:
            tendencia = "estable"

        # Docentes: Comision tiene FK directo a docente y suplente
        docentes = []
        if comision.docente:
            docentes.append(str(comision.docente))
        if comision.suplente:
            docentes.append(f"{comision.suplente} (suplente)")

        catedras.append(
            {
                "codigo_comision": f"{comision.codigo} ({comision.anio_lectivo})",
                "materia": comision.materia.nombre if comision.materia else "N/A",
                "docentes": docentes or ["Sin asignar"],
                "tasa_ausentismo_actual": round(tasa_actual, 1),
                "tasa_ausentismo_promedio_7d": round(tasa_promedio_7d, 1),
                "estudiantes_en_riesgo": ultimo_snap.estudiantes_críticos,
                "total_estudiantes": ultimo_snap.total_estudiantes,
                "tendencia": tendencia,
            }
        )

    # Ordenar por tasa de ausentismo (críticas primero)
    catedras.sort(key=lambda x: x["tasa_ausentismo_actual"], reverse=True)

    # 4. CÁTEDRAS CRÍTICAS (tasa > 20%)
    catedras_criticas = sum(1 for c in catedras if c["tasa_ausentismo_actual"] > 20)

    fecha_inicio = evolucion[0]["fecha"] if evolucion else None
    fecha_fin = evolucion[-1]["fecha"] if evolucion else None

    # La asistencia se marca por excepcion: una clase sin marcar queda como "ausente".
    # Mientras el modulo este en puesta a punto, casi todo el universo figura ausente y
    # la tasa resultante no representa el ausentismo real. Se expone la cobertura para
    # que el front pueda avisarlo en lugar de mostrar un numero enganoso.
    total_registros_periodo = sum(e["total_clases"] for e in evolucion)
    total_ausencias_periodo = sum(e["ausencias"] for e in evolucion)
    cobertura_marcacion = (
        round(((total_registros_periodo - total_ausencias_periodo) / total_registros_periodo) * 100, 1)
        if total_registros_periodo
        else 0.0
    )
    muestra_suficiente = total_registros_periodo >= 100 and cobertura_marcacion >= 20.0

    if muestra_suficiente:
        nota_metodologica = (
            "Tasa de ausentismo = ausencias / clases registradas. Se considera critica una catedra "
            "por encima del 20% y preocupante por encima del 10%. Un estudiante figura en riesgo "
            "con mas del 30% de ausencias."
        )
    else:
        nota_metodologica = (
            "Muestra no representativa: solo el "
            f"{cobertura_marcacion}% de los registros del periodo tiene marcacion efectiva "
            f"(sobre {total_registros_periodo} registros). Una clase sin marcar queda como ausente, "
            "por lo que mientras la toma de asistencia este en puesta a punto la tasa aparece "
            "artificialmente alta. Los valores se muestran a modo informativo y no deben leerse "
            "como ausentismo real."
        )

    return {
        "profesorado_id": profesorado_id,
        "profesorado_nombre": prof_name,
        "resumen": {
            "tasa_promedio": tasa_promedio,
            "tasa_maxima": tasa_maxima,
            "catedras_criticas": catedras_criticas,
        },
        "evolucion": evolucion,
        "catedras": catedras,
        "estudiantes_criticos": estudiantes_criticos_total,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "muestra_suficiente": muestra_suficiente,
        "cobertura_marcacion": cobertura_marcacion,
        "nota_metodologica": nota_metodologica,
    }


# ==========================================
# 8. MESAS DE EXAMEN Y TRÁMITES
# ==========================================


@router.get("/mesas/dashboard/", response=MesasDashboardOut)
@cache_endpoint(timeout=900, prefix="mesas_dashboard")
def mesas_dashboard(request):
    """
    Dashboard de mesas de examen.

    MesaExamen no guarda nota ni estado: la nota vive en las actas
    (mesa -> actas_cargadas -> estudiantes -> calificacion_numerica) y el
    "cierre" se representa con planilla_cerrada_en / activa.
    """
    require(request.user, "ver_metricas")

    mesas = MesaExamen.objects.all()
    total_mesas = mesas.count()
    # "Pendiente" = mesa activa cuya planilla todavía no fue cerrada
    mesas_pendientes = mesas.filter(activa=True, planilla_cerrada_en__isnull=True).count()

    etiquetas_tipo = dict(MesaExamen.Tipo.choices)

    # Notas por tipo de mesa, en una sola query
    notas_por_tipo: dict[str, list[int]] = {}
    for fila in ActaExamenEstudiante.objects.filter(
        calificacion_numerica__isnull=False, acta__mesa__isnull=False
    ).values("acta__mesa__tipo", "calificacion_numerica"):
        notas_por_tipo.setdefault(fila["acta__mesa__tipo"], []).append(fila["calificacion_numerica"])

    por_tipo = []
    for fila in mesas.values("tipo").annotate(cantidad=Count("id")).order_by("-cantidad"):
        tipo = fila["tipo"]
        notas = notas_por_tipo.get(tipo, [])
        aprobados = sum(1 for n in notas if n >= 6)
        por_tipo.append(
            {
                "tipo_mesa": etiquetas_tipo.get(tipo, tipo or "Sin especificar"),
                "cantidad": fila["cantidad"],
                "promedio_nota": round(sum(notas) / len(notas), 2) if notas else None,
                "tasa_aprobacion": round(aprobados / len(notas) * 100, 1) if notas else 0,
            }
        )

    # Resultados: se derivan de los totales que ya trae cada acta
    totales = ActaExamen.objects.aggregate(
        aprobados=Sum("total_aprobados"),
        desaprobados=Sum("total_desaprobados"),
        ausentes=Sum("total_ausentes"),
    )
    aprobados = totales["aprobados"] or 0
    desaprobados = totales["desaprobados"] or 0
    ausentes = totales["ausentes"] or 0
    total_resultados = aprobados + desaprobados + ausentes

    por_resultado = [
        {
            "resultado": etiqueta,
            "cantidad": valor,
            "porcentaje": round(valor / total_resultados * 100, 1) if total_resultados else 0,
        }
        for etiqueta, valor in (
            ("Aprobados", aprobados),
            ("Desaprobados", desaprobados),
            ("Ausentes", ausentes),
        )
    ]

    todas_las_notas = [n for notas in notas_por_tipo.values() for n in notas]
    aprobadas_total = sum(1 for n in todas_las_notas if n >= 6)

    ultimas_mesas = [
        {
            "materia": mesa.materia.nombre if mesa.materia else "N/A",
            "estudiante": f"{mesa.inscripciones.count()} inscriptos",
            "tipo": etiquetas_tipo.get(mesa.tipo, mesa.tipo),
            "nota": None,
            "fecha": mesa.fecha.isoformat() if mesa.fecha else None,
        }
        for mesa in mesas.select_related("materia").order_by("-fecha")[:10]
    ]

    return {
        "total_mesas": total_mesas,
        "mesas_pendientes": mesas_pendientes,
        "promedio_general_notas": (round(sum(todas_las_notas) / len(todas_las_notas), 2) if todas_las_notas else None),
        "tasa_aprobacion_general": (round(aprobadas_total / len(todas_las_notas) * 100, 1) if todas_las_notas else 0),
        "por_tipo": por_tipo,
        "por_resultado": por_resultado,
        "ultimas_mesas": ultimas_mesas,
    }


@router.get("/tramites/dashboard/", response=TramitesDashboardOut)
@cache_endpoint(timeout=600, prefix="tramites_dashboard")
def tramites_dashboard(request):
    """
    Dashboard de trámites: pedidos de analítico y de equivalencia.

    Los dos modelos tienen ciclos de vida distintos:
      - PedidoAnalitico.estado: PEND / CONF / ENTR
      - PedidoEquivalencia.workflow_estado: draft / pending_docs / review /
        titulos / notified, con resultado_final: pendiente / otorgada /
        denegada / mixta
    Por eso NO se reducen a "aprobado/rechazado": se informa cada estado tal
    cual, y "finalizado" = analítico ENTREGADO o equivalencia NOTIFICADA.
    """
    require(request.user, "ver_metricas")

    hoy = timezone.now().date()

    analiticos = PedidoAnalitico.objects.select_related("estudiante").order_by("-created_at")
    equivalencias = PedidoEquivalencia.objects.select_related("estudiante").order_by("-created_at")

    etiquetas_analitico = dict(PedidoAnalitico.Estado.choices)
    etiquetas_workflow = dict(PedidoEquivalencia.WorkflowEstado.choices)

    por_estado: dict[str, int] = {}
    for fila in analiticos.values("estado").annotate(total=Count("id")):
        clave = f"Analítico: {etiquetas_analitico.get(fila['estado'], fila['estado'])}"
        por_estado[clave] = fila["total"]
    for fila in equivalencias.values("workflow_estado").annotate(total=Count("id")):
        clave = f"Equivalencia: {etiquetas_workflow.get(fila['workflow_estado'], fila['workflow_estado'])}"
        por_estado[clave] = fila["total"]

    # Finalizados vs en curso
    analiticos_entregados = analiticos.filter(estado=PedidoAnalitico.Estado.ENTREGADO)
    equiv_notificadas = equivalencias.filter(workflow_estado=PedidoEquivalencia.WorkflowEstado.NOTIFICADO)

    total_finalizados = analiticos_entregados.count() + equiv_notificadas.count()
    total_pendientes = (
        analiticos.exclude(estado=PedidoAnalitico.Estado.ENTREGADO).count()
        + equivalencias.exclude(workflow_estado=PedidoEquivalencia.WorkflowEstado.NOTIFICADO).count()
    )

    # Tiempos de resolución sobre lo que sí tiene fecha de cierre
    tiempos = []
    for p in analiticos_entregados.filter(preparado_en__isnull=False):
        tiempos.append((p.preparado_en - p.created_at).days)
    for p in equiv_notificadas.filter(notificado_en__isnull=False):
        tiempos.append((p.notificado_en - p.created_at).days)

    tiempos = [t for t in tiempos if t >= 0]

    # Últimos trámites de ambos tipos
    recientes = []
    for p in analiticos[:10]:
        recientes.append(
            {
                "id": p.id,
                "tipo": "Analítico",
                "estado": etiquetas_analitico.get(p.estado, p.estado),
                "estudiante_nombre": str(p.estudiante),
                "dias_transcurridos": (hoy - p.created_at.date()).days,
                "fecha_solicitud": p.created_at.isoformat(),
                "observaciones": p.motivo_otro or None,
            }
        )
    for p in equivalencias[:10]:
        recientes.append(
            {
                "id": p.id,
                "tipo": "Equivalencia",
                "estado": etiquetas_workflow.get(p.workflow_estado, p.workflow_estado),
                "estudiante_nombre": str(p.estudiante),
                "dias_transcurridos": (hoy - p.created_at.date()).days,
                "fecha_solicitud": p.created_at.isoformat(),
                "observaciones": p.profesorado_destino_nombre or None,
            }
        )

    recientes.sort(key=lambda x: x["fecha_solicitud"], reverse=True)

    return {
        "total_pendientes": total_pendientes,
        "total_finalizados": total_finalizados,
        "tiempo_promedio_resolucion": round(sum(tiempos) / len(tiempos), 1) if tiempos else 0,
        "tiempo_maximo": max(tiempos) if tiempos else 0,
        "por_estado": por_estado,
        "pedidos_recientes": recientes[:20],
    }
