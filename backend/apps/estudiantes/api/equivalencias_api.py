"""Endpoints de equivalencias (anexos A/B, notas, exportaciones)."""

import csv
from datetime import datetime

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from ninja.errors import HttpError
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    EquivalenciaCurricular,
    Estudiante,
    HorarioCatedraDetalle,
    Materia,
    PedidoEquivalencia,
    PedidoEquivalenciaMateria,
    PlanDeEstudio,
    Profesorado,
)
from core.permissions import ensure_roles

from .common import (
    EQUIVALENCIAS_REVIEW_ROLES,
    EQUIVALENCIAS_STAFF_ROLES,
    MONTH_NAMES,
    TITULOS_ROLES,
    TUTORIA_ROLES,
    build_certificate_header,
    can_manage_equivalencias,
    ensure_estudiante_access,
    get_equivalencia_window,
    resolve_estudiante,
)
from .router import estudiantes_router
from ..schemas import (
    EquivalenciaItem,
    Horario,
    PedidoEquivalenciaDocumentacionIn,
    PedidoEquivalenciaEvaluacionIn,
    PedidoEquivalenciaMateriaIn,
    PedidoEquivalenciaMateriaOut,
    PedidoEquivalenciaNotificarIn,
    PedidoEquivalenciaOut,
    PedidoEquivalenciaSaveIn,
    PedidoEquivalenciaTitulosIn,
)


def _puede_editar_pedido_equivalencia(pedido: PedidoEquivalencia, user) -> bool:
    if can_manage_equivalencias(user):
        return True
    estudiante = getattr(user, "estudiante", None)
    if not estudiante or estudiante.id != pedido.estudiante_id:
        return False
    return pedido.workflow_estado == PedidoEquivalencia.WorkflowEstado.BORRADOR


def _serialize_pedido_equivalencia(pedido: PedidoEquivalencia, user) -> PedidoEquivalenciaOut:
    materias = [
        PedidoEquivalenciaMateriaOut(
            id=item.id,
            nombre=item.nombre,
            formato=item.formato or None,
            anio_cursada=item.anio_cursada or None,
            nota=item.nota or None,
            resultado=item.resultado or None,
            observaciones=item.observaciones or None,
        )
        for item in pedido.materias.all()
    ]
    ventana_label = ""
    if pedido.ventana_id:
        desde = pedido.ventana.desde.strftime("%d/%m/%Y") if pedido.ventana.desde else ""
        hasta = pedido.ventana.hasta.strftime("%d/%m/%Y") if pedido.ventana.hasta else ""
        ventana_label = f"{pedido.ventana.get_tipo_display()} ({desde} - {hasta})"
    estudiante_nombre = pedido.estudiante.user.get_full_name() if pedido.estudiante.user_id else None
    timeline = {
        "formulario_descargado_en": pedido.formulario_descargado_en.isoformat()
        if pedido.formulario_descargado_en
        else None,
        "inscripcion_verificada_en": pedido.inscripcion_verificada_en.isoformat()
        if pedido.inscripcion_verificada_en
        else None,
        "documentacion_registrada_en": pedido.documentacion_registrada_en.isoformat()
        if pedido.documentacion_registrada_en
        else None,
        "evaluacion_registrada_en": pedido.evaluacion_registrada_en.isoformat()
        if pedido.evaluacion_registrada_en
        else None,
        "titulos_registrado_en": pedido.titulos_registrado_en.isoformat()
        if pedido.titulos_registrado_en
        else None,
        "notificado_en": pedido.notificado_en.isoformat() if pedido.notificado_en else None,
    }
    return PedidoEquivalenciaOut(
        id=pedido.id,
        tipo=pedido.tipo,
        estado=pedido.estado,
        estado_display=pedido.get_estado_display(),
        workflow_estado=pedido.workflow_estado,
        workflow_estado_display=pedido.get_workflow_estado_display(),
        ciclo_lectivo=pedido.ciclo_lectivo or None,
        profesorado_destino_id=pedido.profesorado_destino_id,
        profesorado_destino_nombre=pedido.profesorado_destino_nombre or None,
        plan_destino_id=pedido.plan_destino_id,
        plan_destino_resolucion=pedido.plan_destino_resolucion or None,
        profesorado_origen_nombre=pedido.profesorado_origen_nombre or None,
        plan_origen_resolucion=pedido.plan_origen_resolucion or None,
        establecimiento_origen=pedido.establecimiento_origen or None,
        establecimiento_localidad=pedido.establecimiento_localidad or None,
        establecimiento_provincia=pedido.establecimiento_provincia or None,
        ventana_id=pedido.ventana_id,
        ventana_label=ventana_label,
        created_at=pedido.created_at.isoformat(),
        updated_at=pedido.updated_at.isoformat(),
        bloqueado_en=pedido.bloqueado_en.isoformat() if pedido.bloqueado_en else None,
        puede_editar=_puede_editar_pedido_equivalencia(pedido, user),
        estudiante_dni=pedido.estudiante.dni,
        estudiante_nombre=estudiante_nombre,
        requiere_tutoria=pedido.requiere_tutoria,
        documentacion_presentada=pedido.documentacion_presentada,
        documentacion_detalle=pedido.documentacion_detalle or None,
        documentacion_cantidad=pedido.documentacion_cantidad,
        documentacion_registrada_en=pedido.documentacion_registrada_en.isoformat()
        if pedido.documentacion_registrada_en
        else None,
        evaluacion_observaciones=pedido.evaluacion_observaciones or None,
        evaluacion_registrada_en=pedido.evaluacion_registrada_en.isoformat()
        if pedido.evaluacion_registrada_en
        else None,
        resultado_final=pedido.resultado_final,
        titulos_documento_tipo=pedido.titulos_documento_tipo,
        titulos_nota_numero=pedido.titulos_nota_numero or None,
        titulos_nota_fecha=pedido.titulos_nota_fecha.isoformat() if pedido.titulos_nota_fecha else None,
        titulos_disposicion_numero=pedido.titulos_disposicion_numero or None,
        titulos_disposicion_fecha=pedido.titulos_disposicion_fecha.isoformat()
        if pedido.titulos_disposicion_fecha
        else None,
        titulos_observaciones=pedido.titulos_observaciones or None,
        titulos_registrado_en=pedido.titulos_registrado_en.isoformat()
        if pedido.titulos_registrado_en
        else None,
        materias=materias,
        timeline=timeline,
    )


