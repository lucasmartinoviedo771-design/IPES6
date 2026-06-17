"""Endpoints CRUD y workflow de pedidos de equivalencia."""

from django.db import transaction
from django.utils import timezone
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    PedidoEquivalencia,
    PlanDeEstudio,
    Profesorado,
)
from core.permissions import ensure_roles

from apps.estudiantes.api.common import (
    EQUIVALENCIAS_REVIEW_ROLES,
    TUTORIA_ROLES,
    TITULOS_ROLES,
    can_manage_equivalencias,
    ensure_estudiante_access,
    get_equivalencia_window,
    resolve_estudiante,
)
from apps.estudiantes.api.router import estudiantes_router
from apps.estudiantes.schemas import (
    PedidoEquivalenciaDocumentacionIn,
    PedidoEquivalenciaEvaluacionIn,
    PedidoEquivalenciaNotificarIn,
    PedidoEquivalenciaOut,
    PedidoEquivalenciaSaveIn,
    PedidoEquivalenciaTitulosIn,
)

from apps.estudiantes.api.equivalencias.helpers import (
    _calcular_resultado_final,
    _get_pedido_or_404,
    _is_estudiante_ipes,
    _parse_date,
    _pedido_queryset,
    _puede_editar_pedido_equivalencia,
    _serialize_pedido_equivalencia,
    _sync_pedido_equivalencia_materias,
)


@estudiantes_router.get("/equivalencias/pedidos", response=list[PedidoEquivalenciaOut])
def listar_pedidos_equivalencia(
    request,
    dni: str | None = None,
    estado: str | None = None,
    profesorado_id: int | None = None,
    ventana_id: int | None = None,
    workflow_estado: str | None = None,
):
    qs = _pedido_queryset().order_by("-updated_at")
    if can_manage_equivalencias(request.user):
        if dni:
            qs = qs.filter(estudiante__persona__dni=dni)
    else:
        est = resolve_estudiante(request, dni)
        if not est:
            return []
        qs = qs.filter(estudiante=est)
        if ventana_id is None:
            ventana_actual = get_equivalencia_window()
            if ventana_actual:
                qs = qs.filter(ventana=ventana_actual)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if profesorado_id:
        qs = qs.filter(profesorado_destino_id=profesorado_id)
    if estado:
        qs = qs.filter(estado=estado.lower())
    if workflow_estado:
        qs = qs.filter(workflow_estado=workflow_estado.lower())
    return [_serialize_pedido_equivalencia(item, request.user) for item in qs]


@estudiantes_router.post("/equivalencias/pedidos", response=PedidoEquivalenciaOut)
def crear_pedido_equivalencia(request, payload: PedidoEquivalenciaSaveIn, dni: str | None = None):
    ensure_estudiante_access(request, dni)
    est = resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")

    ventana = get_equivalencia_window()
    if not ventana:
        return 400, ApiResponse(ok=False, message="No hay periodo activo para pedido de equivalencias.")

    destino_obj = None
    destino_nombre = (payload.profesorado_destino_nombre or "").strip()
    if payload.profesorado_destino_id:
        destino_obj = Profesorado.objects.filter(id=payload.profesorado_destino_id).first()
        if not destino_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado de destino.")
        if not destino_nombre:
            destino_nombre = destino_obj.nombre
    if not destino_nombre:
        return 400, ApiResponse(ok=False, message="Debe indicar el profesorado de destino.")

    plan_destino_obj = None
    plan_destino_resolucion = (payload.plan_destino_resolucion or "").strip()
    if payload.plan_destino_id:
        plan_destino_obj = PlanDeEstudio.objects.filter(id=payload.plan_destino_id).first()
        if not plan_destino_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el plan seleccionado.")
        if not plan_destino_resolucion:
            plan_destino_resolucion = plan_destino_obj.resolucion

    if payload.tipo == PedidoEquivalencia.Tipo.ANEXO_A and not (payload.profesorado_origen_nombre or "").strip():
        return 400, ApiResponse(ok=False, message="Debe indicar el profesorado de origen.")
    if payload.tipo == PedidoEquivalencia.Tipo.ANEXO_B and not (payload.establecimiento_origen or "").strip():
        return 400, ApiResponse(ok=False, message="Debe indicar el establecimiento de origen.")

    if not payload.materias:
        return 400, ApiResponse(ok=False, message="Debes cargar al menos una materia.")

    pedido = PedidoEquivalencia.objects.create(
        estudiante=est,
        ventana=ventana,
        tipo=payload.tipo,
        ciclo_lectivo=(payload.ciclo_lectivo or str(timezone.now().year)).strip(),
        profesorado_destino=destino_obj,
        profesorado_destino_nombre=destino_nombre,
        plan_destino=plan_destino_obj,
        plan_destino_resolucion=plan_destino_resolucion,
        profesorado_origen_nombre=(payload.profesorado_origen_nombre or "").strip(),
        plan_origen_resolucion=(payload.plan_origen_resolucion or "").strip(),
        establecimiento_origen=(payload.establecimiento_origen or "").strip(),
        establecimiento_localidad=(payload.establecimiento_localidad or "").strip(),
        establecimiento_provincia=(payload.establecimiento_provincia or "").strip(),
    )
    _sync_pedido_equivalencia_materias(pedido, payload.materias)
    pedido.refresh_from_db()
    pedido.materias.all()  # precarga
    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.put("/equivalencias/pedidos/{pedido_id}", response=PedidoEquivalenciaOut)
