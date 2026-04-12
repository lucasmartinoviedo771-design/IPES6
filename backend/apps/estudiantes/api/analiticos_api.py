from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from django.shortcuts import get_object_or_404

from apps.common.api_schemas import ApiResponse
from apps.common.date_utils import format_datetime
from core.auth_ninja import JWTAuth
from core.permissions import ensure_roles
from apps.estudiantes.api.common import TITULOS_ROLES
from core.models import Estudiante, PedidoAnalitico, PlanDeEstudio, Profesorado, VentanaHabilitacion

from ..schemas import PedidoAnaliticoIn, PedidoAnaliticoItem, PedidoAnaliticoOut
from .helpers import _listar_carreras_detalle
from .router import estudiantes_router


@estudiantes_router.get("/pedido_analitico", response=PedidoAnaliticoOut, auth=JWTAuth())
def pedido_analitico(request):
    # Endpoint placeholder que existía en legacy_api
    return {"message": "Solicitud de pedido de analítico recibida."}


@estudiantes_router.post("/pedido_analitico", response={200: PedidoAnaliticoOut, 400: PedidoAnaliticoOut, 403: PedidoAnaliticoOut, 404: PedidoAnaliticoOut})
def crear_pedido_analitico(request, payload: PedidoAnaliticoIn):
    ventana = (
        VentanaHabilitacion.objects.filter(tipo=VentanaHabilitacion.Tipo.ANALITICOS, activo=True)
        .order_by("-desde")
        .first()
    )
    if not ventana:
        return 400, {"message": "No hay periodo activo para pedido de analítico."}

    estudiante = None
    if payload.dni:
        estudiante = Estudiante.objects.filter(persona__dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        estudiante = getattr(request.user, "estudiante", None)

    if not estudiante:
        return 400, {"message": "No se encontró el estudiante."}

    # Bloqueo de duplicados en la misma ventana
    existe = PedidoAnalitico.objects.filter(estudiante=estudiante, ventana=ventana).exists()
    if existe:
        return 400, {"message": "Ya posee una solicitud de analítico registrada para este periodo."}

    carreras_est = list(estudiante.carreras.all())
    profesorado_obj: Profesorado | None = None
    if payload.plan_id is not None:
        plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=payload.plan_id).first()
        if not plan:
            return 404, {"message": "No se encontró el plan de estudio indicado."}
        if plan.profesorado not in carreras_est:
            return 403, {"message": "El estudiante no pertenece al profesorado de ese plan."}
        profesorado_obj = plan.profesorado
    elif payload.profesorado_id is not None:
        profesorado_obj = Profesorado.objects.filter(id=payload.profesorado_id).first()
        if not profesorado_obj:
            return 404, {"message": "No se encontró el profesorado indicado."}
        if profesorado_obj not in carreras_est:
            return 403, {"message": "El estudiante no está inscripto en el profesorado seleccionado."}
    else:
        if len(carreras_est) > 1:
            return 400, {
                "message": "Debe seleccionar un profesorado.",
                "data": {"carreras": _listar_carreras_detalle(estudiante, carreras_est)},
            }
        profesorado_obj = carreras_est[0] if carreras_est else None

    PedidoAnalitico.objects.create(
        estudiante=estudiante,
        ventana=ventana,
        motivo=payload.motivo,
        motivo_otro=payload.motivo_otro,
        profesorado=profesorado_obj,
        cohorte=payload.cohorte,
    )
    return {"message": "Solicitud registrada."}