def _pedido_queryset():
    return PedidoEquivalencia.objects.select_related(
        "ventana",
        "profesorado_destino",
        "estudiante__user",
        "bloqueado_por",
        "documentacion_registrada_por",
        "evaluacion_registrada_por",
        "titulos_registrado_por",
        "notificado_por",
    ).prefetch_related("materias")


def _get_pedido_or_404(pedido_id: int) -> PedidoEquivalencia:
    pedido = _pedido_queryset().filter(id=pedido_id).first()
    if not pedido:
        raise HttpError(404, "Pedido no encontrado.")
    return pedido


def _is_estudiante_ipes(estudiante: Estudiante) -> bool:
    return estudiante.carreras.exists()


def _parse_date(value: str | None):
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HttpError(400, f"Formato de fecha inválido: {value}")


def _calcular_resultado_final(pedido: PedidoEquivalencia) -> str:
    resultados = list(pedido.materias.values_list("resultado", flat=True))
    if not resultados:
        return PedidoEquivalencia.ResultadoFinal.PENDIENTE
    if all(resultado == PedidoEquivalenciaMateria.Resultado.OTORGADA for resultado in resultados):
        return PedidoEquivalencia.ResultadoFinal.OTORGADA
    if all(resultado == PedidoEquivalenciaMateria.Resultado.RECHAZADA for resultado in resultados):
        return PedidoEquivalencia.ResultadoFinal.DENEGADA
    return PedidoEquivalencia.ResultadoFinal.MIXTA


def _sync_pedido_equivalencia_materias(
    pedido: PedidoEquivalencia, materias: list[PedidoEquivalenciaMateriaIn]
) -> None:
    PedidoEquivalenciaMateria.objects.filter(pedido=pedido).delete()
    bulk: list[PedidoEquivalenciaMateria] = []
    for item in materias:
        nombre = (item.nombre or "").strip()
        if not nombre:
            continue
        bulk.append(
            PedidoEquivalenciaMateria(
                pedido=pedido,
                nombre=nombre,
                formato=(item.formato or "").strip(),
                anio_cursada=(item.anio_cursada or "").strip(),
                nota=(item.nota or "").strip(),
            )
        )
    if bulk:
        PedidoEquivalenciaMateria.objects.bulk_create(bulk)


