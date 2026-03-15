from datetime import date
from django.http import HttpRequest
from django.utils import timezone
from django.conf import settings
from ninja import Router
from ninja.errors import HttpError

from core.models import Docente
from core.permissions import get_user_roles
from core.auth_ninja import JWTAuth

from .models import (
    AsistenciaDocente,
    ClaseProgramada,
    DocenteMarcacionLog,
)
from .schemas import (
    DocenteClasesResponse,
    DocenteHistorialOut,
    DocenteInfoOut,
    DocenteClaseOut,
    DocenteMarcarPresenteIn,
    DocenteMarcarPresenteOut,
    DocenteDniLogIn,
)
from .services import (
    generate_classes_for_range,
    registrar_log_docente,
)
from .api_helpers import (
    _calcular_ventanas,
    _build_horario,
)
from apps.common.date_utils import format_date, format_datetime

router = Router(tags=["asistencia-docentes"], auth=JWTAuth())

@router.get("/{dni}/clases", response=DocenteClasesResponse)
def listar_clases_docente(
    request: HttpRequest,
    dni: str,
    fecha: date | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    dia_semana: int | None = None,
) -> DocenteClasesResponse:
    if fecha and (desde or hasta):
        raise HttpError(400, "No se puede combinar un día puntual con un rango de fechas.")
    if dia_semana is not None and (dia_semana < 0 or dia_semana > 6):
        raise HttpError(400, "El día de la semana debe estar entre 0 (lunes) y 6 (domingo).")

    if fecha is None and desde is None and hasta is None:
        fecha = date.today()
    if fecha:
        desde = fecha
        hasta = fecha
    else:
        desde = desde or date.today()
        hasta = hasta or desde
    if desde > hasta:
        raise HttpError(400, "La fecha 'desde' no puede ser posterior a 'hasta'.")

    docente = Docente.objects.filter(persona__dni=dni).first()
    if not docente:
        raise HttpError(404, "No se encontró un docente con ese DNI.")

    comision_ids = list(docente.comisiones.values_list("id", flat=True))
    if comision_ids:
        generate_classes_for_range(desde, hasta, comision_ids=comision_ids)

    clases_qs = (
        ClaseProgramada.objects.filter(docente=docente, fecha__range=(desde, hasta))
        .select_related(
            "comision",
            "comision__materia",
            "comision__materia__plan_de_estudio",
            "comision__materia__plan_de_estudio__profesorado",
            "comision__turno",
        )
        .prefetch_related("asistencia_docentes")
        .order_by("fecha", "hora_inicio", "hora_fin")
    )

    clases = []
    for clase in clases_qs:
        if dia_semana is not None and clase.fecha.weekday() != dia_semana:
            continue
        clases.append(clase)

    asistencias = {
        registro.clase_id: registro
        for registro in AsistenciaDocente.objects.filter(clase__in=clases, docente=docente)
    }

    roles_usuario = get_user_roles(getattr(request, "user", None))
    puede_editar_staff = bool(roles_usuario & {"admin", "secretaria", "bedel"})

    now = timezone.now()
    if settings.USE_TZ:
        now = timezone.localtime(now)
    clases_out: list[DocenteClaseOut] = []
    for clase in clases:
        ventana_inicio, umbral_tarde, ventana_fin, turno_nombre = _calcular_ventanas(clase)
        if not turno_nombre:
            turno_nombre = clase.comision.turno.nombre if clase.comision and clase.comision.turno_id else ""
        asistencia = asistencias.get(clase.id)
        puede_marcar = clase.estado != ClaseProgramada.Estado.CANCELADA
        if puede_marcar and not puede_editar_staff and ventana_inicio and ventana_fin:
            puede_marcar = ventana_inicio <= now <= ventana_fin
        materia = clase.comision.materia
        plan = getattr(materia, "plan_de_estudio", None)
        profesorado = getattr(plan, "profesorado", None) if plan else None
        clases_out.append(
            DocenteClaseOut(
                id=clase.id,
                fecha=format_date(clase.fecha),
                comision_id=clase.comision_id,
                materia=clase.comision.materia.nombre,
                materia_id=materia.id if materia else 0,
                comision=clase.comision.codigo,
                turno=turno_nombre,
                horario=_build_horario(clase.hora_inicio, clase.hora_fin),
                aula=None,
                puede_marcar=puede_marcar,
                editable_staff=puede_editar_staff and clase.estado != ClaseProgramada.Estado.CANCELADA,
                ya_registrada=bool(
                    asistencia and asistencia.estado == AsistenciaDocente.Estado.PRESENTE
                ),
                registrada_en=format_datetime(asistencia.registrado_en) if asistencia else None,
                ventana_inicio=format_datetime(ventana_inicio),
                ventana_fin=format_datetime(ventana_fin),
                umbral_tarde=format_datetime(umbral_tarde),
                plan_id=plan.id if plan else None,
                plan_resolucion=plan.resolucion if plan else None,
                profesorado_id=profesorado.id if profesorado else None,
                profesorado_nombre=profesorado.nombre if profesorado else None,
            )
        )

    historial_qs = (
        AsistenciaDocente.objects.filter(docente=docente)
        .select_related("clase__comision__turno")
        .order_by("-registrado_en")[:20]
    )

    historial = [
        DocenteHistorialOut(
            fecha=format_date(registro.clase.fecha),
            turno=registro.clase.comision.turno.nombre if registro.clase.comision.turno_id else "",
            estado=registro.get_estado_display(),
            observacion=registro.observaciones or None,
        )
        for registro in historial_qs
    ]

    return DocenteClasesResponse(
        docente=DocenteInfoOut(nombre=f"{docente.apellido}, {docente.nombre}", dni=docente.dni),
        clases=clases_out,
        historial=historial,
    )

