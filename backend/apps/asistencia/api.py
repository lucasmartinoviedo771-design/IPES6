from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from django.db.models import Count, Q
from ninja import Router
from ninja.errors import HttpError

from core.models import (
    Comision,
    Docente,
    Estudiante,
    PlanDeEstudio,
    Profesorado,
    Turno,
    StaffAsignacion,
)
from core.auth_ninja import JWTAuth

from .models import (
    AsistenciaAlumno,
    AsistenciaDocente,
    ClaseProgramada,
    CalendarioAsistenciaEvento,
    CursoAlumnoSnapshot,
    DocenteMarcacionLog,
    Justificacion,
)
from .schemas import (
    AlumnoResumenOut,
    AlumnoClasesResponse,
    AlumnoClaseListadoOut,
    AsistenciaCalendarioEventoIn,
    AsistenciaCalendarioEventoOut,
    ClaseAlumnoDetalleOut,
    DocenteClasesResponse,
    DocenteHistorialOut,
    DocenteInfoOut,
    DocenteClaseOut,
    DocenteMarcarPresenteIn,
    DocenteMarcarPresenteOut,
    DocenteDniLogIn,
    RegistrarAsistenciaAlumnosIn,
    JustificacionCreateIn,
    JustificacionDetailOut,
    JustificacionListItemOut,
    JustificacionOut,
    JustificacionRechazarIn,
    AlumnoAsistenciaItemOut,
)
from .services import (
    apply_justification,
    attach_classes_to_justification,
    calcular_ventanas_turno,
    generate_classes_for_date,
    generate_classes_for_range,
    registrar_log_docente,
    sync_course_snapshots,
)


docentes_router = Router(tags=["asistencia-docentes"])
alumnos_router = Router(tags=["asistencia-alumnos"])
calendario_router = Router(tags=["asistencia-calendario"])


def _normalized_user_roles(user) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    roles = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    if getattr(user, "is_staff", False):
        roles.add("admin")
    if getattr(user, "is_superuser", False):
        roles.add("admin")
    return roles


def _staff_profesorados(user, roles: set[str]) -> set[int]:
    if not user or not user.is_authenticated:
        return set()
    if not roles & {"bedel", "coordinador", "tutor"}:
        return set()
    asignaciones = StaffAsignacion.objects.filter(
        user=user,
        rol__in=[rol for rol in StaffAsignacion.Rol.values if rol in roles],
    )
    return set(asignaciones.values_list("profesorado_id", flat=True))


def _docente_from_user(user) -> Docente | None:
    if not user or not user.is_authenticated:
        return None
    lookup = Q()
    username = (getattr(user, "username", "") or "").strip()
    if username:
        lookup |= Q(dni__iexact=username)
    email = (getattr(user, "email", "") or "").strip()
    if email:
        lookup |= Q(email__iexact=email)
    if not lookup:
        return None
    return Docente.objects.filter(lookup).first()


def _get_profesorado_id_from_comision(comision: Comision) -> int | None:
    materia = getattr(comision, "materia", None)
    if not materia:
        return None
    plan = getattr(materia, "plan_de_estudio", None)
    if not plan:
        return None
    return plan.profesorado_id


def _resolve_scope(request: HttpRequest) -> tuple[set[str], set[int], Docente | None]:
    user = getattr(request, "user", None)
    roles = _normalized_user_roles(user)
    staff_profesorados = _staff_profesorados(user, roles)
    docente_profile = _docente_from_user(user)
    return roles, staff_profesorados, docente_profile


def _ensure_authenticated_scope(roles: set[str], docente_profile: Docente | None):
    if not roles and not docente_profile:
        raise HttpError(401, "AutenticaciA AA12n requerida.")


def _scope_profesorado_ids(scope: dict[str, object | None]) -> set[int]:
    ids: set[int] = set()
    profesorado = scope.get("profesorado")
    if profesorado:
        ids.add(profesorado.id)
    plan = scope.get("plan")
    if plan:
        ids.add(plan.profesorado_id)
    comision = scope.get("comision")
    if comision:
        materia = getattr(comision, "materia", None)
        if materia and getattr(materia, "plan_de_estudio", None):
            ids.add(materia.plan_de_estudio.profesorado_id)
    return ids



def _calendario_queryset_with_scope(
    queryset,
    roles: set[str],
    staff_profesorados: set[int],
    docente_profile: Docente | None,
):
    if roles & {"admin", "secretaria"}:
        return queryset
    filters = Q()
    if staff_profesorados:
        filters |= Q(profesorado_id__in=staff_profesorados)
        filters |= Q(plan__profesorado_id__in=staff_profesorados)
        filters |= Q(comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados)
    if docente_profile:
        filters |= Q(docente=docente_profile) | Q(comision__docente=docente_profile)
    filters |= Q(profesorado__isnull=True, plan__isnull=True, comision__isnull=True)
    if filters == Q(profesorado__isnull=True, plan__isnull=True, comision__isnull=True):
        raise HttpError(403, "No tenes permisos suficientes para consultar el calendario.")
    return queryset.filter(filters).distinct()