@estudiantes_router.get("/equivalencias", response=list[EquivalenciaItem], auth=JWTAuth())
def equivalencias_para_materia(request, materia_id: int):
    """Devuelve materias equivalentes (otros profesorados) para la materia indicada."""
    try:
        m = Materia.objects.get(id=materia_id)
    except Materia.DoesNotExist:
        return []
    grupos = EquivalenciaCurricular.objects.filter(materias=m)
    if not grupos.exists():
        candidates = Materia.objects.filter(nombre__iexact=m.nombre).exclude(id=m.id)
        items: list[EquivalenciaItem] = []
        for mm in candidates:
            detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mm).select_related(
                "bloque", "horario_catedra"
            )
            hs = [
                Horario(
                    dia=d.bloque.get_dia_display(),
                    desde=str(d.bloque.hora_desde)[:5],
                    hasta=str(d.bloque.hora_hasta)[:5],
                )
                for d in detalles
            ]
            items.append(
                EquivalenciaItem(
                    materia_id=mm.id,
                    materia_nombre=mm.nombre,
                    profesorado=mm.plan_de_estudio.profesorado.nombre,
                    horarios=hs,
                )
            )
        return items

    eq = grupos.first()
    items: list[EquivalenciaItem] = []
    for mm in eq.materias.exclude(id=m.id):
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mm).select_related(
            "bloque", "horario_catedra"
        )
        hs = [
            Horario(
                dia=d.bloque.get_dia_display(),
                desde=str(d.bloque.hora_desde)[:5],
                hasta=str(d.bloque.hora_hasta)[:5],
            )
            for d in detalles
        ]
        items.append(
            EquivalenciaItem(
                materia_id=mm.id,
                materia_nombre=mm.nombre,
                profesorado=mm.plan_de_estudio.profesorado.nombre,
                horarios=hs,
            )
        )
    return items


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
            qs = qs.filter(estudiante__dni=dni)
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
        raise HttpError(400, "El pedido no se encuentra pendiente de documentaci�n.")

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
        raise HttpError(400, "El pedido no se encuentra en evaluaci�n.")
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
        raise HttpError(400, "El pedido no se encuentra en etapa de T�tulos.")

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
        raise HttpError(400, "El pedido a�n no puede notificarse.")
    if not pedido.titulos_registrado_en:
        raise HttpError(400, "T�tulos debe registrar la documentaci�n antes de notificar.")
    ahora = timezone.now()
    pedido.workflow_estado = PedidoEquivalencia.WorkflowEstado.NOTIFICADO
    pedido.notificado_en = ahora
    pedido.notificado_por = request.user
    pedido.save(update_fields=["workflow_estado", "notificado_en", "notificado_por", "updated_at"])
    return _serialize_pedido_equivalencia(pedido, request.user)


@estudiantes_router.post("/equivalencias/pedidos/{pedido_id}/nota", auth=JWTAuth())


