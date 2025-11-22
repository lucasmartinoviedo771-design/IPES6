from __future__ import annotations

from datetime import datetime

from django.utils import timezone

from apps.common.api_schemas import ApiResponse
from core.permissions import ensure_roles
from core.models import (
    Correlatividad,
    HorarioCatedraDetalle,
    InscripcionMateriaAlumno,
    Materia,
    Regularidad,
    VentanaHabilitacion,
)

from ..schemas import (
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
from .router import alumnos_router


def _comision_to_resumen(comision):
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


@alumnos_router.post(
    "/inscripcion-materia",
    response={200: InscripcionMateriaOut, 400: ApiResponse, 404: ApiResponse},
)
def inscripcion_materia(request, payload: InscripcionMateriaIn):
    _ensure_estudiante_access(request, getattr(payload, "dni", None))
    est = _resolve_estudiante(request, getattr(payload, "dni", None))
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante (inicie sesión)")
    mat = Materia.objects.filter(id=payload.materia_id).first()
    if not mat:
        return 404, ApiResponse(ok=False, message="Materia no encontrada")

    anio_actual = datetime.now().year

    # 2. Validar Ventana de Inscripción Activa
    hoy = timezone.now().date()
    ventana = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy
    ).first()

    if not ventana:
        return 400, ApiResponse(ok=False, message="No hay un periodo de inscripción a materias activo en este momento.")

    # 3. Validar Periodo (Cuatrimestre)
    if ventana.periodo:
        allowed_regimens = []
        if ventana.periodo == '1C_ANUALES':
            allowed_regimens = [Materia.TipoCursada.ANUAL, Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == '1C':
            allowed_regimens = [Materia.TipoCursada.PRIMER_CUATRIMESTRE]
        elif ventana.periodo == '2C':
            allowed_regimens = [Materia.TipoCursada.SEGUNDO_CUATRIMESTRE]
        
        if mat.regimen not in allowed_regimens:
             return 400, ApiResponse(ok=False, message=f"La materia {mat.nombre} no corresponde al periodo de inscripción habilitado.")

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

    def ultima_situacion(mid: int):
        r = Regularidad.objects.filter(estudiante=est, materia_id=mid).order_by("-fecha_cierre").first()
        return r.situacion if r else None

    faltan = []
    for mid in req_reg:
        s = ultima_situacion(mid)
        if s not in (
            Regularidad.Situacion.REGULAR,
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Regular en {m.nombre if m else mid}")
    for mid in req_apr:
        s = ultima_situacion(mid)
        if s not in (
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Aprobada {m.nombre if m else mid}")
    if faltan:
        return 400, ApiResponse(
            ok=False,
            message="Correlatividades no cumplidas para cursar",
            data={"faltantes": faltan},
        )

    detalles_cand = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "bloque").filter(
        horario_catedra__espacio=mat
    )
    cand = [
        (
            d.horario_catedra.turno_id,
            d.bloque.dia,
            d.bloque.hora_desde,
            d.bloque.hora_hasta,
        )
        for d in detalles_cand
    ]
    if cand:
        actuales = InscripcionMateriaAlumno.objects.filter(estudiante=est, anio=anio_actual)
        if actuales.exists():
            det_act = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "bloque").filter(
                horario_catedra__espacio_id__in=list(actuales.values_list("materia_id", flat=True))
            )
            for d in det_act:
                for t, dia, desde, hasta in cand:
                    if (
                        t == d.horario_catedra.turno_id
                        and dia == d.bloque.dia
                        and not (hasta <= d.bloque.hora_desde or desde >= d.bloque.hora_hasta)
                    ):
                        return 400, ApiResponse(
                            ok=False,
                            message="Superposición horaria con otra materia inscripta",
                        )

    InscripcionMateriaAlumno.objects.get_or_create(estudiante=est, materia=mat, anio=anio_actual)
    return {"message": "Inscripción a materia registrada"}


@alumnos_router.get(
    "/materias-inscriptas",
    response={200: list[MateriaInscriptaItem], 400: ApiResponse},
)
def materias_inscriptas(request, anio: int | None = None, dni: str | None = None):
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    qs = (
        InscripcionMateriaAlumno.objects.filter(estudiante=est)
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
                fecha_creacion=(ins.created_at or timezone.now()).isoformat(),
                fecha_actualizacion=(ins.updated_at or ins.created_at or timezone.now()).isoformat(),
            )
        )
    return items


@alumnos_router.post(
    "/cancelar-inscripcion",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def cancelar_inscripcion_materia(request, inscripcion_id: int, payload: CancelarInscripcionIn):
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    inscripcion = (
        InscripcionMateriaAlumno.objects.filter(id=inscripcion_id, estudiante=est)
        .select_related("materia", "comision")
        .first()
    )
    if not inscripcion:
        return 404, ApiResponse(ok=False, message="Inscripción no encontrada.")

    if inscripcion.estado not in (
        InscripcionMateriaAlumno.Estado.CONFIRMADA,
        InscripcionMateriaAlumno.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(
            ok=False,
            message="Solo se pueden cancelar inscripciones confirmadas o pendientes.",
        )

    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    inscripcion.estado = InscripcionMateriaAlumno.Estado.ANULADA
    inscripcion.comision = None
    inscripcion.comision_solicitada = None
    inscripcion.save(update_fields=["estado", "comision", "comision_solicitada", "updated_at"])

    return ApiResponse(ok=True, message="Inscripción cancelada exitosamente.")


@alumnos_router.post("/cambio-comision", response=CambioComisionOut)
def cambio_comision(request, payload: CambioComisionIn):
    return {"message": "Solicitud de cambio de comisión recibida."}
