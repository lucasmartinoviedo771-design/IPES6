from __future__ import annotations

from django.contrib.auth.models import AnonymousUser

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import Estudiante, PedidoAnalitico, PlanDeEstudio, Profesorado, VentanaHabilitacion

from ..schemas import PedidoAnaliticoIn, PedidoAnaliticoItem, PedidoAnaliticoOut
from .helpers import _listar_carreras_detalle
from .router import estudiantes_router


@estudiantes_router.get("/pedido_analitico", response=PedidoAnaliticoOut, auth=JWTAuth())
def pedido_analitico(request):
    # Endpoint placeholder que existía en legacy_api
    return {"message": "Solicitud de pedido de analítico recibida."}


@estudiantes_router.post("/pedido_analitico", response=PedidoAnaliticoOut)
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
        estudiante = Estudiante.objects.filter(dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        estudiante = getattr(request.user, "estudiante", None)

    if not estudiante:
        return 400, {"message": "No se encontró el estudiante."}

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


@estudiantes_router.get("/analiticos", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico(request, ventana_id: int):
    qs = (
        PedidoAnalitico.objects.select_related("estudiante__user", "profesorado", "ventana")
        .filter(ventana_id=ventana_id)
        .order_by("-created_at")
    )
    salida: list[PedidoAnaliticoItem] = []
    for pedido in qs:
        est = pedido.estudiante
        salida.append(
            PedidoAnaliticoItem(
                dni=est.dni,
                apellido_nombre=est.user.get_full_name() if est.user_id else "",
                profesorado=pedido.profesorado.nombre if pedido.profesorado_id else None,
                anio_cursada=None,
                cohorte=pedido.cohorte,
                fecha_solicitud=pedido.created_at.isoformat(),
            )
        )
    return salida