@estudiantes_router.get("/analiticos_ext", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico(request, ventana_id: int, dni: str | None = None):
    qs = (
        PedidoAnalitico.objects.select_related("estudiante__user", "estudiante__persona", "profesorado", "ventana")
        .filter(ventana_id=ventana_id)
    )
    if dni:
        qs = qs.filter(estudiante__persona__dni__icontains=dni)
        
    qs = qs.order_by("-created_at")
    
    salida: list[PedidoAnaliticoItem] = []
    for pedido in qs:
        est = pedido.estudiante
        salida.append(
            PedidoAnaliticoItem(
                id=pedido.id,
                dni=est.dni,
                apellido_nombre=est.user.get_full_name() if est.user_id else str(est),
                profesorado=pedido.profesorado.nombre if pedido.profesorado_id else None,
                anio_cursada=None,
                cohorte=pedido.cohorte,
                fecha_solicitud=format_datetime(pedido.created_at),
                motivo=pedido.motivo,
                motivo_otro=pedido.motivo_otro,
                estado=pedido.estado,
            )
        )
    return salida


@estudiantes_router.get("/analiticos_ext/pdf")
def descargar_pedidos_analitico_pdf(request, ventana_id: int, dni: str | None = None):
    from django.template.loader import render_to_string
    from django.http import HttpResponse
    from weasyprint import HTML
    import datetime
    from django.conf import settings
    import os

    ventana = get_object_or_404(VentanaHabilitacion, id=ventana_id)
    items = listar_pedidos_analitico(request, ventana_id, dni)

    logo_left_path = os.path.join(settings.BASE_DIR, "static/logos/escudo_ministerio_tdf.png")
    logo_right_path = os.path.join(settings.BASE_DIR, "static/logos/logo_ipes.jpg")
    if not os.path.exists(logo_left_path):
        logo_left_path = os.path.join(settings.BASE_DIR, "backend/static/logos/escudo_ministerio_tdf.png")
        logo_right_path = os.path.join(settings.BASE_DIR, "backend/static/logos/logo_ipes.jpg")

    context = {
        "items": items,
        "ventana": ventana,
        "q": dni,
        "hoy": datetime.datetime.now(),
        "logo_left_path": logo_left_path,
        "logo_right_path": logo_right_path,
    }

    html_string = render_to_string("estudiantes/listado_analiticos_pdf.html", context)
    pdf = HTML(string=html_string, base_url=request.build_absolute_uri("/")).write_pdf()

    response = HttpResponse(pdf, content_type="application/pdf")
    filename = f"analiticos_{ventana_id}"
    if dni:
        filename += f"_{dni}"
    response["Content-Disposition"] = f'attachment; filename="{filename}.pdf"'
    return response


@estudiantes_router.patch("/analiticos_ext/{pedido_id}/marcar-confeccionado", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
def marcar_analitico_confeccionado(request, pedido_id: int):
    """Marca un pedido de analítico como confeccionado y notifica al estudiante y tutores."""
    from apps.estudiantes.services.notificaciones_service import NotificacionesService
    from django.utils import timezone

    ensure_roles(request.user, TITULOS_ROLES | {"bedel"})

    pedido = get_object_or_404(PedidoAnalitico, id=pedido_id)
    if pedido.estado != PedidoAnalitico.Estado.PENDIENTE:
        return 400, ApiResponse(ok=False, message=f"El pedido ya se encuentra en estado {pedido.get_estado_display()}.")

    pedido.estado = PedidoAnalitico.Estado.CONFECCIONADO
    pedido.preparado_por = request.user
    pedido.preparado_en = timezone.now()
    pedido.save()

    try:
        NotificacionesService.notificar_analitico_listo(pedido, accion="confeccionado")
    except Exception as e:
        print(f"Error enviando notificación de analítico: {e}")

    return 200, ApiResponse(ok=True, message="Pedido marcado como confeccionado. Se notificó al estudiante y tutores.")


@estudiantes_router.patch("/analiticos_ext/{pedido_id}/marcar-entregado", response={200: ApiResponse, 400: ApiResponse}, auth=JWTAuth())
def marcar_analitico_entregado(request, pedido_id: int):
    """Marca un pedido de analítico como entregado y notifica al estudiante y tutores."""
    from apps.estudiantes.services.notificaciones_service import NotificacionesService
    from django.utils import timezone

    ensure_roles(request.user, TITULOS_ROLES | {"bedel"})

    pedido = get_object_or_404(PedidoAnalitico, id=pedido_id)
    if pedido.estado != PedidoAnalitico.Estado.CONFECCIONADO:
        return 400, ApiResponse(ok=False, message=f"El pedido debe estar confeccionado antes de marcarlo como entregado. Estado actual: {pedido.get_estado_display()}.")

    pedido.estado = PedidoAnalitico.Estado.ENTREGADO
    pedido.save(update_fields=["estado", "updated_at"])

    try:
        NotificacionesService.notificar_analitico_listo(pedido, accion="entregado")
    except Exception as e:
        print(f"Error enviando notificación de entrega de analítico: {e}")

    return 200, ApiResponse(ok=True, message="Pedido marcado como entregado. Se notificó al estudiante y tutores.")
