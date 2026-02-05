from __future__ import annotations

from django.db.models import Max, Q

from apps.common.api_schemas import ApiResponse
from core.models import Correlatividad, Estudiante, HorarioCatedra, HorarioCatedraDetalle, Materia, PlanDeEstudio, Profesorado

from ..schemas import Horario, HorarioTabla, MateriaPlan
from .helpers import (
    _correlatividades_qs,
    _construir_tablas_horario,
    _ensure_estudiante_access,
    _listar_carreras_detalle,
    _resolve_estudiante,
)
from .router import estudiantes_router


@estudiantes_router.get(
    "/materias-plan",
    response={
        200: list[MateriaPlan],
        400: ApiResponse,
        403: ApiResponse,
        404: ApiResponse,
    },
)
def materias_plan(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    dni: str | None = None,
):
    """Devuelve las materias del plan de estudio elegido para el estudiante."""
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    carreras_est = list(est.carreras.all()) if est else []
    plan_profesorado: Profesorado | None = None

    plan: PlanDeEstudio | None = None
    if plan_id is not None:
        plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
        if not plan:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
        plan_profesorado = plan.profesorado
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(
                ok=False,
                message="El estudiante no pertenece al profesorado de ese plan.",
            )
    elif profesorado_id is not None:
        plan_profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not plan_profesorado:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado solicitado.")
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no está inscripto en ese profesorado.")
        plan = PlanDeEstudio.objects.filter(profesorado=plan_profesorado).order_by("-vigente", "-anio_inicio").first()
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para continuar.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            plan_profesorado = carreras_est[0]
            plan = (
                PlanDeEstudio.objects.filter(profesorado=plan_profesorado).order_by("-vigente", "-anio_inicio").first()
            )
        else:
            plan = (
                PlanDeEstudio.objects.select_related("profesorado")
                .filter(vigente=True)
                .order_by("-anio_inicio")
                .first()
            )
            if plan:
                plan_profesorado = plan.profesorado

    if not plan or not plan_profesorado:
        return 404, ApiResponse(ok=False, message="No se pudo resolver un plan de estudio válido.")

    def map_cuat(regimen: str) -> str:
        return (
            "ANUAL"
            if regimen == Materia.TipoCursada.ANUAL
            else ("1C" if regimen == Materia.TipoCursada.PRIMER_CUATRIMESTRE else "2C")
        )

    def horarios_para(m: Materia) -> list[Horario]:
        hcs = HorarioCatedra.objects.filter(espacio=m).annotate(max_anio=Max("anio_cursada")).order_by("-anio_cursada")
        if not hcs:
            return []
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__in=hcs[:1]).select_related(
            "bloque", "horario_catedra"
        )
        hs: list[Horario] = []
        for d in detalles:
            b = d.bloque
            hs.append(
                Horario(
                    dia=b.get_dia_display(),
                    desde=str(b.hora_desde)[:5],
                    hasta=str(b.hora_hasta)[:5],
                )
            )
        return sorted(hs, key=lambda x: (x.dia, x.desde))

    def correlativas_ids(m: Materia, tipo: str, estudiante: Estudiante | None = None) -> list[int]:
        return list(
            _correlatividades_qs(m, tipo, estudiante).values_list("materia_correlativa_id", flat=True)
        )

    materias = []
    for m in plan.materias.all().order_by("anio_cursada", "nombre"):
        materias.append(
            MateriaPlan(
                id=m.id,
                nombre=m.nombre,
                anio=m.anio_cursada,
                cuatrimestre=map_cuat(m.regimen),
                horarios=horarios_para(m),
                correlativas_regular=correlativas_ids(m, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR),
                correlativas_aprob=correlativas_ids(m, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR),
                profesorado=plan_profesorado.nombre,
                profesorado_id=plan_profesorado.id,
                plan_id=plan.id,
            )
        )
    return materias


@estudiantes_router.get(
    "/horarios",
    response={
        200: list[HorarioTabla],
        400: ApiResponse,
        403: ApiResponse,
        404: ApiResponse,
    },
)
def horarios_profesorado(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    turno_id: int | None = None,
    anio_plan: int | None = None,
    cuatrimestre: str | None = None,
    dni: str | None = None,
):
    est = _resolve_estudiante(request, dni)
    if dni and not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante indicado.")
    carreras_est = list(est.carreras.all()) if est else []

    profesorado: Profesorado | None = None
    if profesorado_id is not None:
        profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not profesorado:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado solicitado.")
        if est and profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no pertenece a ese profesorado.")
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para continuar.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            profesorado = carreras_est[0]
        else:
            return 400, ApiResponse(ok=False, message="Debe indicar un profesorado.")

    plan: PlanDeEstudio | None = None
    planes_qs = (
        PlanDeEstudio.objects.select_related("profesorado")
        .filter(profesorado=profesorado)
        .order_by("-vigente", "-anio_inicio", "resolucion")
    )
    if plan_id is not None:
        plan = planes_qs.filter(id=plan_id).first()
        if not plan:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
    else:
        planes_list = list(planes_qs)
        if not planes_list:
            return 404, ApiResponse(ok=False, message="El profesorado no tiene planes asociados.")
        if len(planes_list) > 1:
            return 400, ApiResponse(
                ok=False,
                message="Debe seleccionar un plan de estudio para continuar.",
                data={
                    "planes": [
                        {
                            "id": p.id,
                            "resolucion": p.resolucion or "",
                            "anio_inicio": getattr(p, "anio_inicio", None),
                            "vigente": bool(getattr(p, "vigente", False)),
                        }
                        for p in planes_list
                    ]
                },
            )
        plan = planes_list[0]

    horarios_qs = (
        HorarioCatedra.objects.filter(espacio__plan_de_estudio=plan)
        .select_related("espacio", "espacio__plan_de_estudio", "turno")
        .prefetch_related("detalles__bloque", "comisiones__docente")
    )

    if turno_id is not None:
        horarios_qs = horarios_qs.filter(turno_id=turno_id)
    if anio_plan is not None:
        horarios_qs = horarios_qs.filter(anio_cursada=anio_plan)
    if cuatrimestre:
        valor = cuatrimestre.upper()
        if valor == "ANUAL":
            horarios_qs = horarios_qs.filter(Q(cuatrimestre__isnull=True) | Q(cuatrimestre=Materia.TipoCursada.ANUAL))
        elif valor == "1C":
            horarios_qs = horarios_qs.filter(cuatrimestre=Materia.TipoCursada.PRIMER_CUATRIMESTRE)
        elif valor == "2C":
            horarios_qs = horarios_qs.filter(cuatrimestre=Materia.TipoCursada.SEGUNDO_CUATRIMESTRE)

    tablas = _construir_tablas_horario(profesorado, plan, list(horarios_qs))
    return tablas
