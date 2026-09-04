import csv
from datetime import datetime, timedelta
from typing import Optional

from django.db.models import Avg, Case, CharField, Count, Max, Q, Sum, Value, When
from django.db.models.functions import ExtractWeekDay, TruncMonth, TruncWeek
from django.http import HttpResponse
from django.utils import timezone
from ninja import Query, Router, Schema
from ninja.errors import HttpError
from ninja.pagination import PageNumberPagination, paginate

from apps.asistencia.models import AsistenciaDocente, ClaseProgramada
from apps.estudiantes.api.helpers.user_utils import _resolve_docente_from_user
from apps.metrics.models import (
    AsistenciaSnapshot,
    AusentismoSnapshot,
    MatriculaSnapshot,
)
from core.models import (
    AuditLog,
    Comision,
    Docente,
    Estudiante,
    EstudianteCarrera,
    InscripcionMateriaEstudiante,
    Materia,
    MesaExamen,
    PlanillaRegularidad,
    PlanillaRegularidadDocente,
    PlanillaRegularidadFila,
    Preinscripcion,
    Profesorado,
    Regularidad,
    RiesgoAcademicoEstudiante,
)
from apps.common.models import SystemLog
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


class AusentismoEvolucionItem(Schema):
    fecha: str
    tasa_ausentismo: float
    total_estudiantes: int
    estudiantes_críticos: int


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
    por_carrera_raw = (
        qs.values("carrera_id", "carrera__nombre")
        .annotate(total=Count("id"))
        .order_by("-total")
    )
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

    counts = {
        row["estado"]: row["total"]
        for row in qs.values("estado").annotate(total=Count("id"))
    }

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

    qs = AsistenciaDocente.objects.filter(
        estado__in=["ausente", "ausente_justificado", "licencia"]
    ).filter(clase__fecha__isnull=False)

    if docente:
        qs = qs.filter(docente=docente)
    if anio:
        qs = qs.filter(clase__fecha__year=anio)
    if profesorado_id:
        qs = qs.filter(clase__comision__materia__plan_de_estudio__profesorado_id=profesorado_id)

    # Agrupación por día de la semana (Django ExtractWeekDay: 1=Sunday, 2=Monday, ..., 7=Saturday)
    by_weekday_raw = (
        qs.annotate(dia=ExtractWeekDay("clase__fecha"))
        .values("dia")
        .annotate(total=Count("id"))
        .order_by("dia")
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

    planillas_qs = PlanillaRegularidad.objects.filter(estado=PlanillaRegularidad.Estado.FINAL).select_related(
        "materia", "materia__plan_de_estudio", "profesorado", "comision"
    ).prefetch_related("docentes__docente", "filas")

    if anio:
        planillas_qs = planillas_qs.filter(anio_academico=anio)
    if profesorado_id:
        planillas_qs = planillas_qs.filter(profesorado_id=profesorado_id)
    if materia_id:
        planillas_qs = planillas_qs.filter(materia_id=materia_id)

    # 1. Primero agrupamos inscriptos y abandonos (LAT, LBI) por año de cursada para calcular promedios
    totales_por_anio_cursada = {1: {"inscriptos": 0, "desgranados": 0}, 2: {"inscriptos": 0, "desgranados": 0}, 3: {"inscriptos": 0, "desgranados": 0}, 4: {"inscriptos": 0, "desgranados": 0}}

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

        planillas_data.append({
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
        })

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


@router.get("/matricula/evolucion/", response=EvolucionOut)
def matricula_evolucion(
    request,
    profesorado_id: int | None = None,
    dias: int | None = None,
):
    """
    Evolución de matrícula a lo largo del tiempo (últimos N días/snapshots).
    Reutiliza snapshots precalculados para performance.
    """
    require(request.user, "ver_metricas")

    dias = dias or 90
    qs = MatriculaSnapshot.objects.all()

    if profesorado_id:
        qs = qs.filter(profesorado_id=profesorado_id)

    qs = qs.order_by("fecha_snapshot")[-dias:]

    items = [
        {
            "fecha": s.fecha_snapshot.isoformat(),
            "total_matriculados": s.total_matriculados,
            "promedio_notas": s.promedio_notas,
            "promedio_asistencia": s.promedio_asistencia,
            "por_estado": s.por_estado,
        }
        for s in qs
    ]

    fecha_inicio = qs.first().fecha_snapshot.isoformat() if qs.exists() else None
    fecha_fin = qs.last().fecha_snapshot.isoformat() if qs.exists() else None

    return {
        "items": items,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "periodo": f"últimos {dias} días",
    }


@router.get("/asistencia/evolucion/", response=EvolucionOut)
def asistencia_evolucion(
    request,
    profesorado_id: int | None = None,
    dias: int | None = None,
):
    """
    Evolución de asistencia agregada de estudiantes por profesorado.
    Útil para detectar tendencias de desenganche.
    """
    require(request.user, "ver_metricas")

    dias = dias or 90
    qs = AsistenciaSnapshot.objects.all()

    if profesorado_id:
        qs = qs.filter(profesorado_id=profesorado_id)

    qs = qs.order_by("fecha_snapshot")[-dias:]

    items = [
        {
            "fecha": s.fecha_snapshot.isoformat(),
            "total_registros": s.total_registros,
            "presentes": s.presentes,
            "ausentes": s.ausentes,
            "tardias": s.tardias,
            "justificadas": s.justificadas,
            "porcentaje_asistencia": s.porcentaje_asistencia,
        }
        for s in qs
    ]

    fecha_inicio = qs.first().fecha_snapshot.isoformat() if qs.exists() else None
    fecha_fin = qs.last().fecha_snapshot.isoformat() if qs.exists() else None

    return {
        "items": items,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "periodo": f"últimos {dias} días",
    }


@router.get("/ausentismo/evolucion/", response=EvolucionOut)
def ausentismo_evolucion(
    request,
    comision_id: int | None = None,
    profesorado_id: int | None = None,
    dias: int | None = None,
):
    """
    Evolución de ausentismo por comisión/cátedra.
    Detecta cátedras con problemas de asistencia emergentes.
    """
    require(request.user, "ver_metricas")

    dias = dias or 90
    qs = AusentismoSnapshot.objects.all()

    if comision_id:
        qs = qs.filter(comision_id=comision_id)
    elif profesorado_id:
        qs = qs.filter(profesorado_id=profesorado_id)

    qs = qs.order_by("fecha_snapshot")[-dias:]

    items = [
        {
            "fecha": s.fecha_snapshot.isoformat(),
            "tasa_ausentismo": s.tasa_ausentismo,
            "total_estudiantes": s.total_estudiantes,
            "estudiantes_críticos": s.estudiantes_críticos,
        }
        for s in qs
    ]

    fecha_inicio = qs.first().fecha_snapshot.isoformat() if qs.exists() else None
    fecha_fin = qs.last().fecha_snapshot.isoformat() if qs.exists() else None

    return {
        "items": items,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "periodo": f"últimos {dias} días",
    }


# ==========================================
# 5. RENDIMIENTO ACADÉMICO DESGLOSADO
# ==========================================


@router.get("/academic-performance/por-materia/", response=RendimientoPorMateriaOut)
def rendimiento_por_materia(
    request,
    profesorado_id: int | None = None,
):
    """
    Rendimiento académico desglosado por materia.
    Muestra promedio de notas, tasas de aprobación y distribución.
    """
    require(request.user, "ver_metricas")

    # Base: ActaExamen (notas finales de cada estudiante por materia)
    actas_qs = ActaExamen.objects.select_related("materia", "materia__plan_de_estudio__profesorado")

    if profesorado_id:
        actas_qs = actas_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)

    items = []
    prof_name = None

    # Agrupar por materia
    materias_dict = {}
    for acta in actas_qs:
        mat = acta.materia
        mat_key = mat.id

        if mat_key not in materias_dict:
            materias_dict[mat_key] = {
                "materia_id": mat.id,
                "materia_nombre": mat.nombre,
                "profesorado": mat.plan_de_estudio.profesorado.nombre if mat.plan_de_estudio.profesorado else "N/A",
                "notas": [],
                "total": 0,
            }

        if acta.nota_final is not None:
            materias_dict[mat_key]["notas"].append(acta.nota_final)
            materias_dict[mat_key]["total"] += 1

        if profesorado_id and mat.plan_de_estudio.profesorado:
            prof_name = mat.plan_de_estudio.profesorado.nombre

    # Calcular estadísticas por materia
    notas_globales = []
    aprobados_global = 0
    total_global = 0

    for mat_data in materias_dict.values():
        notas = mat_data["notas"]

        if not notas:
            continue

        total = len(notas)
        aprobados = sum(1 for n in notas if n >= 6)
        desaprobados = total - aprobados
        promedio = sum(notas) / total if notas else None

        # Distribución de notas
        distribucion = {
            "0-4": sum(1 for n in notas if n < 5),
            "5-6": sum(1 for n in notas if 5 <= n < 7),
            "7-8": sum(1 for n in notas if 7 <= n < 9),
            "9-10": sum(1 for n in notas if 9 <= n <= 10),
        }

        items.append(
            RendimientoMateriaItem(
                materia_id=mat_data["materia_id"],
                materia_nombre=mat_data["materia_nombre"],
                profesorado=mat_data["profesorado"],
                total_estudiantes=total,
                promedio_nota=round(promedio, 2) if promedio else None,
                tasa_aprobacion=round((aprobados / total * 100), 1) if total > 0 else 0,
                tasa_desaprobacion=round((desaprobados / total * 100), 1) if total > 0 else 0,
                distribucion_notas=distribucion,
            )
        )

        notas_globales.extend(notas)
        aprobados_global += aprobados
        total_global += total

    promedio_general = round(sum(notas_globales) / len(notas_globales), 2) if notas_globales else None
    tasa_aprobacion_general = round((aprobados_global / total_global * 100), 1) if total_global > 0 else 0

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "profesorado_nombre": prof_name,
        "promedio_general": promedio_general,
        "tasa_aprobacion_general": tasa_aprobacion_general,
    }


