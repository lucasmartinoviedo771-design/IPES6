"""Helpers de serialización y queryset para equivalencias."""

from apps.common.date_utils import format_date, format_datetime, parse_date

from ninja.errors import HttpError

from core.models import (
    Estudiante,
    PedidoEquivalencia,
    PedidoEquivalenciaMateria,
    PlanDeEstudio,
    Profesorado,
)

from apps.estudiantes.api.common import can_manage_equivalencias
from apps.estudiantes.schemas import (
    PedidoEquivalenciaMateriaIn,
    PedidoEquivalenciaMateriaOut,
    PedidoEquivalenciaOut,
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
        desde = format_date(pedido.ventana.desde) if pedido.ventana.desde else ""
        hasta = format_date(pedido.ventana.hasta) if pedido.ventana.hasta else ""
        ventana_label = f"{pedido.ventana.get_tipo_display()} ({desde} - {hasta})"
    estudiante_nombre = pedido.estudiante.user.get_full_name() if pedido.estudiante.user_id else None
    timeline = {
        "formulario_descargado_en": format_datetime(pedido.formulario_descargado_en),
        "inscripcion_verificada_en": format_datetime(pedido.inscripcion_verificada_en),
        "documentacion_registrada_en": format_datetime(pedido.documentacion_registrada_en),
        "evaluacion_registrada_en": format_datetime(pedido.evaluacion_registrada_en),
        "titulos_registrado_en": format_datetime(pedido.titulos_registrado_en),
        "notificado_en": format_datetime(pedido.notificado_en),
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
        created_at=format_datetime(pedido.created_at),
        updated_at=format_datetime(pedido.updated_at),
        bloqueado_en=format_datetime(pedido.bloqueado_en),
        puede_editar=_puede_editar_pedido_equivalencia(pedido, user),
        estudiante_dni=pedido.estudiante.dni,
        estudiante_nombre=estudiante_nombre,
        requiere_tutoria=pedido.requiere_tutoria,
        documentacion_presentada=pedido.documentacion_presentada,
        documentacion_detalle=pedido.documentacion_detalle or None,
        documentacion_cantidad=pedido.documentacion_cantidad,
        documentacion_registrada_en=format_datetime(pedido.documentacion_registrada_en),
        evaluacion_observaciones=pedido.evaluacion_observaciones or None,
        evaluacion_registrada_en=format_datetime(pedido.evaluacion_registrada_en),
        resultado_final=pedido.resultado_final,
        titulos_documento_tipo=pedido.titulos_documento_tipo,
        titulos_nota_numero=pedido.titulos_nota_numero or None,
        titulos_nota_fecha=format_date(pedido.titulos_nota_fecha),
        titulos_disposicion_numero=pedido.titulos_disposicion_numero or None,
        titulos_disposicion_fecha=format_date(pedido.titulos_disposicion_fecha),
        titulos_observaciones=pedido.titulos_observaciones or None,
        titulos_registrado_en=format_datetime(pedido.titulos_registrado_en),
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
    return parse_date(value)


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


def _formatear_rango_ventana(ventana, ventana_id: int) -> str:
    if not ventana:
        return f"Ventana ID: {ventana_id}"
    rango = f"{ventana.desde.strftime('%d/%m/%Y')} - {ventana.hasta.strftime('%d/%m/%Y')}"
    etiqueta = " (Activo)" if ventana.activo else ""
    return f"Ventana: {rango}{etiqueta}"