def _ensure_calendar_manage_scope(
    roles: set[str],
    staff_profesorados: set[int],
    scope: dict[str, object | None],
) -> None:
    if roles & {"admin", "secretaria"}:
        return
    if "bedel" in roles:
        if not staff_profesorados:
            raise HttpError(403, "No tenes profesorados asignados.")
        target_ids = _scope_profesorado_ids(scope)
        if not target_ids:
            raise HttpError(403, "Los bedeles solo pueden gestionar eventos asociados a un profesorado, plan o comision.")
        if not target_ids.issubset(staff_profesorados):
            raise HttpError(403, "No tenes permisos sobre el profesorado indicado.")
        return
    raise HttpError(403, "No tenes permisos para gestionar eventos de asistencia.")



def _turno_to_dict(turno: Turno | None) -> tuple[int | None, str | None]:
    if not turno:
        return None, None
    return turno.id, turno.nombre

def _docente_to_dict(docente: Docente | None) -> tuple[int | None, str | None]:
    if not docente:
        return None, None
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part).strip() or docente.dni
    return docente.id, nombre


def _resolver_event_scope(payload: AsistenciaCalendarioEventoIn):
    comision = None
    plan = None
    profesorado = None
    if getattr(payload, "comision_id", None):
        comision = (
            Comision.objects.select_related("materia__plan_de_estudio__profesorado")
            .filter(id=payload.comision_id)
            .first()
        )
        if not comision:
            raise HttpError(404, "La comisiAA3n indicada no existe.")
        materia = getattr(comision, "materia", None)
        if materia and materia.plan_de_estudio_id:
            plan = materia.plan_de_estudio
            profesorado = plan.profesorado
    if getattr(payload, "plan_id", None):
        plan_lookup = (
            PlanDeEstudio.objects.select_related("profesorado").filter(id=payload.plan_id).first()
        )
        if not plan_lookup:
            raise HttpError(404, "El plan de estudio indicado no existe.")
        if plan and plan.id != plan_lookup.id:
            raise HttpError(400, "La comisiAA3n seleccionada pertenece a otro plan de estudio.")
        plan = plan_lookup
        profesorado = plan.profesorado
    if getattr(payload, "profesorado_id", None):
        profes_lookup = Profesorado.objects.filter(id=payload.profesorado_id).first()
        if not profes_lookup:
            raise HttpError(404, "El profesorado indicado no existe.")
        if profesorado and profesorado.id != profes_lookup.id:
            raise HttpError(400, "El profesorado no coincide con el plan/comisiAA3n seleccionados.")
        profesorado = profes_lookup
    docente = None
    if getattr(payload, "docente_id", None):
        docente = Docente.objects.filter(id=payload.docente_id).first()
        if not docente:
            raise HttpError(404, "El docente indicado no existe.")
    return {"comision": comision, "plan": plan, "profesorado": profesorado, "docente": docente}


def _evento_to_schema(evento: CalendarioAsistenciaEvento) -> AsistenciaCalendarioEventoOut:
    turno_id, turno_nombre = _turno_to_dict(evento.turno)
    docente_id, docente_nombre = _docente_to_dict(evento.docente)
    profesorado_nombre = evento.profesorado.nombre if evento.profesorado_id else None
    plan_resolucion = evento.plan.resolucion if evento.plan_id else None
    comision_nombre = evento.comision.codigo if evento.comision_id else None
    return AsistenciaCalendarioEventoOut(
        id=evento.id,
        nombre=evento.nombre,
        tipo=evento.tipo,
        subtipo=evento.subtipo,
        fecha_desde=evento.fecha_desde,
        fecha_hasta=evento.fecha_hasta,
        turno_id=turno_id,
        turno_nombre=turno_nombre,
        profesorado_id=evento.profesorado_id,
        profesorado_nombre=profesorado_nombre,
        plan_id=evento.plan_id,
        plan_resolucion=plan_resolucion,
        comision_id=evento.comision_id,
        comision_nombre=comision_nombre,
        docente_id=docente_id,
        docente_nombre=docente_nombre,
        aplica_docentes=evento.aplica_docentes,
        aplica_estudiantes=evento.aplica_estudiantes,
        motivo=evento.motivo or None,
        activo=evento.activo,
        creado_en=evento.creado_en,
    )


def _build_horario(hora_inicio, hora_fin) -> str | None:
    if hora_inicio and hora_fin:
        return f"{hora_inicio.strftime('%H:%M')} AAA {hora_fin.strftime('%H:%M')}"
    if hora_inicio:
        return f"{hora_inicio.strftime('%H:%M')}"
    return None


def _calcular_ventanas(clase: ClaseProgramada):
    data = calcular_ventanas_turno(clase)
    if not data:
        return None, None, None, ""
    return data


@docentes_router.get("/{dni}/clases", response=DocenteClasesResponse)
def listar_clases_docente(
    request: HttpRequest,
    dni: str,
    fecha: date | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    dia_semana: int | None = None,
) -> DocenteClasesResponse:
    if fecha and (desde or hasta):
        raise HttpError(400, "No se puede combinar un dAAa puntual con un rango de fechas.")
    if dia_semana is not None and (dia_semana < 0 or dia_semana > 6):
        raise HttpError(400, "El dAAa de la semana debe estar entre 0 (lunes) y 6 (domingo).")

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

    docente = Docente.objects.filter(dni=dni).first()
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

    roles_usuario = _normalized_user_roles(getattr(request, "user", None))
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
                fecha=clase.fecha,
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
                registrada_en=asistencia.registrado_en if asistencia else None,
                ventana_inicio=ventana_inicio,
                ventana_fin=ventana_fin,
                umbral_tarde=umbral_tarde,
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
            fecha=registro.clase.fecha,
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