@router.get("/academic-performance/por-comisiones/", response=RendimientoComisionesOut)
def rendimiento_por_comisiones(
    request,
    profesorado_id: int | None = None,
):
    """
    Rendimiento académico por comisión/cátedra.
    Útil para identificar cátedras con bajo rendimiento.
    """
    require(request.user, "ver_metricas")

    comisiones_qs = Comision.objects.select_related(
        "horario_catedra__materia",
        "horario_catedra__profesorado"
    ).prefetch_related("horario_catedra__staff_asignaciones")

    if profesorado_id:
        comisiones_qs = comisiones_qs.filter(horario_catedra__profesorado_id=profesorado_id)

    items = []
    prof_name = None
    notas_globales = []

    for comision in comisiones_qs:
        if not comision.horario_catedra.exists():
            continue

        hc = comision.horario_catedra.first()

        # Notas de estudiantes en esta comisión
        actas_comision = ActaExamen.objects.filter(
            materia=hc.materia
        ).values_list("nota_final", flat=True)

        notas = [n for n in actas_comision if n is not None]

        if not notas:
            continue

        total = len(notas)
        aprobados = sum(1 for n in notas if n >= 6)
        desaprobados = total - aprobados
        promedio = sum(notas) / total if notas else None

        # Docentes de la comisión
        docentes_names = [
            f"{sa.docente.persona.nombre} {sa.docente.persona.apellido}"
            for sa in hc.staff_asignaciones.all()
        ] or ["Sin asignar"]

        # Estudiantes en riesgo (nota < 5)
        estudiantes_riesgo = sum(1 for n in notas if n < 5)

        if profesorado_id and hc.profesorado:
            prof_name = hc.profesorado.nombre

        items.append(
            RendimientoComisionItem(
                comision_codigo=comision.codigo,
                materia_nombre=hc.materia.nombre,
                docentes=docentes_names,
                total_inscritos=total,
                promedio_nota=round(promedio, 2) if promedio else None,
                tasa_aprobacion=round((aprobados / total * 100), 1) if total > 0 else 0,
                tasa_desaprobacion=round((desaprobados / total * 100), 1) if total > 0 else 0,
                estudiantes_riesgo=estudiantes_riesgo,
            )
        )

        notas_globales.extend(notas)

    promedio_general = round(sum(notas_globales) / len(notas_globales), 2) if notas_globales else None

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "total_comisiones": len(items),
        "promedio_general_notas": promedio_general,
    }


