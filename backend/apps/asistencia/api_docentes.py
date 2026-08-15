from datetime import date, datetime, timedelta

from django.conf import settings
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.common.date_utils import format_date, format_datetime
from core.auth_ninja import JWTAuth
from core.models import Docente
from core.permissions import can

from .api_helpers import (
    _build_horario,
    _calcular_ventanas,
)
from .cargos_models import (
    AsistenciaCargoDocente,
    CargoDocente,
    HorarioCargo,
)
from .models import (
    AsistenciaDocente,
    ClaseProgramada,
    DocenteMarcacionLog,
)
from .schemas import (
    DocenteClaseOut,
    DocenteClasesResponse,
    DocenteDniLogIn,
    DocenteHistorialOut,
    DocenteInfoOut,
    DocenteMarcarPresenteIn,
    DocenteMarcarPresenteOut,
    DocenteMisAsistenciasOut,
    IniciarPinResponse,
    KioskBulkMarcarIn,
    KioskBulkMarcarOut,
)
from .services import (
    TOLERANCIA_ANTERIOR_MINUTOS,
    TOLERANCIA_TARDE_MINUTOS,
    generate_classes_for_range,
    propagar_asistencia_docente_turno,
    registrar_log_docente,
)

router = Router(tags=["asistencia-docentes"], auth=JWTAuth())


def _docente_nombre(docente):
    return f"{docente.apellido}, {docente.nombre}"


