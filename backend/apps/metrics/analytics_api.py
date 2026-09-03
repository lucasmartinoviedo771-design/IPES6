import csv
from datetime import datetime, timedelta
from typing import Optional

from django.db.models import Avg, Count, Max, Q, Sum
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
    MesaExamen,
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
    export: str | None = None,
):
    """
    Grilla paginada de estudiantes en un nivel de riesgo (rojo, amarillo, verde),
    con opción de exportar a CSV para Secretaría o Tutorías.
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
