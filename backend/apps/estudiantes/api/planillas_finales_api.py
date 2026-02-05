from __future__ import annotations

from django.utils import timezone

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import InscripcionMesa, MesaExamen

from ..schemas import (
    ConstanciaExamenItem,
    MesaPlanillaOut,
    MesaPlanillaUpdateIn,
    MesaPlanillaCierreIn,
)
from .helpers import (
    _docente_full_name,
    _format_user_display,
    _resolve_estudiante,
    _user_can_manage_mesa_planilla,
    _user_can_override_planilla_lock,
)
from .router import estudiantes_router


def _mesa_planilla_condiciones() -> list[dict]:
    return [
        {
            "value": InscripcionMesa.Condicion.APROBADO,
            "label": "Aprobado",
            "cuenta_para_intentos": True,
        },
        {
            "value": InscripcionMesa.Condicion.DESAPROBADO,
            "label": "Desaprobado",
            "cuenta_para_intentos": True,
        },
        {
            "value": InscripcionMesa.Condicion.AUSENTE,
            "label": "Ausente",
            "cuenta_para_intentos": False,
        },
        {
            "value": InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO,
            "label": "Ausente justificado",
            "cuenta_para_intentos": False,
        },
    ]


@estudiantes_router.get(
    "/mesas/{mesa_id}/planilla",
    response={200: MesaPlanillaOut, 404: ApiResponse},
    auth=JWTAuth(),
)
def obtener_mesa_planilla(request, mesa_id: int):
    mesa = (
        MesaExamen.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "docente_presidente",
            "docente_vocal1",
            "docente_vocal2",
        )
        .filter(id=mesa_id)
        .first()
    )
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")
    if not _user_can_manage_mesa_planilla(request, mesa):
        return 403, ApiResponse(
            ok=False,
            message="Solo los docentes del tribunal o el personal autorizado pueden acceder a esta planilla.",
        )

    inscripciones = (
        InscripcionMesa.objects.filter(mesa_id=mesa_id)
        .select_related("estudiante__user")
        .order_by("estudiante__user__last_name", "estudiante__user__first_name", "estudiante__dni")
    )
    estudiantes = []
    for insc in inscripciones:
        estudiante = insc.estudiante
        nombre = estudiante.user.get_full_name().strip()
        if not nombre:
            nombre = f"{estudiante.user.last_name} {estudiante.user.first_name}".strip() or estudiante.dni
        estudiantes.append(
            {
                "inscripcion_id": insc.id,
                "estudiante_id": estudiante.id,
                "dni": estudiante.dni,
                "apellido_nombre": nombre,
                "condicion": insc.condicion,
                "condicion_display": insc.get_condicion_display() if insc.condicion else None,
                "nota": float(insc.nota) if insc.nota is not None else None,
                "folio": insc.folio,
                "libro": insc.libro,
                "fecha_resultado": insc.fecha_resultado.isoformat() if insc.fecha_resultado else None,
                "cuenta_para_intentos": insc.cuenta_para_intentos,
                "observaciones": insc.observaciones,
            }
        )

    materia = mesa.materia
    plan = materia.plan_de_estudio if materia else None
    profesorado = plan.profesorado if plan else None
    hora_desde = mesa.hora_desde.strftime("%H:%M") if mesa.hora_desde else None
    hora_hasta = mesa.hora_hasta.strftime("%H:%M") if mesa.hora_hasta else None

    esta_cerrada = bool(mesa.planilla_cerrada_en)
    can_override = _user_can_override_planilla_lock(request.user)

    return MesaPlanillaOut(
        mesa_id=mesa.id,
        materia_id=mesa.materia_id,
        materia_nombre=materia.nombre if materia else "Materia",
        materia_anio=materia.anio_cursada if materia else None,
        regimen=materia.regimen if materia else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        plan_id=plan.id if plan else None,
        plan_resolucion=plan.resolucion if plan else None,
        tipo=mesa.tipo,
        modalidad=mesa.modalidad,
        fecha=mesa.fecha.isoformat(),
        hora_desde=hora_desde,
        hora_hasta=hora_hasta,
        mesa_codigo=mesa.codigo,
        tribunal_presidente=_docente_full_name(mesa.docente_presidente),
        tribunal_vocal1=_docente_full_name(mesa.docente_vocal1),
        tribunal_vocal2=_docente_full_name(mesa.docente_vocal2),
        condiciones=_mesa_planilla_condiciones(),
        estudiantes=estudiantes,
        esta_cerrada=esta_cerrada,
        cerrada_en=mesa.planilla_cerrada_en.isoformat() if mesa.planilla_cerrada_en else None,
        cerrada_por=_format_user_display(mesa.planilla_cerrada_por),
        puede_editar=(not esta_cerrada) or can_override,
        puede_cerrar=not esta_cerrada,
        puede_reabrir=esta_cerrada and can_override,
    )


