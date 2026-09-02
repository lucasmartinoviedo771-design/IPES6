"""
API de Administración Centralizada de Estudiantes y Legajos.
Gestiona el ciclo de vida administrativo del alumno: desde la supervisión de
documentación física (DNI, Títulos) hasta la auditoría de legajos y
la baja administrativa bajo estrictas reglas de integridad académica.
"""

from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.common.api_schemas import ApiResponse
from apps.common.audit import log_action_from_request, snapshot
from apps.common.date_utils import format_datetime
from core.models import (
    EquivalenciaDisposicionDetalle,
    Estudiante,
    EstudianteCarrera,
    ProrrogaTituloSecundario,
    Regularidad,
    ResidenciaCondicional,
)
from core.permissions import allowed_profesorados, ensure_profesorado_access, require

from ..schemas import (
    AutorizarRendirIn,
    EstudianteAdminDetail,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
    EstudianteDocumentacionBulkUpdateIn,
    EstudianteDocumentacionListItem,
    EstudianteDocumentacionListResponse,
    EstudianteDocumentacionUpdateIn,
    ProrrogaTituloIn,
    ProrrogaTituloOut,
)
from ..services.estudiante_service import EstudianteService
from .helpers import (
    _apply_estudiante_updates,
    _build_admin_detail,
    _recalcular_estado_legajo,
)
from .router import estudiantes_router as router