@router.post("/clases/{clase_id}/marcar-presente", response=DocenteMarcarPresenteOut)
def marcar_docente_presente(request: HttpRequest, clase_id: int, payload: DocenteMarcarPresenteIn):
    clase = (
        ClaseProgramada.objects.select_related("docente", "comision")
        .filter(id=clase_id)
        .first()
    )
    if not clase:
        raise HttpError(404, "La clase indicada no existe.")

    docente = clase.docente
    if not docente or docente.dni != payload.dni:
        raise HttpError(400, "El DNI no corresponde al docente asignado a la clase.")

    asistencia, _ = AsistenciaDocente.objects.get_or_create(
        clase=clase,
        docente=docente,
        defaults={
            "estado": AsistenciaDocente.Estado.AUSENTE,
            "registrado_via": AsistenciaDocente.RegistradoVia.DOCENTE,
        },
    )

    ventanas = _calcular_ventanas(clase)
    turno_nombre = clase.comision.turno.nombre if clase.comision and clase.comision.turno_id else ""
    ahora = timezone.now()
    if settings.USE_TZ:
        ahora = timezone.localtime(ahora)
    alerta = False
    alerta_tipo = ""
    alerta_motivo = ""
    categoria = AsistenciaDocente.MarcacionCategoria.NORMAL
    detalle_log = "Presente registrado"
    roles_usuario = get_user_roles(getattr(request, "user", None))
    staff_override = payload.via == "staff" or bool(roles_usuario & {"admin", "secretaria", "bedel"})

    if ventanas[0] and ventanas[1] and ventanas[2]:
        ventana_inicio, umbral_tarde, ventana_fin, _ = ventanas
        if ahora < ventana_inicio:
            if not staff_override:
                registrar_log_docente(
                    dni=payload.dni,
                    resultado=DocenteMarcacionLog.Resultado.RECHAZADO,
                    docente=docente,
                    clase=clase,
                    detalle="Intento antes de la ventana permitida",
                )
                raise HttpError(400, "Todavia no podes marcar tu asistencia en este turno.")
            alerta = True
            alerta_tipo = "fuera_de_ventana"
            alerta_motivo = f"Marcacion anticipada registrada por staff a las {ahora.strftime('%H:%M:%S')}"
            detalle_log = "Marcacion anticipada (staff)"
        if ahora > ventana_fin:
            if not staff_override:
                alerta = True
                alerta_tipo = "carga_diferida"
                categoria = AsistenciaDocente.MarcacionCategoria.DIFERIDA
                alerta_motivo = f"Carga diferida registrada a las {ahora.strftime('%H:%M:%S')}"
                detalle_log = "Carga diferida"
            else:
                alerta = True
                alerta_tipo = "fuera_de_ventana"
                alerta_motivo = f"Marcacion posterior registrada por staff a las {ahora.strftime('%H:%M:%S')}"
                detalle_log = "Marcacion posterior (staff)"
        elif ahora > umbral_tarde:
            alerta = True
            alerta_tipo = "llegada_tarde"
            categoria = AsistenciaDocente.MarcacionCategoria.TARDE
            alerta_motivo = f"Llegada registrada a las {ahora.strftime('%H:%M:%S')}"
            detalle_log = "Llegada tarde"

    asistencia.estado = AsistenciaDocente.Estado.PRESENTE
    asistencia.observaciones = payload.observaciones or ""
    asistencia.justificacion = None
    asistencia.registrado_via = (
        AsistenciaDocente.RegistradoVia.STAFF if payload.via == "staff" else AsistenciaDocente.RegistradoVia.DOCENTE
    )
    asistencia.registrado_por = request.user if request.user and request.user.is_authenticated else None
    asistencia.registrado_en = timezone.now()
    asistencia.marcada_en_turno = turno_nombre
    asistencia.marcacion_categoria = categoria
    asistencia.alerta = alerta
    asistencia.alerta_tipo = alerta_tipo
    asistencia.alerta_motivo = alerta_motivo
    asistencia.save(
        update_fields=[
            "estado",
            "observaciones",
            "justificacion",
            "registrado_via",
            "registrado_por",
            "registrado_en",
            "marcada_en_turno",
            "marcacion_categoria",
            "alerta",
            "alerta_tipo",
            "alerta_motivo",
        ]
    )

    registrar_log_docente(
        dni=payload.dni,
        resultado=DocenteMarcacionLog.Resultado.ACEPTADO,
        docente=docente,
        clase=clase,
        detalle=detalle_log,
        alerta=alerta,
    )

    if payload.propagar_turno:
        from .services import propagar_asistencia_docente_turno
        propagar_asistencia_docente_turno(
            clase_origen=clase,
            docente=docente,
            estado_origen=asistencia.estado,
            registrado_por=asistencia.registrado_por,
            observaciones=asistencia.observaciones,
            marcacion_categoria=asistencia.marcacion_categoria,
            alerta=asistencia.alerta,
            alerta_tipo=asistencia.alerta_tipo,
            alerta_motivo=asistencia.alerta_motivo,
        )

    return DocenteMarcarPresenteOut(
        clase_id=clase.id,
        estado=asistencia.estado,
        registrada_en=format_datetime(asistencia.registrado_en),
        categoria=asistencia.marcacion_categoria,
        alerta=alerta,
        alerta_tipo=alerta_tipo or None,
        alerta_motivo=alerta_motivo or None,
        mensaje=alerta_motivo or None,
        turno=turno_nombre or None,
    )

@router.post("/dni-log", response=None, auth=None)
def registrar_dni_intent(request: HttpRequest, payload: DocenteDniLogIn):
    # This endpoint seems to only log attempts, and doesn't return data.
    docente = Docente.objects.filter(persona__dni=payload.dni).first()
    registrar_log_docente(
        dni=payload.dni,
        resultado=DocenteMarcacionLog.Resultado.INFO,
        docente=docente,
        detalle=f"Intento de ingreso por DNI (Teclado/QR). App: {payload.app_version or 'unknown'}",
    )
    return 200, None