@router.get("/mis-asistencias", response=list[DocenteMisAsistenciasOut])
def listar_mis_asistencias(
    request: HttpRequest,
    fecha: date | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    materia_id: int | None = None,
    estado: str | None = None,
):
    if not request.user.is_authenticated:
        raise HttpError(401, "Autenticación requerida.")

    docente = Docente.objects.filter(persona__dni=request.user.username).first()
    if not docente:
        raise HttpError(404, "No se encontró un perfil de docente asociado a tu usuario.")

    asistencias = (
        AsistenciaDocente.objects.filter(docente=docente)
        .select_related("clase", "clase__comision", "clase__comision__materia", "clase__comision__turno")
        .order_by("-clase__fecha", "-clase__hora_inicio")
    )

    if fecha:
        asistencias = asistencias.filter(clase__fecha=fecha)
    else:
        if desde:
            asistencias = asistencias.filter(clase__fecha__gte=desde)
        if hasta:
            asistencias = asistencias.filter(clase__fecha__lte=hasta)

    if materia_id:
        asistencias = asistencias.filter(clase__comision__materia_id=materia_id)

    if estado:
        if estado.lower() == "tarde":
            asistencias = asistencias.filter(
                estado=AsistenciaDocente.Estado.PRESENTE, marcacion_categoria=AsistenciaDocente.MarcacionCategoria.TARDE
            )
        elif estado.lower() == "presente":
            asistencias = asistencias.filter(
                estado=AsistenciaDocente.Estado.PRESENTE,
                marcacion_categoria=AsistenciaDocente.MarcacionCategoria.NORMAL,
            )
        elif estado.lower() == "ausente":
            asistencias = asistencias.filter(estado=AsistenciaDocente.Estado.AUSENTE)

    data = []
    for asist in asistencias:
        turno_nombre = (
            asist.clase.comision.turno.nombre if asist.clase.comision.turno_id else (asist.marcada_en_turno or "N/A")
        )
        horario = _build_horario(asist.clase.hora_inicio, asist.clase.hora_fin)

        data.append(
            DocenteMisAsistenciasOut(
                id=asist.id,
                fecha=format_date(asist.clase.fecha),
                espacio_curricular=asist.clase.comision.materia.nombre,
                comision=asist.clase.comision.codigo,
                horario=horario,
                turno=turno_nombre,
                estado=asist.estado,
                categoria=asist.marcacion_categoria,
                observacion=asist.observaciones or None,
            )
        )

    return data


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

    is_admin_staff = can(request.user, "asistencia_docentes_editar")

    if not is_admin_staff and request.user.username != dni:
        raise HttpError(403, "No tenés permisos para consultar el horario de otro docente.")

    docente = Docente.objects.filter(persona__dni=dni).first()
    if not docente:
        raise HttpError(404, "No se encontró un docente con ese DNI.")

    comision_ids = list(docente.comisiones.values_list("id", flat=True))
    if comision_ids:
        generate_classes_for_range(desde, hasta, comision_ids=comision_ids)

    fechas = [desde + timedelta(days=i) for i in range((hasta - desde).days + 1)]

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
        registro.clase_id: registro for registro in AsistenciaDocente.objects.filter(clase__in=clases, docente=docente)
    }

    puede_editar_staff = can(request.user, "asistencia_docentes_editar")

    now = timezone.now()
    current_time = timezone.localtime(now) if settings.USE_TZ else now
    clases_out: list[DocenteClaseOut] = []
    for clase in clases:
        ventana_inicio, umbral_tarde, ventana_fin, turno_nombre = _calcular_ventanas(clase)
        if not turno_nombre:
            turno_nombre = clase.comision.turno.nombre if clase.comision and clase.comision.turno_id else ""
        asistencia = asistencias.get(clase.id)
        puede_marcar = clase.estado != ClaseProgramada.Estado.CANCELADA
        if puede_marcar and not puede_editar_staff and ventana_inicio and ventana_fin:
            puede_marcar = ventana_inicio <= current_time <= ventana_fin
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
                ya_registrada=bool(asistencia and asistencia.estado == AsistenciaDocente.Estado.PRESENTE),
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

    historial = []
    historial_qs = (
        AsistenciaDocente.objects.filter(docente=docente)
        .select_related("clase__comision__turno")
        .order_by("-registrado_en")[:20]
    )

    for a in historial_qs:
        historial.append(
            DocenteHistorialOut(
                fecha=format_date(a.clase.fecha),
                turno=a.clase.comision.turno.nombre if a.clase.comision and a.clase.comision.turno_id else "N/A",
                estado=a.get_estado_display(),
                observacion=a.observaciones,
            )
        )

    # --- Agregar Horarios de Cargo ---
    if fechas:
        cargos_docente = CargoDocente.objects.filter(docente=docente, activo=True, cargo__activo=True).select_related(
            "cargo"
        )

        for cd in cargos_docente:
            horarios_cargo = HorarioCargo.objects.filter(cargo=cd.cargo)
            for hc in horarios_cargo:
                for f in fechas:
                    db_dia = f.weekday()
                    if hc.dia_semana == db_dia:
                        if dia_semana is not None and hc.dia_semana != dia_semana:
                            continue

                        asistencia_cargo = AsistenciaCargoDocente.objects.filter(cargo_docente=cd, fecha=f).first()

                        ya_registrada = bool(
                            asistencia_cargo and asistencia_cargo.estado != AsistenciaCargoDocente.Estado.AUSENTE
                        )

                        base_inicio = datetime.combine(f, hc.hora_inicio)
                        base_fin = datetime.combine(f, hc.hora_fin)
                        if settings.USE_TZ:
                            tz = timezone.get_current_timezone()
                            ventana_inicio = timezone.make_aware(
                                base_inicio - timedelta(minutes=TOLERANCIA_ANTERIOR_MINUTOS), tz
                            )
                            umbral_tarde = timezone.make_aware(
                                base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS), tz
                            )
                            ventana_fin = timezone.make_aware(base_fin, tz)
                        else:
                            ventana_inicio = base_inicio - timedelta(minutes=TOLERANCIA_ANTERIOR_MINUTOS)
                            umbral_tarde = base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS)
                            ventana_fin = base_fin

                        puede_marcar = False
                        if current_time and not ya_registrada:
                            puede_marcar = ventana_inicio <= current_time <= ventana_fin

                        clases_out.append(
                            DocenteClaseOut(
                                id=hc.id,
                                es_cargo=True,
                                cargo_docente_id=cd.id,
                                fecha=format_date(f),
                                comision_id=None,
                                materia=hc.cargo.nombre,
                                materia_id=0,
                                comision=hc.cargo.codigo_cargo,
                                turno="Cargo",
                                horario=_build_horario(hc.hora_inicio, hc.hora_fin),
                                aula="",
                                puede_marcar=puede_marcar,
                                editable_staff=True,
                                ya_registrada=ya_registrada,
                                registrada_en=format_datetime(asistencia_cargo.registrado_en)
                                if asistencia_cargo and asistencia_cargo.registrado_en
                                else None,
                                ventana_inicio=ventana_inicio.strftime("%H:%M") if ventana_inicio else None,
                                ventana_fin=ventana_fin.strftime("%H:%M") if ventana_fin else None,
                                umbral_tarde=umbral_tarde.strftime("%H:%M") if umbral_tarde else None,
                                plan_id=None,
                                plan_resolucion="",
                                profesorado_id=None,
                                profesorado_nombre="",
                            )
                        )

                        if asistencia_cargo:
                            historial.append(
                                DocenteHistorialOut(
                                    fecha=format_date(asistencia_cargo.fecha),
                                    turno="Cargo",
                                    estado=asistencia_cargo.get_estado_display(),
                                    observacion=asistencia_cargo.observaciones,
                                )
                            )

    return DocenteClasesResponse(
        docente=DocenteInfoOut(nombre=_docente_nombre(docente), dni=docente.dni),
        clases=clases_out,
        historial=sorted(historial, key=lambda x: x.fecha, reverse=True),
    )


