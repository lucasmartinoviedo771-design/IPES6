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
from core.models import (
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