def _docente_nombre(docente: Docente) -> str:
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part).strip()
    return nombre or docente.dni


@docentes_router.post("/clases/{clase_id}/marcar-presente", response=DocenteMarcarPresenteOut)
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
    roles_usuario = _normalized_user_roles(getattr(request, "user", None))
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
            # Permitir carga diferida para docentes
            if not staff_override:
                # Antes se rechazaba, ahora se permite como DIFERIDA
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

    # Propagar asistencia a otras clases del turno (Solo si se solicita explA A citamente)
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
        registrada_en=asistencia.registrado_en,
        categoria=asistencia.marcacion_categoria,
        alerta=alerta,
        alerta_tipo=alerta_tipo or None,
        alerta_motivo=alerta_motivo or None,
        mensaje=alerta_motivo or None,
        turno=turno_nombre or None,
    )


@alumnos_router.get("/clases/{clase_id}", response=ClaseAlumnoDetalleOut)
def obtener_clase_alumnos(request: HttpRequest, clase_id: int) -> ClaseAlumnoDetalleOut:
    clase = (
        ClaseProgramada.objects.select_related(
            "comision",
            "comision__materia",
            "comision__turno",
            "docente",
        )
        .filter(id=clase_id)
        .first()
    )
    if not clase:
        raise HttpError(404, "No se encontrAA3 la clase requerida.")

    # Lazy Snapshot Sync: Verificar si los snapshots de esta comisiAA3n estA AAn actualizados
    # Si no hay snapshots o son muy viejos (> 24hs), forzamos una sincronizaciAA3n ahora.
    last_snapshot = CursoAlumnoSnapshot.objects.filter(comision_id=clase.comision_id).order_by("-sincronizado_en").first()
    should_sync = False
    if not last_snapshot:
        should_sync = True
    else:
        # Usamos timezone.now() para comparar
        now = timezone.now()
        diff = now - last_snapshot.sincronizado_en
        if diff > timedelta(hours=24):
            should_sync = True

    if should_sync:
        # Sincronizamos solo esta comisiAA3n para no afectar performance global
        sync_course_snapshots(comisiones=[clase.comision])
        # Re-verificamos asistencias vacA Aas (por si entraron alumnos nuevos)
        from .services import _ensure_asistencias_estudiantes
        _ensure_asistencias_estudiantes(clase)

    asistencias = list(
        AsistenciaAlumno.objects.filter(clase=clase)
        .select_related("estudiante__user")
        .order_by("estudiante__user__last_name", "estudiante__user__first_name")
    )

    # Calcular porcentajes de asistencia
    stats = (
        AsistenciaAlumno.objects.filter(clase__comision_id=clase.comision_id)
        .values("estudiante_id")
        .annotate(
            total=Count("id"),
            presentes=Count(
                "id",
                filter=Q(estado__in=[AsistenciaAlumno.Estado.PRESENTE, AsistenciaAlumno.Estado.TARDE])
            ),
        )
    )
    stats_map = {s["estudiante_id"]: s for s in stats}

    alumnos = []
    for asistencia in asistencias:
        stat = stats_map.get(asistencia.estudiante_id, {"total": 0, "presentes": 0})
        total = stat["total"]
        presentes = stat["presentes"]
        porcentaje = (presentes / total * 100) if total > 0 else 0.0
        
        alumnos.append(
            AlumnoResumenOut(
                estudiante_id=asistencia.estudiante_id,
                dni=asistencia.estudiante.dni,
                nombre=asistencia.estudiante.user.first_name if asistencia.estudiante.user_id else "",
                apellido=asistencia.estudiante.user.last_name if asistencia.estudiante.user_id else "",
                estado=asistencia.estado,
                justificada=asistencia.justificacion_id is not None,
                porcentaje_asistencia=round(porcentaje, 1),
            )
        )

    docentes = []
    docente_presente = False
    docente_categoria = None
    
    if clase.docente:
        docentes.append(_docente_nombre(clase.docente))
        # Verificamos si estA A1 presente
        asistencia_doc = AsistenciaDocente.objects.filter(
            clase=clase,
            docente=clase.docente,
            estado=AsistenciaDocente.Estado.PRESENTE
        ).first()
        
        if asistencia_doc:
            docente_presente = True
            docente_categoria = asistencia_doc.marcacion_categoria

    # Obtener otras clases de la misma comisiA A3n para el selector
    otras_clases_qs = (
        ClaseProgramada.objects.filter(
            comision_id=clase.comision_id,
            fecha__lte=timezone.now().date()  # Solo mostrar pasadas y presente
        )
        .order_by("-fecha")[:20]  # Limitar a las A Altimas 20
    )
    
    otras_clases = [
        ClaseNavegacionOut(
            id=c.id,
            fecha=c.fecha,
            descripcion=f"Clase del {c.fecha.strftime('%d/%m')}",
            actual=(c.id == clase.id)
        )
        for c in otras_clases_qs
    ]

    return ClaseAlumnoDetalleOut(
        clase_id=clase.id,
        comision=str(clase.comision),
        fecha=clase.fecha,
        horario=f"{clase.hora_inicio.strftime('%H:%M')} - {clase.hora_fin.strftime('%H:%M')}" if clase.hora_inicio and clase.hora_fin else None,
        materia=str(clase.comision.materia) if clase.comision.materia else str(clase.comision),
        docentes=docentes,
        docente_presente=docente_presente,
        docente_categoria_asistencia=docente_categoria,
        alumnos=alumnos,
        otras_clases=otras_clases,
    )