@router.post("/clases/{clase_id}/iniciar-pin", response=IniciarPinResponse)
def iniciar_pin_asistencia(request: HttpRequest, clase_id: int):
    import random

    clase = ClaseProgramada.objects.select_related("docente", "comision").filter(id=clase_id).first()
    if not clase:
        raise HttpError(404, "La clase indicada no existe.")

    is_admin_staff = can(request.user, "asistencia_docentes_editar")
    if not is_admin_staff and (not clase.docente or clase.docente.persona.dni != request.user.username):
        raise HttpError(403, "No tenés permiso para iniciar asistencia en esta clase.")

    if clase.estado == ClaseProgramada.Estado.CANCELADA:
        raise HttpError(400, "No se puede iniciar asistencia en una clase cancelada.")

    pin = str(random.randint(1000, 9999))
    clase.pin_asistencia = pin
    clase.pin_expira_en = timezone.now() + timedelta(minutes=5)
    clase.save(update_fields=["pin_asistencia", "pin_expira_en", "actualizado_en"])

    return IniciarPinResponse(
        pin=pin,
        expira_en=clase.pin_expira_en,
        duracion_minutos=5,
    )


@router.post("/clases/{clase_id}/marcar-presente", response=DocenteMarcarPresenteOut)
def marcar_docente_presente(request: HttpRequest, clase_id: int, payload: DocenteMarcarPresenteIn):
    clase = ClaseProgramada.objects.select_related("docente", "comision").filter(id=clase_id).first()
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
    staff_override = can(request.user, "asistencia_docentes_editar")

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
        AsistenciaDocente.RegistradoVia.STAFF
        if (payload.via == "staff" and staff_override)
        else AsistenciaDocente.RegistradoVia.DOCENTE
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

    mensaje = alerta_motivo or None

    return DocenteMarcarPresenteOut(
        clase_id=clase.id,
        estado=asistencia.estado,
        registrada_en=format_datetime(asistencia.registrado_en) if asistencia.registrado_en else "",
        categoria=asistencia.marcacion_categoria,
        alerta=alerta,
        alerta_tipo=alerta_tipo or None,
        alerta_motivo=alerta_motivo or None,
        mensaje=mensaje,
        turno=turno_nombre or None,
    )