@router.get("/academic-performance/comparacion-cohortes/", response=RendimientoCohortesOut)
def comparacion_cohortes(
    request,
    profesorado_id: int | None = None,
):
    """
    Comparación de rendimiento entre cohortes (años de ingreso).
    Permite identificar si el desempeño mejora/empeora con el tiempo.
    """
    require(request.user, "ver_metricas")

    # Estudiantes por cohorte
    ec_qs = EstudianteCarrera.objects.select_related("estudiante")

    if profesorado_id:
        ec_qs = ec_qs.filter(profesorado_id=profesorado_id)

    items = []
    cohortes_dict = {}
    prof_name = None

    for ec in ec_qs:
        cohorte = ec.estudiante.anio_ingreso

        if cohorte not in cohortes_dict:
            cohortes_dict[cohorte] = {
                "estudiantes": [],
                "notas": [],
            }

        cohortes_dict[cohorte]["estudiantes"].append(ec.estudiante.id)

        if profesorado_id:
            prof_name = ec.profesorado.nombre

    # Obtener notas para cada cohorte
    for cohorte in sorted(cohortes_dict.keys(), reverse=True):
        est_ids = cohortes_dict[cohorte]["estudiantes"]

        actas = ActaExamen.objects.filter(
            estudiante_id__in=est_ids
        ).values_list("nota_final", flat=True)

        notas = [n for n in actas if n is not None]

        if notas:
            total = len(notas)
            aprobados = sum(1 for n in notas if n >= 6)
            promedio = sum(notas) / total

            items.append(
                RendimientoCohortesItem(
                    cohorte=cohorte,
                    total_estudiantes=len(est_ids),
                    promedio_general=round(promedio, 2),
                    tasa_aprobacion=round((aprobados / total * 100), 1),
                    distribucion={
                        "0-4": sum(1 for n in notas if n < 5),
                        "5-6": sum(1 for n in notas if 5 <= n < 7),
                        "7-8": sum(1 for n in notas if 7 <= n < 9),
                        "9-10": sum(1 for n in notas if 9 <= n <= 10),
                    },
                )
            )

    # Comparación histórica (promedio por año)
    comparacion_historica = {}
    for item in items:
        comparacion_historica[str(item.cohorte)] = item.promedio_general

    return {
        "items": items,
        "profesorado_id": profesorado_id,
        "comparacion_historica": comparacion_historica,
    }