@alumnos_router.get("/clases", response=AlumnoClasesResponse)
def listar_clases_alumnos(
    request: HttpRequest,
    comision_id: int | None = None,
    materia_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> AlumnoClasesResponse:
    if not comision_id and not materia_id:
        raise HttpError(400, "DebAAs indicar una comisiAA3n o una materia para filtrar.")

    desde = desde or date.today()
    hasta = hasta or desde
    if desde > hasta:
        raise HttpError(400, "La fecha 'desde' no puede ser posterior a 'hasta'.")

    comisiones_qs = Comision.objects.all()
    if comision_id:
        comisiones_qs = comisiones_qs.filter(id=comision_id)
    if materia_id:
        comisiones_qs = comisiones_qs.filter(materia_id=materia_id)

    roles = _normalized_user_roles(getattr(request, "user", None))
    if not roles:
        raise HttpError(401, "AutenticaciAA3n requerida.")

    if not roles & {"admin", "secretaria"}:
        profesorados_limit = _staff_profesorados(getattr(request, "user", None), roles)
        if profesorados_limit:
            comisiones_qs = comisiones_qs.filter(materia__profesorado_id__in=profesorados_limit)
        elif roles & {"bedel", "coordinador", "tutor"}:
            raise HttpError(403, "No tenAAs profesorados asignados para consultar asistencia.")

    comision_ids = list(comisiones_qs.values_list("id", flat=True))
    if not comision_ids:
        return AlumnoClasesResponse(clases=[])

    # Lazy Sync para estudiantes tambiA A9n
    # Verificamos si alguna de las comisiones solicitadas necesita actualizaciAA3n
    # OptimizaciAA3n: Solo chequeamos la primera para no hacer N queries, o chequeamos todas si son pocas.
    # Como comision_ids suele ser 1 (filtrado por comision_id) o pocas (filtrado por materia), podemos iterar.
    comisiones_a_sincronizar = []
    now = timezone.now()
    for cid in comision_ids:
        last_snap = CursoAlumnoSnapshot.objects.filter(comision_id=cid).order_by("-sincronizado_en").first()
        if not last_snap or (now - last_snap.sincronizado_en) > timedelta(hours=24):
            comisiones_a_sincronizar.append(cid)
    
    if comisiones_a_sincronizar:
        # Recuperamos los objetos Comision para pasar al servicio
        objs = Comision.objects.filter(id__in=comisiones_a_sincronizar)
        sync_course_snapshots(comisiones=objs)

    generate_classes_for_range(desde, hasta, comision_ids=comision_ids)

    clases_qs = (
        ClaseProgramada.objects.filter(comision_id__in=comision_ids, fecha__range=(desde, hasta))
        .select_related("comision", "comision__materia", "comision__turno")
        .annotate(
            total_alumnos=Count("asistencias_estudiantes"),
            presentes=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaAlumno.Estado.PRESENTE),
            ),
            ausentes=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaAlumno.Estado.AUSENTE),
            ),
            ausentes_justificados=Count(
                "asistencias_estudiantes",
                filter=Q(asistencias_estudiantes__estado=AsistenciaAlumno.Estado.AUSENTE_JUSTIFICADA),
            ),
        )
        .order_by("fecha", "comision__materia__nombre", "comision__codigo", "hora_inicio")
    )

    clases_out = [
        AlumnoClaseListadoOut(
            clase_id=clase.id,
            fecha=clase.fecha,
            materia=clase.comision.materia.nombre,
            comision=clase.comision.codigo,
            turno=clase.comision.turno.nombre if clase.comision.turno_id else None,
            horario=_build_horario(clase.hora_inicio, clase.hora_fin),
            estado_clase=clase.estado,
            total_alumnos=clase.total_alumnos or 0,
            presentes=clase.presentes or 0,
            ausentes=clase.ausentes or 0,
            ausentes_justificados=clase.ausentes_justificados or 0,
        )
        for clase in clases_qs
    ]

    return AlumnoClasesResponse(clases=clases_out)