@estudiantes_router.post("/equivalencias/pedidos/{pedido_id}/nota", auth=JWTAuth())
def generar_nota_equivalencias(request, pedido_id: int):
    pedido = (
        PedidoEquivalencia.objects.select_related(
            "estudiante__user",
            "ventana",
            "profesorado_destino",
        )
        .prefetch_related("materias")
        .filter(id=pedido_id)
        .first()
    )
    if not pedido:
        return 404, ApiResponse(ok=False, message="No se encontró el pedido.")

    if not can_manage_equivalencias(request.user):
        estudiante = getattr(request.user, "estudiante", None)
        if not estudiante or estudiante.id != pedido.estudiante_id:
            return 403, ApiResponse(ok=False, message="No tiene permisos para ver este pedido.")

    if not pedido.materias.exists():
        return 400, ApiResponse(ok=False, message="El pedido no tiene materias cargadas.")

    today = timezone.now()
    est = pedido.estudiante
    destino_nombre = (
        pedido.profesorado_destino_nombre
        or (pedido.profesorado_destino.nombre if pedido.profesorado_destino_id else "")
    )
    ciclo_lectivo = pedido.ciclo_lectivo or str(today.year)
    tipo = pedido.tipo
    anexo_label = "ANEXO FORMULARIO A" if tipo == PedidoEquivalencia.Tipo.ANEXO_A else "ANEXO FORMULARIO B"
    note_title = (
        "Nota para solicitar equivalencias internas"
        if tipo == PedidoEquivalencia.Tipo.ANEXO_A
        else "Modelo de nota para solicitud de equivalencias"
    )
    if tipo == PedidoEquivalencia.Tipo.ANEXO_A:
        paragraphs = _build_equivalencia_paragraphs_internas(
            destino_nombre,
            pedido.profesorado_origen_nombre,
            pedido.plan_origen_resolucion,
            ciclo_lectivo,
        )
    else:
        paragraphs = _build_equivalencia_paragraphs_externas(
            destino_nombre,
            pedido.establecimiento_origen,
            pedido.establecimiento_localidad,
            pedido.establecimiento_provincia,
            pedido.plan_destino_resolucion,
            ciclo_lectivo,
        )

    materias_rows = [
        {"nombre": m.nombre, "formato": m.formato, "anio": m.anio_cursada, "nota": m.nota}
        for m in pedido.materias.all()
    ]

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="pedido_equivalencias_{est.dni}.pdf"'
    doc = SimpleDocTemplate(
        response,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    anexo_style = ParagraphStyle(
        "EquivalenciaAnexo",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=4,
    )
    title_style = ParagraphStyle(
        "EquivalenciaTitle",
        parent=styles["Heading2"],
        alignment=TA_CENTER,
        fontSize=15,
        leading=18,
        spaceAfter=16,
    )
    body_style = ParagraphStyle(
        "EquivalenciaBody",
        parent=styles["Normal"],
        alignment=TA_JUSTIFY,
        fontSize=12,
        leading=16,
        firstLineIndent=28,
        spaceAfter=12,
    )
    plain_body = ParagraphStyle(
        "EquivalenciaBodyPlain",
        parent=body_style,
        firstLineIndent=0,
    )
    helper_style = ParagraphStyle(
        "EquivalenciaHelper",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        alignment=TA_JUSTIFY,
        textColor=colors.grey,
        spaceAfter=10,
    )
    location_style = ParagraphStyle(
        "EquivalenciaLocation",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=11,
        leading=14,
        spaceAfter=18,
    )
    motto_style = ParagraphStyle(
        "EquivalenciaMotto",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=8,
        leading=10,
        textColor=colors.grey,
    )

    mes_nombre = MONTH_NAMES.get(today.month, today.strftime("%B").lower())
    fecha_linea = f"Río Grande, {today.day} de {mes_nombre} de {today.year}"

    story: list = []
    story.extend(build_certificate_header(doc))
    story.append(Paragraph(anexo_label, anexo_style))
    story.append(Paragraph(note_title, title_style))
    story.append(Paragraph(fecha_linea, location_style))
    for texto in paragraphs:
        story.append(Paragraph(texto, body_style))
    story.append(Paragraph("Las materias que solicito se detallen son:", plain_body))
    story.append(Spacer(1, 8))
    story.append(_build_equivalencias_table(materias_rows))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Indique el nombre del espacio curricular tal cual figura en su analítico, "
            "el formato (módulo, asignatura, taller, etc.) y el año de cursada.",
            helper_style,
        )
    )
    story.append(Paragraph("Sin otro particular, saludo atentamente.", body_style))
    story.append(Spacer(1, 20))
    story.append(_build_equivalencia_signature(est))
    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "Las Islas Malvinas, Georgia, Sandwich del Sur y los Hielos Continentales, son y serán Argentinas",
            motto_style,
        )
    )

    doc.build(story)

    return response


@estudiantes_router.get("/equivalencias/export")
def exportar_pedidos_equivalencia(
    request,
    profesorado_id: int | None = None,
    ventana_id: int | None = None,
    estado: str | None = None,
):
    ensure_roles(request.user, EQUIVALENCIAS_STAFF_ROLES)
    qs = (
        PedidoEquivalencia.objects.select_related(
            "profesorado_destino",
            "ventana",
            "estudiante__user",
        )
        .prefetch_related("materias")
        .order_by("profesorado_destino_nombre", "estudiante__dni")
    )
    if profesorado_id:
        qs = qs.filter(profesorado_destino_id=profesorado_id)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if estado:
        qs = qs.filter(estado=estado.lower())

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="pedidos_equivalencias.csv"'
    writer = csv.writer(response)
    writer.writerow(
        [
            "DNI",
            "Estudiante",
            "Tipo",
            "Estado",
            "Profesorado destino",
            "Plan destino",
            "Ciclo lectivo",
            "Ventana",
            "Fecha actualización",
            "Materias solicitadas (incluye nota)",
        ]
    )
    for pedido in qs:
        materias_txt = " | ".join(
            " ".join(
                filter(
                    None,
                    [
                        m.nombre,
                        f"({m.formato})" if m.formato else None,
                        f"Año {m.anio_cursada}" if m.anio_cursada else None,
                        f"Nota: {m.nota}" if getattr(m, 'nota', "") else None,
                    ],
                )
            )
            for m in pedido.materias.all()
        )
        ventana_label = ""
        if pedido.ventana_id:
            desde = pedido.ventana.desde.strftime("%d/%m/%Y") if pedido.ventana.desde else ""
            hasta = pedido.ventana.hasta.strftime("%d/%m/%Y") if pedido.ventana.hasta else ""
            ventana_label = f"{desde} - {hasta}"
        writer.writerow(
            [
                pedido.estudiante.dni,
                pedido.estudiante.user.get_full_name() if pedido.estudiante.user_id else "",
                pedido.get_tipo_display(),
                pedido.get_estado_display(),
                pedido.profesorado_destino_nombre,
                pedido.plan_destino_resolucion,
                pedido.ciclo_lectivo,
                ventana_label,
                pedido.updated_at.strftime("%d/%m/%Y %H:%M"),
                materias_txt,
            ]
        )

    return response