@estudiantes_router.post(
    "/mesas/{mesa_id}/planilla",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def actualizar_mesa_planilla(request, mesa_id: int, payload: MesaPlanillaUpdateIn):
    mesa = MesaExamen.objects.filter(id=mesa_id).first()
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")
    if not _user_can_manage_mesa_planilla(request, mesa):
        return 403, ApiResponse(
            ok=False,
            message="Solo los docentes del tribunal o el personal autorizado pueden modificar esta planilla.",
        )
    if mesa.planilla_cerrada_en and not _user_can_override_planilla_lock(request.user):
        return 400, ApiResponse(ok=False, message="La planilla ya está cerrada y no se puede editar.")

    resultados = payload.estudiantes or []
    update_fields = [
        "condicion",
        "nota",
        "folio",
        "libro",
        "fecha_resultado",
        "cuenta_para_intentos",
        "observaciones",
        "updated_at",
    ]
    updated = 0
    for item in resultados:
        insc = (
            InscripcionMesa.objects.filter(id=item.inscripcion_id, mesa_id=mesa_id)
            .select_related("estudiante__user")
            .first()
        )
        if not insc:
            continue
        if item.condicion:
            insc.condicion = item.condicion
        if item.nota is not None:
            insc.nota = item.nota
        if item.folio is not None:
            insc.folio = item.folio
        if item.libro is not None:
            insc.libro = item.libro
        if item.fecha_resultado:
            insc.fecha_resultado = item.fecha_resultado
        if item.cuenta_para_intentos is not None:
            insc.cuenta_para_intentos = item.cuenta_para_intentos
        if item.observaciones is not None:
            insc.observaciones = item.observaciones
        insc.save(update_fields=update_fields)
        updated += 1

    # mesa.planilla_actualizada_en = timezone.now()
    # mesa.save(update_fields=["planilla_actualizada_en", "planilla_actualizada_por"])

    return ApiResponse(ok=True, message=f"{updated} registros actualizados.")


@estudiantes_router.post(
    "/mesas/{mesa_id}/cierre",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def gestionar_mesa_planilla_cierre(request, mesa_id: int, payload: MesaPlanillaCierreIn):
    mesa = (
        MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado", "planilla_cerrada_por")
        .filter(id=mesa_id)
        .first()
    )
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")
    if not _user_can_manage_mesa_planilla(request, mesa):
        return 403, ApiResponse(ok=False, message="No está autorizado para cerrar esta planilla.")

    accion = payload.accion
    if accion == "cerrar":
        if mesa.planilla_cerrada_en:
            return 400, ApiResponse(ok=False, message="La planilla ya está cerrada.")
        mesa.planilla_cerrada_en = timezone.now()
        mesa.planilla_cerrada_por = request.user if request.user.is_authenticated else None
        mesa.save(update_fields=["planilla_cerrada_en", "planilla_cerrada_por"])
        return ApiResponse(ok=True, message="Planilla cerrada.")

    if accion == "reabrir":
        if not _user_can_override_planilla_lock(request.user):
            return 403, ApiResponse(ok=False, message="Solo Secretaría/Admin pueden reabrir planillas.")
        mesa.planilla_cerrada_en = None
        mesa.planilla_cerrada_por = None
        mesa.save(update_fields=["planilla_cerrada_en", "planilla_cerrada_por"])
        return ApiResponse(ok=True, message="Planilla reabierta.")

    return 400, ApiResponse(ok=False, message="Acción de cierre no reconocida.")


@estudiantes_router.get(
    "/constancias-examen",
    response={200: list[ConstanciaExamenItem], 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_constancias_examen(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")

    inscripciones = (
        InscripcionMesa.objects.select_related(
            "mesa__materia__plan_de_estudio__profesorado",
            "mesa",
            "mesa__materia",
        )
        .filter(estudiante=est, estado=InscripcionMesa.Estado.INSCRIPTO)
    )

    # Si es un estudiante (y no staff), restringir a mesas de ventanas recientes
    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    from core.models import VentanaHabilitacion
    from django.utils import timezone

    es_staff = _user_has_roles(request.user, ADMIN_ALLOWED_ROLES)
    if not es_staff:
        today = timezone.now().date()
        exam_windows = VentanaHabilitacion.objects.filter(
            tipo__in=[
                VentanaHabilitacion.Tipo.MESAS_FINALES,
                VentanaHabilitacion.Tipo.MESAS_EXTRA,
                VentanaHabilitacion.Tipo.INSCRIPCION,
            ]
        ).order_by("-hasta")

        latest_window = exam_windows.first()
        if latest_window:
            # Permitimos la última ventana (haya cerrado o no) y cualquier otra activa actualmente
            active_ids = list(
                exam_windows.filter(activo=True, desde__lte=today, hasta__gte=today).values_list(
                    "id", flat=True
                )
            )
            relevant_ids = set(active_ids + [latest_window.id])
            inscripciones = inscripciones.filter(mesa__ventana_id__in=relevant_ids)

    inscripciones = inscripciones.order_by("-mesa__fecha")

    items: list[ConstanciaExamenItem] = []
    for insc in inscripciones:
        if not insc.condicion:
            continue
        if insc.condicion in (
            InscripcionMesa.Condicion.AUSENTE,
            InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO,
        ):
            continue
        if not insc.fecha_resultado:
            continue
        mesa = insc.mesa
        if not mesa:
            continue
        materia = mesa.materia
        plan = materia.plan_de_estudio if materia else None
        profesorado = plan.profesorado if plan else None
        materia_anio = getattr(materia, "anio_cursada", None) if materia else None

        presidente = (
            f"{mesa.docente_presidente.apellido}, {mesa.docente_presidente.nombre}"
            if mesa.docente_presidente
            else None
        )
        vocal1 = (
            f"{mesa.docente_vocal1.apellido}, {mesa.docente_vocal1.nombre}" if mesa.docente_vocal1 else None
        )
        vocal2 = (
            f"{mesa.docente_vocal2.apellido}, {mesa.docente_vocal2.nombre}" if mesa.docente_vocal2 else None
        )

        items.append(
            ConstanciaExamenItem(
                inscripcion_id=insc.id,
                estudiante=est.user.get_full_name() or est.dni,
                dni=est.dni,
                materia=materia.nombre if materia else "Materia",
                materia_anio=materia_anio,
                profesorado=profesorado.nombre if profesorado else None,
                profesorado_id=profesorado.id if profesorado else None,
                plan_resolucion=plan.resolucion if plan else None,
                mesa_codigo=mesa.codigo,
                mesa_fecha=mesa.fecha.isoformat(),
                mesa_hora_desde=str(mesa.hora_desde)[:5] if mesa.hora_desde else None,
                mesa_hora_hasta=_calc_hora_hasta(insc, mesa),
                mesa_tipo=mesa.get_tipo_display(),
                mesa_modalidad=mesa.get_modalidad_display(),
                condicion=insc.condicion,
                condicion_display=insc.get_condicion_display() or "",
                nota=str(insc.nota) if insc.nota is not None else None,
                folio=insc.folio or None,
                libro=insc.libro or None,
                tribunal_presidente=presidente,
                tribunal_vocal1=vocal1,
                tribunal_vocal2=vocal2,
            )
        )

    return items


def _calc_hora_hasta(insc, mesa) -> str | None:
    from datetime import datetime, timedelta, date

    # 1. Si la mesa estÃ¡ cerrada, usar esa hora
    if mesa.planilla_cerrada_en:
        return mesa.planilla_cerrada_en.strftime("%H:%M")

    # 2. Si es primera carga (proxy: sin ventana o sin acta digital cerrada) 
    # y tiene hora_desde pero no hora_hasta definida
    if not mesa.ventana_id and not mesa.hora_hasta:
        if mesa.hora_desde:
            try:
                # Sumar 4 horas
                dt = datetime.combine(date.today(), mesa.hora_desde) + timedelta(hours=4)
                return dt.strftime("%H:%M")
            except Exception:
                pass

    # 3. Si hay una hora_hasta explÃ­cita en la mesa, usarla
    if mesa.hora_hasta:
        return str(mesa.hora_hasta)[:5]

    # 4. Fallback: hora de carga de la nota (usamos updated_at)
    if insc.updated_at:
        # Solo si es distinta a la de creacion o si consideramos que ya tiene nota
        if insc.condicion:
            return insc.updated_at.strftime("%H:%M")

    return None