@alumnos_router.post("/clases/{clase_id}/registrar", response=None)
def registrar_asistencia_alumnos(request: HttpRequest, clase_id: int, payload: RegistrarAsistenciaAlumnosIn):
    clase = ClaseProgramada.objects.filter(id=clase_id).first()
    if not clase:
        raise HttpError(404, "No se encontrAA3 la clase indicada.")

    presentes = set(payload.presentes)
    tardes = set(payload.tardes)
    
    # ValidaciAA3n: El docente debe haber marcado su asistencia primero
    # Solo aplicamos esto si el usuario es el docente titular de la clase (no staff/admin)
    roles = _normalized_user_roles(getattr(request, "user", None))
    es_staff = bool(roles & {"admin", "secretaria", "bedel"})
    
    if not es_staff:
        docente_profile = _docente_from_user(request.user)
        if docente_profile and clase.docente_id == docente_profile.id:
            docente_presente = AsistenciaDocente.objects.filter(
                clase=clase,
                docente=docente_profile,
                estado=AsistenciaDocente.Estado.PRESENTE
            ).exists()
            if not docente_presente:
                raise HttpError(400, "DebAAs registrar tu propia asistencia (Presente) antes de cargar la de los estudiantes.")

    registros = AsistenciaAlumno.objects.filter(clase=clase).select_related("estudiante")

    for registro in registros:
        estado_nuevo = AsistenciaAlumno.Estado.AUSENTE
        if registro.estudiante_id in presentes:
            estado_nuevo = AsistenciaAlumno.Estado.PRESENTE
        elif registro.estudiante_id in tardes:
            estado_nuevo = AsistenciaAlumno.Estado.TARDE
            
        if registro.justificacion_id:
            estado_nuevo = AsistenciaAlumno.Estado.AUSENTE_JUSTIFICADA
            
        if registro.estado != estado_nuevo:
            registro.estado = estado_nuevo
            registro.registrado_via = AsistenciaAlumno.RegistradoVia.STAFF
            registro.registrado_por = request.user if request.user and request.user.is_authenticated else None
            registro.save(update_fields=["estado", "registrado_via", "registrado_por", "registrado_en"])




@alumnos_router.get("/mis-asistencias", response=List[AlumnoAsistenciaItemOut])
def listar_mis_asistencias(request: HttpRequest):
    if not request.user.is_authenticated:
        raise HttpError(401, "AutenticaciAA3n requerida.")

    estudiante = Estudiante.objects.filter(user=request.user).first()
    if not estudiante:
        raise HttpError(404, "No se encontrAA3 un perfil de estudiante asociado a tu usuario.")

    asistencias = (
        AsistenciaAlumno.objects.filter(estudiante=estudiante)
        .select_related("clase", "clase__comision", "clase__comision__materia")
        .order_by("-clase__fecha", "-clase__hora_inicio")
    )

    data = []
    for asist in asistencias:
        data.append(
            AlumnoAsistenciaItemOut(
                id=asist.id,
                fecha=asist.clase.fecha,
                materia=asist.clase.comision.materia.nombre,
                comision=asist.clase.comision.codigo,
                estado=asist.estado,
                justificada=asist.justificacion_id is not None,
                observacion=None
            )
        )
    return data


def _justificacion_queryset_with_scope(
    queryset,
    roles: set[str],
    staff_profesorados: set[int],
    docente_profile: Docente | None,
    *,
    for_manage: bool = False,
):
    if roles & {"admin", "secretaria"}:
        return queryset
    if "bedel" in roles:
        if not staff_profesorados:
            raise HttpError(403, "No tenA AA12s profesorados asignados.")
        return queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados
        ).distinct()
    if "coordinador" in roles:
        if for_manage:
            raise HttpError(403, "Los coordinadores solo poseen acceso de lectura.")
        if not staff_profesorados:
            raise HttpError(403, "No tenA AA12s profesorados asignados.")
        return queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados
        ).distinct()
    if docente_profile:
        if for_manage:
            raise HttpError(403, "Los docentes no pueden gestionar justificaciones.")
        return queryset.filter(
            Q(detalles__docente=docente_profile) | Q(detalles__clase__comision__docente=docente_profile)
        ).distinct()
    raise HttpError(403, "No tenA AA12s permisos para operar sobre justificaciones.")


def _estudiante_display(estudiante: Estudiante | None) -> str | None:
    if not estudiante:
        return None
    user = getattr(estudiante, "user", None)
    if user:
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        if user.username:
            return user.username
    return estudiante.dni


def _docente_display(docente: Docente | None) -> str | None:
    if not docente:
        return None
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part.strip()).strip()
    return nombre or docente.dni


def _user_display(user) -> str | None:
    if not user:
        return None
    full = user.get_full_name()
    if full and full.strip():
        return full.strip()
    return user.username or None


def _serialize_justificacion_summary(justificacion: Justificacion) -> JustificacionListItemOut:
    detalles = list(justificacion.detalles.all())
    detalle_base = detalles[0] if detalles else None
    clase_base = detalle_base.clase if detalle_base else None
    comision = getattr(clase_base, "comision", None) if clase_base else None
    materia = getattr(comision, "materia", None) if comision else None
    plan = getattr(materia, "plan_de_estudio", None) if materia else None
    profesorado = getattr(plan, "profesorado", None) if plan else None
    estudiante_ref = next((d.estudiante for d in detalles if d.estudiante_id), None)
    docente_ref = next((d.docente for d in detalles if d.docente_id), None)
    return JustificacionListItemOut(
        id=justificacion.id,
        tipo=justificacion.tipo,
        estado=justificacion.estado,
        origen=justificacion.origen,
        motivo=justificacion.motivo,
        vigencia_desde=justificacion.vigencia_desde,
        vigencia_hasta=justificacion.vigencia_hasta,
        comision_id=comision.id if comision else None,
        comision=comision.codigo if comision else None,
        materia=materia.nombre if materia else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado=profesorado.nombre if profesorado else None,
        estudiante_id=estudiante_ref.id if estudiante_ref else None,
        estudiante=_estudiante_display(estudiante_ref),
        docente_id=docente_ref.id if docente_ref else None,
        docente=_docente_display(docente_ref),
        creado_en=justificacion.creado_en,
        aprobado_en=justificacion.aprobado_en,
    )


