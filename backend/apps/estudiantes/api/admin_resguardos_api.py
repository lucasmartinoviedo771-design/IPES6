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
from core.models import Estudiante, EstudianteCarrera, ProrrogaTituloSecundario, ResidenciaCondicional, Regularidad, EquivalenciaDisposicionDetalle
from core.permissions import allowed_profesorados, ensure_roles, ensure_profesorado_access
from apps.common.date_utils import format_datetime

from ..schemas import (
    AutorizarRendirIn,
    EstudianteAdminDetail,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
    EstudianteDocumentacionListItem,
    EstudianteDocumentacionListResponse,
    EstudianteDocumentacionUpdateIn,
    EstudianteDocumentacionBulkUpdateIn,
    ProrrogaTituloIn,
    ProrrogaTituloOut,
)
from .router import estudiantes_router as router
from ..services.estudiante_service import EstudianteService
from .helpers import (
    _ensure_admin,
    _ensure_staff_view,
    _apply_estudiante_updates,
    _build_admin_detail,
    _recalcular_estado_legajo,
)
from apps.common.audit import log_action_from_request, snapshot


@router.get("/admin/resguardo-materias")
def admin_resguardo_materias(
    request,
    profesorado_id: int | None = None,
    dni: str | None = None,
):
    """
    Lista todas las Regularidades y Equivalencias con en_resguardo=True,
    con el motivo detallado de por qué están en resguardo.
    Filtrable por profesorado y DNI.
    """
    from datetime import date
    from core.models import Correlatividad, Materia
    from apps.estudiantes.api.helpers.misc_utils import (
        _tiene_aprobacion_valida,
        _calcular_vigencia_regularidad,
    )
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

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
                    faltantes.append(f"Regularidad AGOTADA ({intentos}/{max_i} intentos): {corr.materia_correlativa.nombre}")
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
            f for f in faltantes
            if not (f.startswith("Necesita REGULARIZAR:") and f.split(": ", 1)[1] in materias_que_requieren_aprobacion)
        ]
        return list(dict.fromkeys(faltantes))

    # Estudiantes activos en el profesorado indicado
    from core.models import EstudianteCarrera
    activos_en_prof_qs = EstudianteCarrera.objects.filter(estado_academico="ACT")
    if profesorado_id:
        activos_en_prof_qs = activos_en_prof_qs.filter(profesorado_id=profesorado_id)
    activos_ids = activos_en_prof_qs.values_list("estudiante_id", flat=True)

    # Regularidades en resguardo
    reg_qs = Regularidad.objects.filter(en_resguardo=True, estudiante_id__in=activos_ids).select_related(
        "estudiante__persona", "materia__plan_de_estudio__profesorado"
    )
    if profesorado_id:
        reg_qs = reg_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if dni:
        reg_qs = reg_qs.filter(estudiante__persona__dni=dni)
    reg_qs = reg_qs.order_by("estudiante__persona__apellido", "materia__nombre")

    for reg in reg_qs:
        est = reg.estudiante
        autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
        prof = getattr(getattr(reg.materia.plan_de_estudio, "profesorado", None), "nombre", None) if reg.materia.plan_de_estudio_id else None
        resultado.append({
            "tipo": "REG",
            "dni": est.persona.dni if est.persona_id else None,
            "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est.id),
            "profesorado": prof,
            "materia": reg.materia.nombre,
            "situacion": reg.get_situacion_display(),
            "motivos": _motivo_faltantes(est, reg.materia, autorizadas_ids, reg.situacion),
        })

    # Equivalencias en resguardo
    eq_qs = EquivalenciaDisposicionDetalle.objects.filter(en_resguardo=True, disposicion__estudiante_id__in=activos_ids).select_related(
        "disposicion__estudiante__persona", "materia__plan_de_estudio__profesorado"
    )
    if profesorado_id:
        eq_qs = eq_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if dni:
        eq_qs = eq_qs.filter(disposicion__estudiante__persona__dni=dni)
    eq_qs = eq_qs.order_by("disposicion__estudiante__persona__apellido", "materia__nombre")

    for eq in eq_qs:
        est = eq.disposicion.estudiante
        autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
        prof = getattr(getattr(eq.materia.plan_de_estudio, "profesorado", None), "nombre", None) if eq.materia.plan_de_estudio_id else None
        resultado.append({
            "tipo": "EQUIV",
            "dni": est.persona.dni if est.persona_id else None,
            "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est.id),
            "profesorado": prof,
            "materia": eq.materia.nombre,
            "situacion": "Equivalencia",
            "motivos": _motivo_faltantes(est, eq.materia, autorizadas_ids),
        })

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
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

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