def actualizar_pedido_equivalencia(request, pedido_id: int, payload: PedidoEquivalenciaSaveIn):
    pedido = (
        PedidoEquivalencia.objects.select_related(
            "ventana",
            "profesorado_destino",
            "plan_destino",
            "estudiante__user",
        )
        .prefetch_related("materias")
        .filter(id=pedido_id)
        .first()
    )
    if not pedido:
        return 404, ApiResponse(ok=False, message="No se encontró el pedido.")

    if not _puede_editar_pedido_equivalencia(pedido, request.user):
        return 403, ApiResponse(ok=False, message="No tiene permisos para modificar este pedido.")

    destino_obj = None
    destino_nombre = (payload.profesorado_destino_nombre or "").strip()
    if payload.profesorado_destino_id:
        destino_obj = Profesorado.objects.filter(id=payload.profesorado_destino_id).first()
        if not destino_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado de destino.")
        if not destino_nombre:
            destino_nombre = destino_obj.nombre
    if not destino_nombre:
        return 400, ApiResponse(ok=False, message="Debe indicar el profesorado de destino.")

    plan_destino_obj = None
    plan_destino_resolucion = (payload.plan_destino_resolucion or "").strip()
    if payload.plan_destino_id:
        plan_destino_obj = PlanDeEstudio.objects.filter(id=payload.plan_destino_id).first()
        if not plan_destino_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el plan seleccionado.")
        if not plan_destino_resolucion:
            plan_destino_resolucion = plan_destino_obj.resolucion

    if payload.tipo == PedidoEquivalencia.Tipo.ANEXO_A and not (payload.profesorado_origen_nombre or "").strip():
        return 400, ApiResponse(ok=False, message="Debe indicar el profesorado de origen.")
    if payload.tipo == PedidoEquivalencia.Tipo.ANEXO_B and not (payload.establecimiento_origen or "").strip():
        return 400, ApiResponse(ok=False, message="Debe indicar el establecimiento de origen.")
    if not payload.materias:
        return 400, ApiResponse(ok=False, message="Debes cargar al menos una materia.")

    pedido.tipo = payload.tipo
    pedido.ciclo_lectivo = (payload.ciclo_lectivo or pedido.ciclo_lectivo or "").strip()
    pedido.profesorado_destino = destino_obj
    pedido.profesorado_destino_nombre = destino_nombre
    pedido.plan_destino = plan_destino_obj
    pedido.plan_destino_resolucion = plan_destino_resolucion
    pedido.profesorado_origen_nombre = (payload.profesorado_origen_nombre or "").strip()
    pedido.plan_origen_resolucion = (payload.plan_origen_resolucion or "").strip()
    pedido.establecimiento_origen = (payload.establecimiento_origen or "").strip()
    pedido.establecimiento_localidad = (payload.establecimiento_localidad or "").strip()
    pedido.establecimiento_provincia = (payload.establecimiento_provincia or "").strip()
    pedido.save(
        update_fields=[
            "tipo",
            "ciclo_lectivo",
            "profesorado_destino",
            "profesorado_destino_nombre",
            "plan_destino",
            "plan_destino_resolucion",
            "profesorado_origen_nombre",
            "plan_origen_resolucion",
            "establecimiento_origen",
            "establecimiento_localidad",
            "establecimiento_provincia",
            "updated_at",
        ]
    )
    _sync_pedido_equivalencia_materias(pedido, payload.materias)
    pedido.refresh_from_db()
    pedido.materias.all()
    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.delete("/equivalencias/pedidos/{pedido_id}", response=ApiResponse)