def _serialize_justificacion_detail(justificacion: Justificacion) -> JustificacionDetailOut:
    detalles = list(justificacion.detalles.all())
    detalle_base = detalles[0] if detalles else None
    clase_base = detalle_base.clase if detalle_base else None
    comision = getattr(clase_base, "comision", None) if clase_base else None
    materia = getattr(comision, "materia", None) if comision else None
    plan = getattr(materia, "plan_de_estudio", None) if materia else None
    profesorado = getattr(plan, "profesorado", None) if plan else None
    estudiante_ref = next((d.estudiante for d in detalles if d.estudiante_id), None)
    docente_ref = next((d.docente for d in detalles if d.docente_id), None)
    detalles_out = [
        JustificacionDetalleOut(
            id=detalle.id,
            clase_id=detalle.clase_id,
            fecha=detalle.clase.fecha,
            comision_id=detalle.clase.comision_id if detalle.clase.comision_id else None,
            comision=detalle.clase.comision.codigo if detalle.clase.comision else None,
            materia=detalle.clase.comision.materia.nombre
            if getattr(detalle.clase.comision, "materia", None)
            else None,
            estudiante_id=detalle.estudiante_id,
            estudiante=_estudiante_display(detalle.estudiante),
            docente_id=detalle.docente_id,
            docente=_docente_display(detalle.docente),
            aplica_automaticamente=detalle.aplica_automaticamente,
        )
        for detalle in detalles
    ]
    return JustificacionDetailOut(
        id=justificacion.id,
        tipo=justificacion.tipo,
        estado=justificacion.estado,
        origen=justificacion.origen,
        motivo=justificacion.motivo,
        observaciones=justificacion.observaciones or None,
        archivo_url=justificacion.archivo_url or None,
        vigencia_desde=justificacion.vigencia_desde,
        vigencia_hasta=justificacion.vigencia_hasta,
        comision_id=comision.id if comision else None,
        comision=comision.codigo if comision else None,
        materia=materia.nombre if materia else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado=profesorado.nombre if profesorado else None,
        estudiante_id=estudiante_ref.id if estudiante_ref else None,
        estudiante=_estudiante_display(estudiante_ref),
        docente_id=docente_ref.id if docente_ref else None,
        docente=_docente_display(docente_ref),
        creado_en=justificacion.creado_en,
        creado_por=_user_display(justificacion.creado_por),
        aprobado_en=justificacion.aprobado_en,
        aprobado_por=_user_display(justificacion.aprobado_por),
        detalles=detalles_out,
    )


@alumnos_router.post("/justificaciones", response=JustificacionOut, auth=JWTAuth())
def crear_justificacion(request: HttpRequest, payload: JustificacionCreateIn) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    if payload.tipo not in (Justificacion.Tipo.ESTUDIANTE, Justificacion.Tipo.DOCENTE):
        raise HttpError(400, "Tipo de justificaciA3n invAlido.")

    if payload.vigencia_desde > payload.vigencia_hasta:
        raise HttpError(400, "El rango de vigencia es invAlido.")

    comision = (
        Comision.objects.select_related("materia__plan_de_estudio__profesorado", "docente")
        .filter(id=payload.comision_id)
        .first()
    )
    if not comision:
        raise HttpError(404, "ComisiA3n inexistente.")

    profesorado_id = _get_profesorado_id_from_comision(comision)
    if roles & {"admin", "secretaria"}:
        pass
    elif "bedel" in roles:
        if not staff_profesorados or profesorado_id not in staff_profesorados:
            raise HttpError(403, "No tenAs permisos sobre el profesorado indicado.")
    elif docente_profile and comision.docente_id == docente_profile.id:
        pass
    else:
        raise HttpError(403, "No tenAs permisos para crear esta justificaciA3n.")

    estudiante = None
    docente = None
    if payload.tipo == Justificacion.Tipo.ESTUDIANTE:
        if not payload.estudiante_id:
            raise HttpError(400, "Debe indicar un estudiante.")
        estudiante = Estudiante.objects.select_related("user").filter(id=payload.estudiante_id).first()
        if not estudiante:
            raise HttpError(404, "Estudiante inexistente.")
    else:
        docente_id = payload.docente_id or (docente_profile.id if docente_profile else None)
        if not docente_id:
            raise HttpError(400, "Debe indicar un docente.")
        docente = Docente.objects.filter(id=docente_id).first()
        if not docente:
            raise HttpError(404, "Docente inexistente.")
        if (
            docente_profile
            and docente.id != docente_profile.id
            and not roles & {"admin", "secretaria", "bedel"}
        ):
            raise HttpError(403, "No podAs crear justificativos para otro docente.")

    justificacion = Justificacion.objects.create(
        tipo=payload.tipo,
        motivo=payload.motivo,
        estado=Justificacion.Estado.PENDIENTE,
        vigencia_desde=payload.vigencia_desde,
        vigencia_hasta=payload.vigencia_hasta,
        origen=payload.origen,
        observaciones=payload.observaciones or "",
        archivo_url=payload.archivo_url or "",
        creado_por=request.user if request.user and request.user.is_authenticated else None,
    )

    attach_classes_to_justification(
        justificacion,
        comision=comision,
        estudiante=estudiante,
        docente=docente,
    )

    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)