# ==========================================
# 6. AUDITORÍA Y ACTIVIDAD DEL SISTEMA
# ==========================================


@router.get("/auditoria/dashboard/", response=AuditoriaDashboardOut)
def auditoria_dashboard(request):
    """
    Panel completo de auditoría: actividad del sistema, logins, alertas críticas.
    Utiliza AuditLog y SystemLog para dar visibilidad de la salud e integridad del sistema.
    """
    require(request.user, "ver_metricas")

    # Datos de últimos 7 días
    fecha_hace_7d = timezone.now().date() - timedelta(days=7)
    fecha_hoy = timezone.now().date()

    # 1. RESUMEN (últimos 7 días)
    audit_logs_7d = AuditLog.objects.filter(created_at__date__gte=fecha_hace_7d)
    system_logs = SystemLog.objects.filter(created_at__date__gte=fecha_hace_7d)
    alertas_sin_resolver = system_logs.filter(resuelto=False, tipo="ALERT")

    total_eventos_7d = audit_logs_7d.count()
    logins_7d = audit_logs_7d.filter(accion="LOGIN").count()
    acciones_crud_7d = audit_logs_7d.filter(accion__in=["CREATE", "UPDATE", "DELETE"]).count()
    eventos_hoy = audit_logs_7d.filter(created_at__date=fecha_hoy).count()

    # Hora pico (hora con más logins hoy)
    logins_hoy = audit_logs_7d.filter(accion="LOGIN", created_at__date=fecha_hoy)
    hora_pico = None
    if logins_hoy.exists():
        from django.db.models.functions import ExtractHour
        hora_pico_data = logins_hoy.annotate(
            hora=ExtractHour("created_at")
        ).values("hora").annotate(total=Count("id")).order_by("-total").first()
        if hora_pico_data:
            hora_pico = f"{hora_pico_data['hora']:02d}:00"

    resumen = {
        "total_eventos_7d": total_eventos_7d,
        "logins_7d": logins_7d,
        "acciones_crud_7d": acciones_crud_7d,
        "alertas_sin_resolver": alertas_sin_resolver.count(),
        "eventos_hoy": eventos_hoy,
        "hora_pico": hora_pico,
    }

    # 2. LOGINS POR DÍA (últimos 7 días)
    logins_por_dia = []
    for i in range(7, -1, -1):
        fecha = fecha_hoy - timedelta(days=i)
        logs_dia = audit_logs_7d.filter(
            accion="LOGIN",
            created_at__date=fecha
        )
        total_logins = logs_dia.count()
        usuarios_unicos = logs_dia.values("usuario").distinct().count()

        logins_por_dia.append({
            "fecha": fecha.isoformat(),
            "total_logins": total_logins,
            "usuarios_unicos": usuarios_unicos,
        })

    # 3. TOP ACCIONES
    top_acciones_data = audit_logs_7d.values("accion").annotate(
        cantidad=Count("id")
    ).order_by("-cantidad")[:10]

    total_acciones = audit_logs_7d.count()
    top_acciones = []
    for item in top_acciones_data:
        top_acciones.append({
            "accion": item["accion"],
            "cantidad": item["cantidad"],
            "porcentaje": round((item["cantidad"] / total_acciones * 100), 1) if total_acciones > 0 else 0,
        })

    # 4. TOP USUARIOS
    top_usuarios_data = audit_logs_7d.values("usuario").annotate(
        total_acciones=Count("id")
    ).order_by("-total_acciones")[:5]

    top_usuarios = []
    for item in top_usuarios_data:
        ultimo_acceso = audit_logs_7d.filter(
            usuario=item["usuario"]
        ).order_by("-created_at").first()

        top_usuarios.append({
            "usuario": item["usuario"] or "Anónimo",
            "total_acciones": item["total_acciones"],
            "ultimos_accesos": ultimo_acceso.created_at.isoformat() if ultimo_acceso else None,
        })

    # 5. ALERTAS CRÍTICAS
    alertas_criticas = []
    for alert in alertas_sin_resolver.order_by("-created_at")[:10]:
        alertas_criticas.append({
            "id": alert.id,
            "fecha": alert.created_at.isoformat(),
            "tipo": alert.tipo,
            "mensaje": alert.mensaje,
            "entidad_afectada": alert.entidad_afectada,
            "resuelto": alert.resuelto,
        })

    # 6. EVOLUCIÓN 7 DÍAS (logins, CRUD, errores)
    evolucion_7d = []
    for i in range(7, -1, -1):
        fecha = fecha_hoy - timedelta(days=i)
        logs_fecha = audit_logs_7d.filter(created_at__date=fecha)
        system_logs_fecha = system_logs.filter(created_at__date=fecha)

        logins = logs_fecha.filter(accion="LOGIN").count()
        crud = logs_fecha.filter(accion__in=["CREATE", "UPDATE", "DELETE"]).count()
        errores = system_logs_fecha.filter(tipo="ERROR").count()

        evolucion_7d.append({
            "fecha": fecha.isoformat(),
            "logins": logins,
            "acciones_crud": crud,
            "errores": errores,
        })

    return {
        "resumen": resumen,
        "logins_por_dia": logins_por_dia,
        "top_acciones": top_acciones,
        "top_usuarios": top_usuarios,
        "alertas_criticas": alertas_criticas,
        "evolucion_7d": evolucion_7d,
    }
