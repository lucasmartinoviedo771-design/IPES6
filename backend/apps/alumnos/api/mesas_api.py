from __future__ import annotations

from datetime import date

from django.contrib.auth.models import AnonymousUser

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    Correlatividad,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    Preinscripcion,
    Profesorado,
    Regularidad,
)

from ..schemas import InscripcionMesaIn, InscripcionMesaOut, MesaExamenIn, MesaExamenOut
from .helpers import (
    _correlatividades_qs,
    _ensure_estudiante_access,
    _listar_carreras_detalle,
    _resolve_estudiante,
)
from .router import alumnos_router

MESA_TIPOS_ORDINARIOS = (MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL)


@alumnos_router.get(
    "/mesas",
    response={200: list[dict], 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_mesas_alumno(
    request,
    tipo: str | None = None,
    ventana_id: int | None = None,
    dni: str | None = None,
    solo_rendibles: bool = False,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
):
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    carreras_est = list(est.carreras.all()) if est else []

    plan_obj: PlanDeEstudio | None = None
    plan_profesorado: Profesorado | None = None

    if plan_id is not None:
        plan_obj = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
        if not plan_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
        plan_profesorado = plan_obj.profesorado
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
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para listar mesas.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            plan_profesorado = carreras_est[0]

    qs = MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").all()

    if tipo:
        qs = qs.filter(tipo=tipo)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if plan_obj:
        qs = qs.filter(materia__plan_de_estudio=plan_obj)
    elif plan_profesorado:
        qs = qs.filter(materia__plan_de_estudio__profesorado=plan_profesorado)

    out = []
    estudiante_para_rendir = est if solo_rendibles else None
    if solo_rendibles and not estudiante_para_rendir:
        if dni:
            estudiante_para_rendir = Estudiante.objects.filter(dni=dni).first()
        elif not isinstance(request.user, AnonymousUser):
            estudiante_para_rendir = getattr(request.user, "estudiante", None)

    for m in qs.order_by("fecha", "hora_desde"):
        req_aprob = list(
            _correlatividades_qs(
                m.materia,
                Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
                estudiante_para_rendir,
            ).values_list("materia_correlativa_id", flat=True)
        )
        row = {
            "id": m.id,
            "materia": {
                "id": m.materia_id,
                "nombre": m.materia.nombre,
                "anio": m.materia.anio_cursada,
            },
            "tipo": m.tipo,
            "codigo": m.codigo,
            "fecha": m.fecha.isoformat(),
            "hora_desde": str(m.hora_desde) if m.hora_desde else None,
            "hora_hasta": str(m.hora_hasta) if m.hora_hasta else None,
            "aula": m.aula,
            "cupo": m.cupo,
            "correlativas_aprob": req_aprob,
            "plan_id": m.materia.plan_de_estudio_id if m.materia_id else None,
            "profesorado_id": (
                m.materia.plan_de_estudio.profesorado_id if m.materia_id and m.materia.plan_de_estudio_id else None
            ),
        }
        if not solo_rendibles or not estudiante_para_rendir:
            out.append(row)
            continue
        if m.tipo in MESA_TIPOS_ORDINARIOS:
            legajo_ok = estudiante_para_rendir.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
            if not legajo_ok:
                prof = m.materia.plan_de_estudio.profesorado if m.materia and m.materia.plan_de_estudio else None
                pre = (
                    (
                        Preinscripcion.objects.filter(alumno=estudiante_para_rendir, carrera=prof)
                        .order_by("-anio", "-id")
                        .first()
                    )
                    if prof
                    else None
                )
                cl = getattr(pre, "checklist", None) if pre else None
                if not (cl and cl.certificado_titulo_en_tramite):
                    continue
            reg = (
                Regularidad.objects.filter(estudiante=estudiante_para_rendir, materia=m.materia)
                .order_by("-fecha_cierre")
                .first()
            )
            if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                continue

            def _add_years(d: date, years: int) -> date:
                try:
                    return d.replace(year=d.year + years)
                except ValueError:
                    return d.replace(month=2, day=28, year=d.year + years)

            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = (
                MesaExamen.objects.filter(materia=m.materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years)
                .order_by("fecha")
                .values_list("fecha", flat=True)
                .first()
            )
            allowed_until = next_call or two_years
            if m.fecha > allowed_until:
                continue
            intentos = InscripcionMesa.objects.filter(
                estudiante=estudiante_para_rendir,
                estado=InscripcionMesa.Estado.INSCRIPTO,
                mesa__materia=m.materia,
                mesa__tipo__in=MESA_TIPOS_ORDINARIOS,
                mesa__fecha__gte=reg.fecha_cierre,
                mesa__fecha__lte=allowed_until,
            ).count()
            if intentos >= 3:
                continue
        out.append(row)
    return out


@alumnos_router.post("/inscribir_mesa", response=InscripcionMesaOut, auth=JWTAuth())
def inscribir_mesa(request, payload: InscripcionMesaIn):
    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}
    mesa = MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").filter(id=payload.mesa_id).first()
    if not mesa:
        return 404, {"message": "Mesa no encontrada"}

    if mesa.tipo in MESA_TIPOS_ORDINARIOS:
        legajo_ok = est.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
        if not legajo_ok:
            prof = mesa.materia.plan_de_estudio.profesorado if mesa.materia and mesa.materia.plan_de_estudio else None
            pre = (
                (
                    Preinscripcion.objects.filter(alumno=est, carrera=prof)
                    .order_by("-anio", "-id")
                    .first()
                )
                if prof
                else None
            )
            cl = getattr(pre, "checklist", None) if pre else None
            if not (cl and cl.certificado_titulo_en_tramite):
                return 400, {
                    "message": "Legajo condicional/pending: no puede rendir Final. Debe tener legajo completo.",
                }

        reg = Regularidad.objects.filter(estudiante=est, materia=mesa.materia).order_by("-fecha_cierre").first()
        if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
            if reg and reg.situacion in (
                Regularidad.Situacion.PROMOCIONADO,
                Regularidad.Situacion.APROBADO,
            ):
                return 400, {"message": "Materia ya aprobada/promocionada: no requiere final."}
            return 400, {"message": "No posee regularidad vigente en la materia."}

        def _add_years(d: date, years: int) -> date:
            try:
                return d.replace(year=d.year + years)
            except ValueError:
                return d.replace(month=2, day=28, year=d.year + years)

        two_years = _add_years(reg.fecha_cierre, 2)
        next_call = (
            MesaExamen.objects.filter(materia=mesa.materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years)
            .order_by("fecha")
            .values_list("fecha", flat=True)
            .first()
        )
        allowed_until = next_call or two_years
        if mesa.fecha > allowed_until:
            return 400, {"message": "Venció la vigencia de regularidad (2 años y un llamado). Debe recursar."}

        intentos = InscripcionMesa.objects.filter(
            estudiante=est,
            estado=InscripcionMesa.Estado.INSCRIPTO,
            mesa__materia=mesa.materia,
            mesa__tipo__in=MESA_TIPOS_ORDINARIOS,
            mesa__fecha__gte=reg.fecha_cierre,
            mesa__fecha__lte=allowed_until,
        ).count()
        if intentos >= 3:
            return 400, {"message": "Ya usaste 3 llamados de final dentro de la vigencia. Debe recursar."}

        req_ids = list(
            _correlatividades_qs(
                mesa.materia,
                Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
                est,
            ).values_list("materia_correlativa_id", flat=True)
        )
        if req_ids:
            faltan = []
            regs = Regularidad.objects.filter(estudiante=est, materia_id__in=req_ids).order_by("materia_id", "-fecha_cierre")
            latest: dict[int, Regularidad] = {}
            for r in regs:
                latest.setdefault(r.materia_id, r)
            for mid in req_ids:
                r = latest.get(mid)
                if not r or r.situacion not in (
                    Regularidad.Situacion.APROBADO,
                    Regularidad.Situacion.PROMOCIONADO,
                ):
                    m = Materia.objects.filter(id=mid).first()
                    faltan.append(m.nombre if m else f"Materia {mid}")
            if faltan:
                return 400, {
                    "message": "Correlativas sin aprobar para rendir final",
                    "faltantes": faltan,
                }

    ins, created = InscripcionMesa.objects.get_or_create(mesa=mesa, estudiante=est)
    if not created and ins.estado == InscripcionMesa.Estado.INSCRIPTO:
        return 400, {"message": "Ya estabas inscripto"}
    ins.estado = InscripcionMesa.Estado.INSCRIPTO
    ins.save()
    return {"message": "Inscripción registrada"}


@alumnos_router.post("/mesa-examen", response=MesaExamenOut, auth=JWTAuth())
def mesa_examen(request, payload: MesaExamenIn):
    return {"message": "Solicitud de mesa de examen recibida."}