@router.post("/kiosk-marcar-bulk", response=KioskBulkMarcarOut)
def kiosk_marcar_bulk(request, payload: KioskBulkMarcarIn):
    """
    Registra asistencia (masivamente) para las clases y cargos enviados en el payload.
    Pensado para el Kiosco, cuando el docente ingresa su DNI y se marcan múltiples ítems a la vez.
    """
    docente = get_object_or_404(Docente, persona__dni=payload.dni)
    user = getattr(request, "user", None)
    registrado_por = user if (user and user.is_authenticated) else None

    # Normalizar tz
    current_time = timezone.now()
    if settings.USE_TZ:
        current_time = timezone.localtime(current_time)

    fecha_hoy = current_time.date()

    hubo_alerta = False
    mensajes = []

    for item in payload.items:
        if item.es_cargo:
            horario = get_object_or_404(HorarioCargo, id=item.id)
            cargo_docente = get_object_or_404(CargoDocente, docente=docente, cargo=horario.cargo, activo=True)

            # Chequear ventanas de tiempo
            base_inicio = datetime.combine(fecha_hoy, horario.hora_inicio)
            base_fin = datetime.combine(fecha_hoy, horario.hora_fin)
            if settings.USE_TZ:
                tz = timezone.get_current_timezone()
                umbral_tarde = timezone.make_aware(base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS), tz)
            else:
                umbral_tarde = base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS)

            estado = AsistenciaCargoDocente.Estado.PRESENTE
            alerta = False

            if current_time > umbral_tarde:
                estado = AsistenciaCargoDocente.Estado.TARDE
                hubo_alerta = True
                alerta = True
                mensajes.append(f"Llegada tarde en {horario.cargo.nombre}.")
            else:
                mensajes.append(f"Presente en {horario.cargo.nombre}.")

            # Registrar
            AsistenciaCargoDocente.objects.update_or_create(
                cargo_docente=cargo_docente,
                fecha=fecha_hoy,
                defaults={
                    "estado": estado,
                    "horario": horario,
                    "observaciones": payload.observaciones or "",
                    "registrado_por": registrado_por,
                },
            )

            registrar_log_docente(
                dni=payload.dni,
                resultado=DocenteMarcacionLog.Resultado.ACEPTADO,
                docente=docente,
                clase=None,
                detalle=f"Cargo {horario.cargo.codigo_cargo}",
                alerta=alerta,
                origen="kiosk",
            )

        else:
            # Es ClaseProgramada
            clase = get_object_or_404(ClaseProgramada, id=item.id)
            if clase.docente_id != docente.id:
                mensajes.append(f"Error: La clase {clase.id} no pertenece al docente.")
                continue

            ventana_inicio, umbral_tarde, ventana_fin, turno_nombre = _calcular_ventanas(clase)

            estado = AsistenciaDocente.Estado.PRESENTE
            categoria = AsistenciaDocente.MarcacionCategoria.NORMAL
            alerta = False
            alerta_tipo = ""
            alerta_motivo = ""

            if umbral_tarde and current_time > umbral_tarde:
                estado = AsistenciaDocente.Estado.TARDE
                categoria = AsistenciaDocente.MarcacionCategoria.TARDE
                alerta = True
                alerta_tipo = "llegada_tarde"
                alerta_motivo = f"Llegada tarde ({current_time.strftime('%H:%M')})"
                hubo_alerta = True
                mensajes.append(f"Llegada tarde en {clase.comision.materia.nombre}.")
            else:
                mensajes.append(f"Presente en {clase.comision.materia.nombre}.")

            asistencia, _ = AsistenciaDocente.objects.get_or_create(
                clase=clase,
                docente=docente,
                defaults={
                    "estado": estado,
                    "registrado_via": AsistenciaDocente.RegistradoVia.SISTEMA
                    if payload.via == "staff"
                    else AsistenciaDocente.RegistradoVia.APP_DOCENTE,
                },
            )
            asistencia.estado = estado
            asistencia.observaciones = payload.observaciones or ""
            asistencia.registrado_via = (
                AsistenciaDocente.RegistradoVia.SISTEMA
                if payload.via == "staff"
                else AsistenciaDocente.RegistradoVia.APP_DOCENTE
            )
            asistencia.registrado_por = registrado_por
            asistencia.registrado_en = current_time
            asistencia.marcacion_categoria = categoria
            asistencia.alerta = alerta
            asistencia.alerta_tipo = alerta_tipo
            asistencia.alerta_motivo = alerta_motivo
            asistencia.save()

            registrar_log_docente(
                dni=payload.dni,
                resultado=DocenteMarcacionLog.Resultado.ACEPTADO,
                docente=docente,
                clase=clase,
                detalle=f"Clase: {clase.id}",
                alerta=alerta,
                origen="kiosk",
            )

            # Propagamos si la primer clase es ok
            propagar_asistencia_docente_turno(
                clase_origen=clase,
                docente=docente,
                estado_origen=estado,
                registrado_por=registrado_por,
                observaciones=payload.observaciones or "",
                marcacion_categoria=categoria,
                alerta=alerta,
                alerta_tipo=alerta_tipo,
                alerta_motivo=alerta_motivo,
            )

    return KioskBulkMarcarOut(
        estado_general="TARDE" if hubo_alerta else "PRESENTE", alerta=hubo_alerta, mensajes=mensajes
    )


def check_kiosk_key(request):
    """Valida que la petición provenga de un dispositivo físico autorizado."""
    key = request.headers.get("X-Kiosk-Key")
    if not key or key != settings.KIOSK_API_KEY:
        raise HttpError(401, "Kiosk key inválida o ausente.")


@router.post("/dni-log", response=None, auth=None)
def registrar_dni_intent(request: HttpRequest, payload: DocenteDniLogIn):
    check_kiosk_key(request)
    # Este endpoint solo registra intentos históricos/debug
    docente = Docente.objects.filter(persona__dni=payload.dni).first()
    registrar_log_docente(
        dni=payload.dni,
        resultado=DocenteMarcacionLog.Resultado.TYPING,
        docente=docente,
        detalle=f"Intento de ingreso por DNI (Teclado/QR). App: {payload.app_version or 'unknown'}",
    )
    return 200, None