@router.get("/admin/resguardo-materias")
def admin_resguardo_materias(
    request,
    profesorado_id: int | None = None,
    dni: str | None = None,
    estado_academico: str = "ACT",
):
    """
    Lista todas las Regularidades y Equivalencias con en_resguardo=True,
    con el motivo detallado de por qué están en resguardo.
    Filtrable por profesorado, DNI y estado académico del estudiante ('ACT', 'INA', 'ALL').
    """
    from datetime import date

    from apps.estudiantes.api.helpers.misc_utils import (
        _calcular_vigencia_regularidad,
        _tiene_aprobacion_valida,
    )
    from core.models import Correlatividad, Materia

    require(request.user, "ver_estudiantes")

    hoy = date.today()
    resultado = []

    def _motivo_faltantes(est, materia, autorizadas_ids, situacion=None):
        faltantes = []
        for corr in Correlatividad.objects.filter(
            materia_origen=materia,
            tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR,
        ).select_related("materia_correlativa"):
            if not _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                faltantes.append(f"Necesita APROBAR: {corr.materia_correlativa.nombre}")
        for corr in Correlatividad.objects.filter(
            materia_origen=materia,
            tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR,
        ).select_related("materia_correlativa"):
            if _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                continue
            # Solo la regularidad más reciente: si la última está vencida/agotada,
            # las anteriores también lo estarían (son más viejas).
            rc = (
                Regularidad.objects.filter(
                    estudiante=est,
                    materia=corr.materia_correlativa,
                    situacion=Regularidad.Situacion.REGULAR,
                    en_resguardo=False,
                )
                .order_by("-fecha_cierre")
                .first()
            )
            if not rc:
                faltantes.append(f"Necesita REGULARIZAR: {corr.materia_correlativa.nombre}")
            else:
                limite, intentos, max_i = _calcular_vigencia_regularidad(est, rc)
                if hoy > limite:
                    faltantes.append(f"Regularidad VENCIDA ({rc.fecha_cierre}): {corr.materia_correlativa.nombre}")
                elif intentos >= max_i:
                    faltantes.append(
                        f"Regularidad AGOTADA ({intentos}/{max_i} intentos): {corr.materia_correlativa.nombre}"
                    )
        if situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            for corr in Correlatividad.objects.filter(
                materia_origen=materia,
                tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
            ).select_related("materia_correlativa"):
                if not _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                    faltantes.append(f"Necesita APROBAR (para rendir): {corr.materia_correlativa.nombre}")
        # Si una materia aparece como "Necesita APROBAR (para rendir)", la regularidad
        # es irrelevante — eliminar entradas "Necesita REGULARIZAR" duplicadas para esa materia.
        materias_que_requieren_aprobacion = {
            f.split(": ", 1)[1] for f in faltantes if f.startswith("Necesita APROBAR (para rendir):")
        }
        faltantes = [
            f
            for f in faltantes
            if not (f.startswith("Necesita REGULARIZAR:") and f.split(": ", 1)[1] in materias_que_requieren_aprobacion)
        ]
        return list(dict.fromkeys(faltantes))

    # Estudiantes según estado académico en el profesorado indicado
    estudiantes_prof_qs = EstudianteCarrera.objects.all()
    if profesorado_id:
        estudiantes_prof_qs = estudiantes_prof_qs.filter(profesorado_id=profesorado_id)

    estado_upper = (estado_academico or "ACT").upper().strip()
    if estado_upper == "ACT":
        estudiantes_prof_qs = estudiantes_prof_qs.filter(estado_academico="ACT")
    elif estado_upper == "INA":
        estudiantes_prof_qs = estudiantes_prof_qs.exclude(estado_academico="ACT")
    # Si es 'ALL' o 'TODOS', no se aplica filtro de estado académico

    estudiantes_ids = estudiantes_prof_qs.values_list("estudiante_id", flat=True)

    # Mapa de estado académico por estudiante para mostrar en el listado
    estados_academicos = dict(estudiantes_prof_qs.values_list("estudiante_id", "estado_academico"))

    # Regularidades en resguardo
    reg_qs = Regularidad.objects.filter(en_resguardo=True, estudiante_id__in=estudiantes_ids).select_related(
        "estudiante__persona", "materia__plan_de_estudio__profesorado"
    )
    if profesorado_id:
        reg_qs = reg_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if dni:
        reg_qs = reg_qs.filter(estudiante__persona__dni=dni)
    reg_qs = reg_qs.order_by("estudiante__persona__apellido", "materia__nombre")

    from apps.common.date_utils import format_date

    for reg in reg_qs:
        est = reg.estudiante
        autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
        prof = (
            getattr(getattr(reg.materia.plan_de_estudio, "profesorado", None), "nombre", None)
            if reg.materia.plan_de_estudio_id
            else None
        )
        est_acad = estados_academicos.get(est.id, "ACT")
        resultado.append(
            {
                "tipo": "REG",
                "dni": est.persona.dni if est.persona_id else None,
                "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est.id),
                "profesorado": prof,
                "materia": reg.materia.nombre,
                "situacion": reg.get_situacion_display(),
                "fecha": format_date(reg.fecha_cierre) if reg.fecha_cierre else None,
                "fecha_iso": reg.fecha_cierre.isoformat() if reg.fecha_cierre else None,
                "motivos": _motivo_faltantes(est, reg.materia, autorizadas_ids, reg.situacion),
                "estado_academico": est_acad,
            }
        )

    # Equivalencias en resguardo
    eq_qs = EquivalenciaDisposicionDetalle.objects.filter(
        en_resguardo=True, disposicion__estudiante_id__in=estudiantes_ids
    ).select_related("disposicion__estudiante__persona", "materia__plan_de_estudio__profesorado")
    if profesorado_id:
        eq_qs = eq_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if dni:
        eq_qs = eq_qs.filter(disposicion__estudiante__persona__dni=dni)
    eq_qs = eq_qs.order_by("disposicion__estudiante__persona__apellido", "materia__nombre")

    for eq in eq_qs:
        est = eq.disposicion.estudiante
        autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
        prof = (
            getattr(getattr(eq.materia.plan_de_estudio, "profesorado", None), "nombre", None)
            if eq.materia.plan_de_estudio_id
            else None
        )
        est_acad = estados_academicos.get(est.id, "ACT")
        resultado.append(
            {
                "tipo": "EQUIV",
                "dni": est.persona.dni if est.persona_id else None,
                "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est.id),
                "profesorado": prof,
                "materia": eq.materia.nombre,
                "situacion": "Equivalencia",
                "fecha": format_date(eq.disposicion.fecha_disposicion) if eq.disposicion.fecha_disposicion else None,
                "fecha_iso": eq.disposicion.fecha_disposicion.isoformat() if eq.disposicion.fecha_disposicion else None,
                "motivos": _motivo_faltantes(est, eq.materia, autorizadas_ids),
                "estado_academico": est_acad,
            }
        )

    return 200, resultado


@router.post("/admin/resguardo-materias/recalcular")
def admin_recalcular_resguardo(
    request,
    profesorado_id: int | None = None,
    solo_activos: bool = True,
):
    """
    Ejecuta el comando recalcular_resguardo en un hilo de fondo para evitar timeout.
    Solo para admin y secretaria.
    """
    import threading

    from django.core.management import call_command

    require(request.user, "editar_estudiantes")

    kwargs = {
        "dry_run": False,
        "solo_equivalencias": False,
        "solo_regularidades": False,
        "dni": None,
        "solo_activos": solo_activos,
        "profesorado": profesorado_id,
    }

    def run():
        try:
            call_command("recalcular_resguardo", **kwargs)
        except Exception:
            pass

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    return 200, {
        "ok": True,
        "regularidades_marcadas": 0,
        "regularidades_liberadas": 0,
        "equivalencias_marcadas": 0,
        "equivalencias_liberadas": 0,
    }