@alumnos_router.get("/justificaciones", response=list[JustificacionListItemOut], auth=JWTAuth())
def listar_justificaciones(
    request: HttpRequest,
    tipo: str | None = None,
    estado: str | None = None,
    origen: str | None = None,
    profesorado_id: int | None = None,
    comision_id: int | None = None,
    docente_id: int | None = None,
    estudiante_id: int | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[JustificacionListItemOut]:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    queryset = Justificacion.objects.all()
    if tipo:
        queryset = queryset.filter(tipo=tipo)
    if estado:
        queryset = queryset.filter(estado=estado)
    if origen:
        queryset = queryset.filter(origen=origen)
    if desde:
        queryset = queryset.filter(vigencia_hasta__gte=desde)
    if hasta:
        queryset = queryset.filter(vigencia_desde__lte=hasta)
    if docente_id:
        queryset = queryset.filter(detalles__docente_id=docente_id)
    if estudiante_id:
        queryset = queryset.filter(detalles__estudiante_id=estudiante_id)
    if comision_id:
        queryset = queryset.filter(detalles__clase__comision_id=comision_id)
    if profesorado_id:
        queryset = queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id=profesorado_id
        )

    queryset = _justificacion_queryset_with_scope(
        queryset, roles, staff_profesorados, docente_profile
    )
    queryset = (
        queryset.select_related("creado_por", "aprobado_por")
        .prefetch_related(
            "detalles__clase__comision__materia__plan_de_estudio__profesorado",
            "detalles__estudiante__user",
            "detalles__docente",
        )
        .order_by("-creado_en")
        .distinct()
    )
    return [_serialize_justificacion_summary(j) for j in queryset]


@alumnos_router.get(
    "/justificaciones/{justificacion_id}",
    response=JustificacionDetailOut,
    auth=JWTAuth(),
)
def obtener_justificacion(request: HttpRequest, justificacion_id: int) -> JustificacionDetailOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset, roles, staff_profesorados, docente_profile
    )
    justificacion = (
        queryset.select_related("creado_por", "aprobado_por")
        .prefetch_related(
            "detalles__clase__comision__materia__plan_de_estudio__profesorado",
            "detalles__estudiante__user",
            "detalles__docente",
        )
        .first()
    )
    if not justificacion:
        raise HttpError(404, "La justificaciA3n no existe.")
    return _serialize_justificacion_detail(justificacion)


@alumnos_router.post(
    "/justificaciones/{justificacion_id}/aprobar",
    response=JustificacionOut,
    auth=JWTAuth(),
)
def aprobar_justificacion(request: HttpRequest, justificacion_id: int) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset,
        roles,
        staff_profesorados,
        docente_profile,
        for_manage=True,
    )
    justificacion = queryset.first()
    if not justificacion:
        raise HttpError(404, "La justificaciA3n no existe.")
    if justificacion.estado != Justificacion.Estado.PENDIENTE:
        raise HttpError(400, "La justificaciA3n ya fue procesada.")

    actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    justificacion.marcar_aprobada(actor)
    apply_justification(justificacion)
    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)


@alumnos_router.post(
    "/justificaciones/{justificacion_id}/rechazar",
    response=JustificacionOut,
    auth=JWTAuth(),
)
def rechazar_justificacion(
    request: HttpRequest,
    justificacion_id: int,
    payload: JustificacionRechazarIn,
) -> JustificacionOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)
    queryset = Justificacion.objects.filter(id=justificacion_id)
    queryset = _justificacion_queryset_with_scope(
        queryset,
        roles,
        staff_profesorados,
        docente_profile,
        for_manage=True,
    )
    justificacion = queryset.first()
    if not justificacion:
        raise HttpError(404, "La justificaciA3n no existe.")
    if justificacion.estado != Justificacion.Estado.PENDIENTE:
        raise HttpError(400, "La justificaciA3n ya fue procesada.")

    actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
    justificacion.marcar_rechazada(actor, observaciones=payload.observaciones)
    return JustificacionOut(id=justificacion.id, estado=justificacion.estado)