def eliminar_pedido_equivalencia(request, pedido_id: int):
    pedido = PedidoEquivalencia.objects.select_related("estudiante__user").filter(id=pedido_id).first()
    if not pedido:
        return 404, ApiResponse(ok=False, message="No se encontró el pedido.")
    if not _puede_editar_pedido_equivalencia(pedido, request.user):
        return 403, ApiResponse(ok=False, message="No tiene permisos para eliminar este pedido.")
    pedido.delete()
    return ApiResponse(ok=True, message="Pedido eliminado.")


@estudiantes_router.post(
    "/equivalencias/pedidos/{pedido_id}/enviar",
    response=PedidoEquivalenciaOut,
    auth=JWTAuth(),
)
def enviar_pedido_equivalencia(request, pedido_id: int):
    pedido = _get_pedido_or_404(pedido_id)
    if not can_manage_equivalencias(request.user):
        estudiante = getattr(request.user, "estudiante", None)
        if not estudiante or estudiante.id != pedido.estudiante_id:
            raise HttpError(403, "No tienes permisos para enviar este pedido.")
    if pedido.workflow_estado != PedidoEquivalencia.WorkflowEstado.BORRADOR:
        raise HttpError(400, "El pedido ya fue enviado.")

    ahora = timezone.now()
    pedido.formulario_descargado_en = pedido.formulario_descargado_en or ahora
    pedido.inscripcion_verificada_en = pedido.inscripcion_verificada_en or ahora
    pedido.requiere_tutoria = not _is_estudiante_ipes(pedido.estudiante)
    pedido.estado = PedidoEquivalencia.Estado.FINALIZADO
    if pedido.requiere_tutoria:
        pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.PENDIENTE_DOCUMENTACION
    else:
        pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.EN_EVALUACION
        pedido.documentacion_presentada = True
        pedido.documentacion_registrada_en = ahora
        if getattr(request.user, "is_authenticated", False):
            pedido.documentacion_registrada_por = request.user
        if not pedido.documentacion_detalle:
            pedido.documentacion_detalle = "Verificacion automatica de inscripcion (IPES)"
    pedido.bloqueado_en = ahora
    if getattr(request.user, "is_authenticated", False):
        pedido.bloqueado_por = request.user
    pedido.save()
    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.post(
    "/equivalencias/pedidos/{pedido_id}/documentacion",
    response=PedidoEquivalenciaOut,
    auth=JWTAuth(),
)
def registrar_documentacion_equivalencia(
    request,
    pedido_id: int,
    payload: PedidoEquivalenciaDocumentacionIn,
):
    ensure_roles(request.user, TUTORIA_ROLES)
    pedido = _get_pedido_or_404(pedido_id)
    if pedido.workflow_estado not in {
        PedidoEquivalencia.WorkflowEstado.PENDIENTE_DOCUMENTACION,
        PedidoEquivalencia.WorkflowEstado.EN_EVALUACION,
    }:
        raise HttpError(400, "El pedido no se encuentra pendiente de documentaci\u00f3n.")

    ahora = timezone.now()
    pedido.documentacion_presentada = payload.presentada
    pedido.documentacion_cantidad = payload.cantidad if payload.presentada else None
    pedido.documentacion_detalle = (payload.detalle or "").strip() if payload.presentada else ""
    pedido.documentacion_registrada_en = ahora
    pedido.documentacion_registrada_por = request.user
    if payload.presentada:
        pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.EN_EVALUACION
    else:
        pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.PENDIENTE_DOCUMENTACION
    pedido.save()
    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.post(
    "/equivalencias/pedidos/{pedido_id}/evaluacion",
    response=PedidoEquivalenciaOut,
    auth=JWTAuth(),
)
def registrar_evaluacion_equivalencia(
    request,
    pedido_id: int,
    payload: PedidoEquivalenciaEvaluacionIn,
):
    ensure_roles(request.user, EQUIVALENCIAS_REVIEW_ROLES)
    pedido = _pedido_queryset().prefetch_related("materias").filter(id=pedido_id).first()
    if not pedido:
        return 404, ApiResponse(ok=False, message="Pedido no encontrado.")
    if pedido.workflow_estado != PedidoEquivalencia.WorkflowEstado.EN_EVALUACION:
        raise HttpError(400, "El pedido no se encuentra en evaluaci\u00f3n.")
    if not payload.materias:
        raise HttpError(400, "Debe indicar al menos un resultado.")

    materias_map = {item.id: item for item in pedido.materias.all()}
    ids_enviados = {entry.id for entry in payload.materias}
    if ids_enviados - set(materias_map.keys()):
        raise HttpError(400, "Se incluyeron materias que no pertenecen al pedido.")

    ahora = timezone.now()
    with transaction.atomic():
        for entry in payload.materias:
            materia = materias_map[entry.id]
            materia.resultado = entry.resultado
            materia.observaciones = (entry.observaciones or "").strip()
            materia.save(update_fields=["resultado", "observaciones"])
        pedido.evaluacion_observaciones = (payload.observaciones or "").strip()
        pedido.evaluacion_registrada_en = ahora
        pedido.evaluacion_registrada_por = request.user
        pedido.resultado_final = _calcular_resultado_final(pedido)
        pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.EN_TITULOS
        pedido.save(
            update_fields=[
                "evaluacion_observaciones",
                "evaluacion_registrada_en",
                "evaluacion_registrada_por",
                "resultado_final",
                "workflow_estado",
                "updated_at",
            ]
        )

    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.post(
    "/equivalencias/pedidos/{pedido_id}/titulos",
    response=PedidoEquivalenciaOut,
    auth=JWTAuth(),
)
def registrar_documentos_titulos(
    request,
    pedido_id: int,
    payload: PedidoEquivalenciaTitulosIn,
):
    ensure_roles(request.user, TITULOS_ROLES)
    pedido = _get_pedido_or_404(pedido_id)
    if pedido.workflow_estado != PedidoEquivalencia.WorkflowEstado.EN_TITULOS:
        raise HttpError(400, "El pedido no se encuentra en etapa de T\u00edtulos.")

    nota_fecha = _parse_date(payload.nota_fecha)
    dispo_fecha = _parse_date(payload.disposicion_fecha)
    nota_data = bool((payload.nota_numero or "").strip() or nota_fecha)
    dispo_data = bool((payload.disposicion_numero or "").strip() or dispo_fecha)

    if nota_data and dispo_data:
        doc_tipo = PedidoEquivalencia.DocumentoTitulos.AMBOS
    elif nota_data:
        doc_tipo = PedidoEquivalencia.DocumentoTitulos.NOTA
    elif dispo_data:
        doc_tipo = PedidoEquivalencia.DocumentoTitulos.DISPOSICION
    else:
        doc_tipo = PedidoEquivalencia.DocumentoTitulos.NINGUNO

    ahora = timezone.now()
    pedido.titulos_documento_tipo = doc_tipo
    pedido.titulos_nota_numero = (payload.nota_numero or "").strip()
    pedido.titulos_nota_fecha = nota_fecha
    pedido.titulos_disposicion_numero = (payload.disposicion_numero or "").strip()
    pedido.titulos_disposicion_fecha = dispo_fecha
    pedido.titulos_observaciones = (payload.observaciones or "").strip()
    pedido.titulos_registrado_en = ahora
    pedido.titulos_registrado_por = request.user
    pedido.save()

    # Notificación automática si ya tiene los datos mínimos
    if pedido.titulos_disposicion_numero or pedido.titulos_nota_numero:
        from apps.estudiantes.services.notificaciones_service import NotificacionesService
        try:
            NotificacionesService.notificar_equivalencia_finalizada(pedido)
        except Exception as e:
            print(f"Error enviando notificación de equivalencia: {e}")

    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.post(
    "/equivalencias/pedidos/{pedido_id}/notificar",
    response=PedidoEquivalenciaOut,
    auth=JWTAuth(),
)
def notificar_pedido_equivalencia(
    request,
    pedido_id: int,
    payload: PedidoEquivalenciaNotificarIn,
):
    ensure_roles(request.user, TUTORIA_ROLES)
    pedido = _get_pedido_or_404(pedido_id)
    if pedido.workflow_estado not in {
        PedidoEquivalencia.WorkflowEstado.EN_TITULOS,
        PedidoEquivalencia.WorkflowEstado.NOTIFICADO,
    }:
        raise HttpError(400, "El pedido a\u00fan no puede notificarse.")
    if not pedido.titulos_registrado_en:
        raise HttpError(400, "T\u00edtulos debe registrar la documentaci\u00f3n antes de notificar.")
    ahora = timezone.now()
    pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.NOTIFICADO
    pedido.notificado_en = ahora
    pedido.notificado_por = request.user
    pedido.save(update_fields=["workflow_estado", "notificado_en", "notificado_por", "updated_at"])
    return _serialize_pedido_equivalencia(pedido, request.user)