def _build_equivalencia_paragraphs_internas(
    destino_nombre: str,
    profesorado_origen: str,
    plan_origen: str,
    ciclo_lectivo: str,
) -> list[str]:
    return [
        (
            "Me dirijo a usted, a fin de solicitar el otorgamiento de equivalencias de las materias aprobadas "
            f"en el profesorado {profesorado_origen} (Plan {plan_origen}), durante el ciclo lectivo {ciclo_lectivo}, "
            f"que considero equivalentes a las correspondientes materias del profesorado {destino_nombre}."
        ),
        "Adjunto la documentación requerida para el análisis correspondiente.",
    ]


def _build_equivalencia_paragraphs_externas(
    destino_nombre: str,
    establecimiento: str,
    localidad: str,
    provincia: str,
    plan_destino: str,
    ciclo_lectivo: str,
) -> list[str]:
    return [
        (
            "Me dirijo a usted, a fin de solicitar el otorgamiento de equivalencias de las materias cursadas y "
            f"aprobadas en el establecimiento {establecimiento}, ubicado en {localidad}, provincia de {provincia}, "
            f"durante el ciclo lectivo {ciclo_lectivo}, para que sean consideradas en el profesorado {destino_nombre} "
            f"(Plan {plan_destino})."
        ),
        "Adjunto la documentación correspondiente para su evaluación.",
    ]


def _build_equivalencias_table(materias: list[dict[str, str]]) -> Table:
    header = ["Nombre del espacio curricular", "Formato", "Año de cursada", "Nota"]
    rows: list[list[str]] = [header]
    total_rows = max(len(materias), 8)
    default_row = {"nombre": "", "formato": "", "anio": "", "nota": ""}
    for idx in range(total_rows):
        data = materias[idx] if idx < len(materias) else default_row
        rows.append(
            [
                data.get("nombre") or "",
                data.get("formato") or "",
                data.get("anio") or "",
                data.get("nota") or "",
            ]
        )

    table = Table(rows, colWidths=[230, 110, 80, 60])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("ALIGN", (0, 1), (0, -1), "LEFT"),
                ("ALIGN", (1, 1), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def _placeholder(value: str | None, fallback: str = "____________________") -> str:
    value = (value or "").strip()
    return value if value else fallback


def _build_equivalencia_signature(estudiante: Estudiante) -> Table:
    styles = getSampleStyleSheet()
    value_style = ParagraphStyle(
        "EquivalenciaSignatureValue",
        parent=styles["Normal"],
        fontSize=11,
    )
    nombre = _placeholder(estudiante.user.get_full_name() if estudiante.user_id else estudiante.dni)
    telefono = _placeholder(getattr(estudiante, "telefono", "") or "")
    email = _placeholder(getattr(estudiante.user, "email", "") if estudiante.user_id else "")
    data = [
        ["Firma y aclaración (estudiante)", Paragraph(nombre, value_style)],
        ["DNI", Paragraph(estudiante.dni, value_style)],
        ["Teléfono de contacto", Paragraph(telefono, value_style)],
        ["Correo electrónico", Paragraph(email, value_style)],
    ]
    table = Table(data, colWidths=[220, 260], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _formatear_rango_ventana(ventana, ventana_id: int) -> str:
    if not ventana:
        return f"Ventana ID: {ventana_id}"
    rango = f"{ventana.desde.strftime('%d/%m/%Y')} - {ventana.hasta.strftime('%d/%m/%Y')}"
    etiqueta = " (Activo)" if ventana.activo else ""
    return f"Ventana: {rango}{etiqueta}"