@calendario_router.get("/", response=list[AsistenciaCalendarioEventoOut], auth=JWTAuth())
def listar_eventos_calendario(
    request: HttpRequest,
    desde: date | None = None,
    hasta: date | None = None,
    tipo: str | None = None,
    solo_activos: bool = True,
) -> list[AsistenciaCalendarioEventoOut]:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    _ensure_authenticated_scope(roles, docente_profile)

    queryset = CalendarioAsistenciaEvento.objects.all().select_related(
        "turno",
        "profesorado",
        "plan",
        "comision",
        "docente",
    )
    if solo_activos:
        queryset = queryset.filter(activo=True)
    if desde:
        queryset = queryset.filter(fecha_hasta__gte=desde)
    if hasta:
        queryset = queryset.filter(fecha_desde__lte=hasta)
    if tipo:
        queryset = queryset.filter(tipo=tipo)

    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    queryset = queryset.order_by("-fecha_desde", "-fecha_hasta")
    return [_evento_to_schema(evento) for evento in queryset]


@calendario_router.post("/", response=AsistenciaCalendarioEventoOut, auth=JWTAuth())
def crear_evento_calendario(request: HttpRequest, payload: AsistenciaCalendarioEventoIn) -> AsistenciaCalendarioEventoOut:
    roles, staff_profesorados, _docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para crear eventos de asistencia.")

    if payload.fecha_desde > payload.fecha_hasta:
        raise HttpError(400, "La fecha desde no puede ser posterior a la fecha hasta.")

    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
        if not turno:
            raise HttpError(404, "El turno indicado no existe.")

    scope = _resolver_event_scope(payload)
    _ensure_calendar_manage_scope(roles, staff_profesorados, scope)

    evento = CalendarioAsistenciaEvento.objects.create(
        nombre=payload.nombre,
        tipo=payload.tipo,
        subtipo=payload.subtipo or CalendarioAsistenciaEvento.Subtipo.GENERAL,
        fecha_desde=payload.fecha_desde,
        fecha_hasta=payload.fecha_hasta,
        turno=turno,
        profesorado=scope["profesorado"],
        plan=scope["plan"],
        comision=scope["comision"],
        docente=scope["docente"],
        aplica_docentes=payload.aplica_docentes,
        aplica_estudiantes=payload.aplica_estudiantes,
        motivo=payload.motivo or "",
        activo=payload.activo,
        creado_por=request.user,
        actualizado_por=request.user,
    )
    return _evento_to_schema(evento)


@calendario_router.put("/{evento_id}", response=AsistenciaCalendarioEventoOut, auth=JWTAuth())
def actualizar_evento_calendario(
    request: HttpRequest,
    evento_id: int,
    payload: AsistenciaCalendarioEventoIn,
) -> AsistenciaCalendarioEventoOut:
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para modificar eventos de asistencia.")

    queryset = CalendarioAsistenciaEvento.objects.filter(id=evento_id)
    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    evento = queryset.first()
    if not evento:
        raise HttpError(404, "El evento solicitado no existe.")

    if payload.fecha_desde > payload.fecha_hasta:
        raise HttpError(400, "La fecha desde no puede ser posterior a la fecha hasta.")

    turno = None
    if payload.turno_id:
        turno = Turno.objects.filter(id=payload.turno_id).first()
        if not turno:
            raise HttpError(404, "El turno indicado no existe.")

    scope = _resolver_event_scope(payload)
    _ensure_calendar_manage_scope(roles, staff_profesorados, scope)

    evento.nombre = payload.nombre
    evento.tipo = payload.tipo
    evento.subtipo = payload.subtipo or CalendarioAsistenciaEvento.Subtipo.GENERAL
    evento.fecha_desde = payload.fecha_desde
    evento.fecha_hasta = payload.fecha_hasta
    evento.turno = turno
    evento.profesorado = scope["profesorado"]
    evento.plan = scope["plan"]
    evento.comision = scope["comision"]
    evento.docente = scope["docente"]
    evento.aplica_docentes = payload.aplica_docentes
    evento.aplica_estudiantes = payload.aplica_estudiantes
    evento.motivo = payload.motivo or ""
    evento.activo = payload.activo
    evento.actualizado_por = request.user
    evento.save()

    return _evento_to_schema(evento)


@calendario_router.delete("/{evento_id}", response=None, auth=JWTAuth())
def desactivar_evento_calendario(request: HttpRequest, evento_id: int):
    roles, staff_profesorados, docente_profile = _resolve_scope(request)
    if not roles & {"admin", "secretaria", "bedel"}:
        raise HttpError(403, "No tenes permisos para modificar eventos de asistencia.")

    queryset = CalendarioAsistenciaEvento.objects.filter(id=evento_id)
    queryset = _calendario_queryset_with_scope(queryset, roles, staff_profesorados, docente_profile)
    evento = queryset.first()
    if not evento:
        raise HttpError(404, "El evento solicitado no existe.")

    evento.activo = False
    evento.actualizado_por = request.user
    evento.save(update_fields=["activo", "actualizado_por", "actualizado_en"])
@docentes_router.post("/dni-log", response=None, auth=None)
def registrar_intento_dni(request: HttpRequest, payload: DocenteDniLogIn):
    dni = (payload.dni or "").strip()
    if not dni:
        raise HttpError(400, "DNI vacAAo.")
    registrar_log_docente(
        dni=dni,
        resultado=DocenteMarcacionLog.Resultado.TYPING,
        detalle="Ingreso de DNI",
        origen=payload.origen or "kiosk",
    )
