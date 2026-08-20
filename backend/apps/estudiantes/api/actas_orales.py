from datetime import date

from django.http import HttpResponse
from django.template.loader import render_to_string
from ninja import Body, Router, Schema
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from apps.estudiantes.schemas import (
    ActaOralListItemSchema,
    ActaOralSchema,
)
from core.auth_ninja import JWTAuth
from core.models import InscripcionMesa, MesaActaOral, MesaExamen

# ==============================================================================
# LOGIC & ENDPOINTS
# ==============================================================================

router = Router(tags=["carga_notas"])


def _get_inscripcion_mesa_or_404(mesa_id: int, inscripcion_id: int) -> InscripcionMesa:
    inscripcion = (
        InscripcionMesa.objects.select_related("mesa", "estudiante").filter(id=inscripcion_id, mesa_id=mesa_id).first()
    )
    if not inscripcion:
        raise HttpError(404, "La inscripcion indicada no pertenece a la mesa seleccionada.")
    return inscripcion


from datetime import timedelta
from django.utils import timezone

from apps.estudiantes.schemas import (
    ActaOralListItemSchema,
    ActaOralPendienteConformidadSchema,
    ActaOralSchema,
    ResponderConformidadPayload,
)


@router.get(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ActaOralSchema, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def obtener_acta_oral(request, mesa_id: int, inscripcion_id: int):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    acta: MesaActaOral | None = getattr(inscripcion, "acta_oral", None)
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta oral no registrada para el estudiante.")

    return ActaOralSchema(
        acta_numero=acta.acta_numero or None,
        folio_numero=acta.folio_numero or None,
        fecha=acta.fecha,
        curso=acta.curso or None,
        nota_final=acta.nota_final or None,
        observaciones=acta.observaciones or None,
        temas_estudiante=acta.temas_alumno or [],
        temas_docente=acta.temas_docente or [],
        estado_conformidad=acta.estado_conformidad,
        notificado_en=acta.notificado_en.isoformat() if acta.notificado_en else None,
        respondido_en=acta.respondido_en.isoformat() if acta.respondido_en else None,
        observaciones_estudiante=acta.observaciones_estudiante or None,
    )


@router.post(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def guardar_acta_oral(request, mesa_id: int, inscripcion_id: int, payload: ActaOralSchema = Body(...)):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    if inscripcion.estudiante.dni == getattr(request.user, "username", ""):
        return 403, ApiResponse(ok=False, message="No tienes permitido cargar o modificar tus propias actas orales.")

    # Restringir carga de actas orales exclusivamente al Docente Presidente de la mesa (o administradores / secretaría)
    from core.permissions import can, get_user_roles
    from apps.estudiantes.api.helpers.user_utils import _resolve_docente_from_user

    es_admin_o_secretaria = can(request.user, "editar_estudiantes") or can(request.user, "gestionar_staff")
    if not es_admin_o_secretaria:
        if "docente" in get_user_roles(request.user):
            docente_actual = _resolve_docente_from_user(request.user)
            if not docente_actual or inscripcion.mesa.docente_presidente_id != docente_actual.id:
                return 403, ApiResponse(
                    ok=False,
                    message="Solo el Docente Presidente del tribunal de la mesa tiene autorización para cargar y guardar el acta oral.",
                )
        else:
            return 403, ApiResponse(ok=False, message="No tienes permisos para cargar actas orales.")

    temas_estudiante = [
        {"tema": item.tema, "score": item.score} for item in (payload.temas_estudiante or []) if item.tema
    ]
    temas_docente = [{"tema": item.tema, "score": item.score} for item in (payload.temas_docente or []) if item.tema]

    acta_existente = MesaActaOral.objects.filter(inscripcion=inscripcion).first()
    ahora = timezone.now()

    nueva_nota = payload.nota_final or ""
    nuevas_obs = payload.observaciones or ""

    if not acta_existente:
        # Creación inicial
        MesaActaOral.objects.create(
            inscripcion=inscripcion,
            mesa=inscripcion.mesa,
            acta_numero=payload.acta_numero or "",
            folio_numero=payload.folio_numero or "",
            fecha=payload.fecha,
            curso=payload.curso or "",
            nota_final=nueva_nota,
            observaciones=nuevas_obs,
            temas_alumno=temas_estudiante,
            temas_docente=temas_docente,
            estado_conformidad=MesaActaOral.EstadoConformidad.PENDIENTE,
            notificado_en=ahora,
            respondido_en=None,
            observaciones_estudiante="",
        )
    else:
        # Edición: Si el acta ya fue cerrada (CON, DIS, TIM), un docente no puede modificarla
        # solo Secretaría / Administración puede autorizar o realizar modificaciones sobre actas cerradas
        acta_esta_cerrada = acta_existente.estado_conformidad != MesaActaOral.EstadoConformidad.PENDIENTE
        if acta_esta_cerrada and not es_admin_o_secretaria:
            return 403, ApiResponse(
                ok=False,
                message="El acta oral ya se encuentra cerrada y asentada. No puede modificarse sin autorización expresa de Secretaría.",
            )

        # Edición: verificar si cambió contenido sustancial (nota, observaciones o temas_docente)
        cambio_sustancial = (
            (acta_existente.nota_final != nueva_nota)
            or (acta_existente.observaciones != nuevas_obs)
            or (acta_existente.temas_docente != temas_docente)
        )

        update_defaults = {
            "mesa": inscripcion.mesa,
            "acta_numero": payload.acta_numero or "",
            "folio_numero": payload.folio_numero or "",
            "fecha": payload.fecha,
            "curso": payload.curso or "",
            "nota_final": nueva_nota,
            "observaciones": nuevas_obs,
            "temas_alumno": temas_estudiante,
            "temas_docente": temas_docente,
        }

        # Si Secretaría/Admin modifica un acta cerrada con cambios sustanciales, se reabre la conformidad
        if cambio_sustancial or not acta_existente.notificado_en:
            update_defaults["estado_conformidad"] = MesaActaOral.EstadoConformidad.PENDIENTE
            update_defaults["notificado_en"] = ahora
            update_defaults["respondido_en"] = None
            update_defaults["observaciones_estudiante"] = ""

        for key, val in update_defaults.items():
            setattr(acta_existente, key, val)
        acta_existente.save()

    return ApiResponse(ok=True, message="Acta oral guardada correctamente.")


@router.get(
    "/conformidad/pendientes",
    response={200: list[ActaOralPendienteConformidadSchema], 400: ApiResponse},
    auth=JWTAuth(),
)
def listar_actas_pendientes_conformidad(request):
    """
    Lista las actas orales pendientes de conformidad para el estudiante autenticado.
    Aplica cierre lazy de aquellas que hayan superado los 10 minutos.
    """
    user = request.user
    dni = getattr(user, "username", "")
    if not dni:
        return []

    ahora = timezone.now()
    diez_minutos = timedelta(minutes=10)

    actas_pendientes = (
        MesaActaOral.objects.filter(
            inscripcion__estudiante__persona__dni=dni,
            estado_conformidad=MesaActaOral.EstadoConformidad.PENDIENTE,
        )
        .select_related(
            "mesa__materia__plan_de_estudio__profesorado",
            "mesa__docente_presidente__persona",
            "mesa__docente_vocal1__persona",
            "mesa__docente_vocal2__persona",
            "inscripcion",
        )
        .order_by("notificado_en")
    )

    resultados: list[ActaOralPendienteConformidadSchema] = []

    for acta in actas_pendientes:
        if not acta.notificado_en:
            # Fallback en caso excepcional
            acta.notificado_en = ahora
            acta.save(update_fields=["notificado_en"])

        vencimiento = acta.notificado_en + diez_minutos
        segundos_restantes = int((vencimiento - ahora).total_seconds())

        if segundos_restantes <= 0:
            # Cierre lazy automático por timeout
            acta.estado_conformidad = MesaActaOral.EstadoConformidad.TIMEOUT
            acta.respondido_en = vencimiento
            acta.save(update_fields=["estado_conformidad", "respondido_en", "updated_at"])
            continue

        mesa = acta.mesa
        materia = mesa.materia
        profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio else None

        tribunal = []
        for doc in [mesa.docente_presidente, mesa.docente_vocal1, mesa.docente_vocal2]:
            if doc and doc.persona:
                tribunal.append(f"{doc.persona.apellido}, {doc.persona.nombre}")

        resultados.append(
            ActaOralPendienteConformidadSchema(
                acta_id=acta.id,
                inscripcion_id=acta.inscripcion_id,
                mesa_id=acta.mesa_id,
                materia_nombre=materia.nombre if materia else "Materia",
                profesorado_nombre=profesorado.nombre if profesorado else "",
                fecha=acta.fecha,
                curso=acta.curso or mesa.codigo or None,
                tribunal=tribunal,
                nota_final=acta.nota_final or None,
                observaciones_docente=acta.observaciones or None,
                temas_estudiante=acta.temas_alumno or [],
                temas_docente=acta.temas_docente or [],
                notificado_en=acta.notificado_en.isoformat(),
                segundos_restantes=segundos_restantes,
            )
        )

    return resultados


@router.post(
    "/conformidad/{acta_id}/responder",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def responder_conformidad_acta_oral(request, acta_id: int, payload: ResponderConformidadPayload = Body(...)):
    """
    Registra la conformidad o disconformidad del estudiante sobre un acta oral.
    Valida autoritariamente contra la hora del servidor (máx 10 minutos).
    """
    user = request.user
    dni = getattr(user, "username", "")

    acta = (
        MesaActaOral.objects.select_related("inscripcion__estudiante__persona")
        .filter(id=acta_id)
        .first()
    )

    if not acta:
        return 404, ApiResponse(ok=False, message="Acta oral no encontrada.")

    if acta.inscripcion.estudiante.persona.dni != dni:
        return 403, ApiResponse(ok=False, message="No tienes permisos para responder sobre esta acta oral.")

    if acta.estado_conformidad != MesaActaOral.EstadoConformidad.PENDIENTE:
        return 400, ApiResponse(
            ok=False,
            message="El acta oral ya se encuentra cerrada y no admite modificaciones de conformidad.",
        )

    ahora = timezone.now()
    diez_minutos = timedelta(minutes=10)
    vencimiento = (acta.notificado_en or acta.created_at) + diez_minutos

    if ahora > vencimiento:
        # Expiró la ventana de 10 minutos: se cierra como TIMEOUT
        acta.estado_conformidad = MesaActaOral.EstadoConformidad.TIMEOUT
        acta.respondido_en = vencimiento
        acta.save(update_fields=["estado_conformidad", "respondido_en", "updated_at"])
        return 400, ApiResponse(
            ok=False,
            message="La ventana de 10 minutos ha expirado. El acta quedó notificada y sin objeción por tiempo cumplido.",
        )

    # Respuesta válida dentro de los 10 minutos
    if payload.conformidad == "CON":
        acta.estado_conformidad = MesaActaOral.EstadoConformidad.CONFORME
        acta.observaciones_estudiante = ""
    elif payload.conformidad == "DIS":
        acta.estado_conformidad = MesaActaOral.EstadoConformidad.DISCONFORME
        acta.observaciones_estudiante = payload.observaciones or ""
    else:
        return 400, ApiResponse(ok=False, message="Opción de conformidad no válida.")

    acta.respondido_en = ahora
    acta.save(update_fields=["estado_conformidad", "respondido_en", "observaciones_estudiante", "updated_at"])

    return ApiResponse(ok=True, message="Conformidad registrada exitosamente.")



@router.get(
    "/mesas/{mesa_id}/oral-actas",
    response={200: list[ActaOralListItemSchema], 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_actas_orales(request, mesa_id: int):
    mesa = MesaExamen.objects.filter(id=mesa_id).first()
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")

    actas = (
        MesaActaOral.objects.filter(mesa_id=mesa_id)
        .select_related("inscripcion__estudiante__persona")
        .order_by(
            "inscripcion__estudiante__persona__apellido",
            "inscripcion__estudiante__persona__nombre",
        )
    )

    payload: list[ActaOralListItemSchema] = []
    for acta in actas:
        estudiante = acta.inscripcion.estudiante
        full_name = f"{estudiante.apellido}, {estudiante.nombre}".strip(", ") or f"DNI {estudiante.dni}"
        payload.append(
            ActaOralListItemSchema(
                inscripcion_id=acta.inscripcion_id,
                estudiante=full_name,
                dni=estudiante.dni,
                acta_numero=acta.acta_numero or None,
                folio_numero=acta.folio_numero or None,
                fecha=acta.fecha,
                curso=acta.curso or None,
                nota_final=acta.nota_final or None,
            )
        )

    return payload


@router.get(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}/pdf",
    auth=JWTAuth(),
)
def descargar_acta_oral_pdf(request, mesa_id: int, inscripcion_id: int):
    import os

    from django.conf import settings
    from weasyprint import HTML

    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    acta: MesaActaOral | None = getattr(inscripcion, "acta_oral", None)
    if not acta:
        return HttpResponse("Acta oral no registrada.", status=404)

    mesa = inscripcion.mesa
    materia = mesa.materia
    profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio else None
    estudiante = inscripcion.estudiante
    est_nombre = f"{estudiante.apellido}, {estudiante.nombre}".strip(", ") or f"DNI {estudiante.dni}"

    pres = mesa.docente_presidente
    voc1 = mesa.docente_vocal1
    voc2 = mesa.docente_vocal2

    def docente_nombre(d):
        if not d:
            return ""
        return f"{d.persona.apellido.upper()}, {d.persona.nombre}" if d.persona else ""

    logo_left = os.path.join(settings.BASE_DIR, "static/logos/escudo_ministerio_tdf.png")
    logo_right = os.path.join(settings.BASE_DIR, "static/logos/logo_ipes.jpg")

    fecha_str = acta.fecha.strftime("%d/%m/%Y") if acta.fecha else ""

    context = {
        "logo_left_path": logo_left,
        "logo_right_path": logo_right,
        "acta_numero": acta.acta_numero or "",
        "folio_numero": acta.folio_numero or "",
        "fecha": fecha_str,
        "carrera": profesorado.nombre if profesorado else "",
        "unidad_curricular": materia.nombre if materia else "",
        "curso": mesa.codigo or acta.curso or "",
        "estudiante": f"{est_nombre} - DNI {estudiante.dni}",
        "tribunal": {
            "presidente": docente_nombre(pres),
            "vocal1": docente_nombre(voc1),
            "vocal2": docente_nombre(voc2),
        },
        "temas_estudiante": acta.temas_alumno or [],
        "temas_docente": acta.temas_docente or [],
        "nota_final": acta.nota_final or "",
        "observaciones": acta.observaciones or "",
    }

    html_string = render_to_string("core/acta_oral_pdf.html", context)
    response = HttpResponse(content_type="application/pdf")
    safe_name = est_nombre.replace(" ", "_").replace(",", "")
    response["Content-Disposition"] = f'attachment; filename="acta_oral_{safe_name}.pdf"'
    HTML(string=html_string, base_url=request.build_absolute_uri()).write_pdf(response)
    return response
