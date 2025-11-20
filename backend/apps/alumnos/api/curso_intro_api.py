from decimal import Decimal

from django.contrib.auth.models import AnonymousUser, User
from django.db.models import Q
from django.utils import timezone
from ninja.errors import HttpError

from apps.common.audit import log_action_from_request
from core.auth_ninja import JWTAuth
from core.models import (
    AuditLog,
    CursoIntroductorioCohorte,
    CursoIntroductorioRegistro,
    Estudiante,
    Profesorado,
    StaffAsignacion,
    Turno,
    VentanaHabilitacion,
)
from core.permissions import ensure_roles

from ..schemas import (
    CursoIntroAsistenciaIn,
    CursoIntroAutoInscripcionIn,
    CursoIntroCierreIn,
    CursoIntroCohorteIn,
    CursoIntroCohorteOut,
    CursoIntroEstadoOut,
    CursoIntroPendienteOut,
    CursoIntroRegistroIn,
    CursoIntroRegistroOut,
    CursoIntroVentanaOut,
)
from .router import alumnos_router

CI_ALLOWED_ROLES = {"admin", "secretaria", "bedel", "curso_intro"}
CI_FULL_ACCESS_ROLES = {"admin", "secretaria"}


def _user_group_names(user: User | None) -> set[str]:
    if not user or not user.is_authenticated:
        return set()
    return {name.lower() for name in user.groups.values_list("name", flat=True)}


def _ci_allowed_profesorados(user: User | None) -> set[int] | None:
    if not user or not user.is_authenticated:
        return set()
    if user.is_superuser or user.is_staff:
        return None
    groups = _user_group_names(user)
    if groups.intersection(CI_FULL_ACCESS_ROLES):
        return None
    roles = []
    if "bedel" in groups:
        roles.append(StaffAsignacion.Rol.BEDEL)
    if "curso_intro" in groups:
        roles.append(StaffAsignacion.Rol.CURSO_INTRO)
    if not roles:
        return None
    ids = set(
        StaffAsignacion.objects.filter(user=user, rol__in=roles).values_list("profesorado_id", flat=True)
    )
    return ids


def _ci_filter_registros_scope(user: User | None, qs):
    allowed = _ci_allowed_profesorados(user)
    if allowed is None:
        return qs
    if not allowed:
        return qs.none()
    return qs.filter(Q(profesorado_id__in=allowed) | Q(profesorado__isnull=True))


def _ci_filter_cohortes_scope(user: User | None, qs):
    allowed = _ci_allowed_profesorados(user)
    if allowed is None:
        return qs
    if not allowed:
        return qs.none()
    return qs.filter(Q(profesorado_id__in=allowed) | Q(profesorado__isnull=True))


def _ci_ensure_profesorado_access(user: User | None, profesorado_id: int | None) -> None:
    if not profesorado_id:
        return
    allowed = _ci_allowed_profesorados(user)
    if allowed is None:
        return
    if profesorado_id in allowed:
        return
    raise HttpError(403, "No tiene permisos sobre el profesorado seleccionado.")


def _require_estudiante_user(request) -> Estudiante:
    if isinstance(request.user, AnonymousUser):
        raise HttpError(403, "Debe iniciar sesión.")
    estudiante = getattr(request.user, "estudiante", None)
    if not estudiante:
        raise HttpError(403, "Acceso disponible solo para estudiantes.")
    return estudiante


def _ci_estudiante_tiene_ci_aprobado(estudiante: Estudiante | None) -> bool:
    if not estudiante:
        return False
    return bool(estudiante.curso_introductorio_aprobado)


def _ci_set_ci_aprobado(estudiante: Estudiante, aprobado: bool) -> None:
    aprobado_flag = bool(aprobado)
    if estudiante.curso_introductorio_aprobado == aprobado_flag:
        return
    estudiante.curso_introductorio_aprobado = aprobado_flag
    estudiante.save(update_fields=["curso_introductorio_aprobado"])


def _ci_has_active_window(ventana: VentanaHabilitacion | None) -> bool:
    if not ventana or not ventana.activo:
        return False
    hoy = timezone.now().date()
    return ventana.desde <= hoy <= ventana.hasta


def _ci_active_windows_queryset():
    hoy = timezone.now().date()
    return VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.CURSO_INTRODUCTORIO,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy,
    )


def _ci_select_profesorado(estudiante: Estudiante, profesorado_id: int | None, cohorte: CursoIntroductorioCohorte | None):
    if profesorado_id:
        profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not profesorado:
            raise HttpError(404, "Profesorado no encontrado.")
        return profesorado
    if cohorte and cohorte.profesorado:
        return cohorte.profesorado
    detalle = (
        estudiante.carreras_detalle.select_related("profesorado")
        .order_by("-updated_at")
        .first()
    )
    return detalle.profesorado if detalle else None


def _ci_select_turno(turno_id: int | None, cohorte: CursoIntroductorioCohorte | None):
    if turno_id:
        turno = Turno.objects.filter(id=turno_id).first()
        if not turno:
            raise HttpError(404, "Turno no encontrado.")
        return turno
    if cohorte and cohorte.turno:
        return cohorte.turno
    return None


def _ci_save_registro(estudiante: Estudiante, cohorte, profesorado, turno):
    registro, created = CursoIntroductorioRegistro.objects.get_or_create(
        estudiante=estudiante,
        cohorte=cohorte,
        defaults={
            "profesorado": profesorado,
            "turno": turno,
        },
    )
    before_snapshot = None
    if not created:
        before_snapshot = _ci_registro_audit_snapshot(registro)
        registro.profesorado = profesorado
        registro.turno = turno
        registro.save(update_fields=["profesorado", "turno"])
    return registro, created, before_snapshot


def _serialize_ci_cohorte(cohorte: CursoIntroductorioCohorte) -> CursoIntroCohorteOut:
    ventana = cohorte.ventana_inscripcion
    turno = cohorte.turno
    profesorado = cohorte.profesorado
    return CursoIntroCohorteOut(
        id=cohorte.id,
        nombre=cohorte.nombre or "",
        anio_academico=cohorte.anio_academico,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        turno_id=turno.id if turno else None,
        turno_nombre=turno.nombre if turno else None,
        ventana_id=ventana.id if ventana else None,
        ventana_tipo=ventana.get_tipo_display() if ventana else None,
        fecha_inicio=cohorte.fecha_inicio.isoformat() if cohorte.fecha_inicio else None,
        fecha_fin=cohorte.fecha_fin.isoformat() if cohorte.fecha_fin else None,
        cupo=cohorte.cupo,
        observaciones=cohorte.observaciones or "",
    )


def _serialize_ci_ventana(ventana: VentanaHabilitacion) -> CursoIntroVentanaOut:
    return CursoIntroVentanaOut(
        id=ventana.id,
        desde=ventana.desde.isoformat(),
        hasta=ventana.hasta.isoformat(),
        activo=ventana.activo,
        periodo=ventana.periodo,
    )


def _serialize_ci_registro(registro: CursoIntroductorioRegistro) -> CursoIntroRegistroOut:
    estudiante = registro.estudiante
    cohorte = registro.cohorte
    profesorado = registro.profesorado
    turno = registro.turno
    nombre = estudiante.user.get_full_name() if estudiante and estudiante.user else ""
    return CursoIntroRegistroOut(
        id=registro.id,
        estudiante_id=estudiante.id,
        estudiante_nombre=nombre,
        estudiante_dni=estudiante.dni,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        cohorte_id=cohorte.id if cohorte else None,
        cohorte_nombre=(cohorte.nombre or f"Cohorte {cohorte.anio_academico}") if cohorte else None,
        turno_id=turno.id if turno else None,
        turno_nombre=turno.nombre if turno else None,
        resultado=registro.resultado,
        resultado_display=registro.get_resultado_display(),
        asistencias_totales=registro.asistencias_totales,
        nota_final=float(registro.nota_final) if registro.nota_final is not None else None,
        observaciones=registro.observaciones or "",
        es_historico=registro.es_historico,
        resultado_at=registro.resultado_at.isoformat() if registro.resultado_at else None,
    )


def _ci_cohorte_audit_snapshot(cohorte: CursoIntroductorioCohorte | None) -> dict | None:
    if not cohorte:
        return None
    return {
        "id": cohorte.id,
        "nombre": cohorte.nombre,
        "anio_academico": cohorte.anio_academico,
        "profesorado_id": cohorte.profesorado_id,
        "turno_id": cohorte.turno_id,
        "ventana_id": cohorte.ventana_inscripcion_id,
        "fecha_inicio": cohorte.fecha_inicio.isoformat() if cohorte.fecha_inicio else None,
        "fecha_fin": cohorte.fecha_fin.isoformat() if cohorte.fecha_fin else None,
        "cupo": cohorte.cupo,
    }


def _ci_registro_audit_snapshot(registro: CursoIntroductorioRegistro | None) -> dict | None:
    if not registro:
        return None
    return {
        "id": registro.id,
        "estudiante_id": registro.estudiante_id,
        "cohorte_id": registro.cohorte_id,
        "profesorado_id": registro.profesorado_id,
        "turno_id": registro.turno_id,
        "resultado": registro.resultado,
        "nota_final": float(registro.nota_final) if registro.nota_final is not None else None,
        "asistencias_totales": registro.asistencias_totales,
        "es_historico": registro.es_historico,
    }


@alumnos_router.get("/curso-intro/estado", response=CursoIntroEstadoOut, auth=JWTAuth())
def curso_intro_estado(request):
    estudiante = _require_estudiante_user(request)
    registro = (
        CursoIntroductorioRegistro.objects.select_related("cohorte", "profesorado", "turno", "estudiante__user")
        .filter(estudiante=estudiante)
        .order_by("-inscripto_en")
        .first()
    )
    ventanas = list(_ci_active_windows_queryset())
    if ventanas:
        ventana_ids = [ventana.id for ventana in ventanas]
        cohortes_qs = (
            CursoIntroductorioCohorte.objects.select_related("profesorado", "turno", "ventana_inscripcion")
            .filter(ventana_inscripcion_id__in=ventana_ids)
            .order_by("anio_academico", "nombre")
        )
    else:
        cohortes_qs = CursoIntroductorioCohorte.objects.none()
    return CursoIntroEstadoOut(
        aprobado=_ci_estudiante_tiene_ci_aprobado(estudiante),
        registro_actual=_serialize_ci_registro(registro) if registro else None,
        cohortes_disponibles=[_serialize_ci_cohorte(cohorte) for cohorte in cohortes_qs],
        ventanas=[_serialize_ci_ventana(ventana) for ventana in ventanas],
    )


@alumnos_router.get("/curso-intro/cohortes", response=list[CursoIntroCohorteOut], auth=JWTAuth())
def curso_intro_listar_cohortes(request):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    qs = (
        CursoIntroductorioCohorte.objects.select_related("profesorado", "turno", "ventana_inscripcion")
        .all()
        .order_by("-anio_academico", "-fecha_inicio", "-id")
    )
    qs = _ci_filter_cohortes_scope(request.user, qs)
    return [_serialize_ci_cohorte(cohorte) for cohorte in qs]


@alumnos_router.post("/curso-intro/cohortes", response=CursoIntroCohorteOut, auth=JWTAuth())
def curso_intro_crear_cohorte(request, payload: CursoIntroCohorteIn):
    ensure_roles(request.user, {"admin", "secretaria"})
    cohorte = CursoIntroductorioCohorte(
        nombre=payload.nombre or "",
        anio_academico=payload.anio_academico,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        cupo=payload.cupo,
        observaciones=payload.observaciones or "",
        created_by=request.user,
        updated_by=request.user,
    )
    if payload.profesorado_id:
        cohorte.profesorado = Profesorado.objects.filter(id=payload.profesorado_id).first()
    if payload.turno_id:
        cohorte.turno = Turno.objects.filter(id=payload.turno_id).first()
    if payload.ventana_id:
        cohorte.ventana_inscripcion = VentanaHabilitacion.objects.filter(id=payload.ventana_id).first()
    cohorte.save()
    log_action_from_request(
        request,
        accion=AuditLog.Accion.CREATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_COHORTE_CREATE",
        entidad="CursoIntroductorioCohorte",
        entidad_id=cohorte.id,
        after=_ci_cohorte_audit_snapshot(cohorte),
        metadata={"source": "curso-intro"},
    )
    return _serialize_ci_cohorte(cohorte)


@alumnos_router.put("/curso-intro/cohortes/{cohorte_id}", response=CursoIntroCohorteOut, auth=JWTAuth())
def curso_intro_actualizar_cohorte(request, cohorte_id: int, payload: CursoIntroCohorteIn):
    ensure_roles(request.user, {"admin", "secretaria"})
    cohorte = CursoIntroductorioCohorte.objects.filter(id=cohorte_id).first()
    if not cohorte:
        raise HttpError(404, "Cohorte no encontrada.")
    before_snapshot = _ci_cohorte_audit_snapshot(cohorte)
    cohorte.nombre = payload.nombre or ""
    cohorte.anio_academico = payload.anio_academico
    cohorte.fecha_inicio = payload.fecha_inicio
    cohorte.fecha_fin = payload.fecha_fin
    cohorte.cupo = payload.cupo
    cohorte.observaciones = payload.observaciones or ""
    cohorte.updated_by = request.user
    cohorte.profesorado = (
        Profesorado.objects.filter(id=payload.profesorado_id).first() if payload.profesorado_id else None
    )
    cohorte.turno = Turno.objects.filter(id=payload.turno_id).first() if payload.turno_id else None
    cohorte.ventana_inscripcion = (
        VentanaHabilitacion.objects.filter(id=payload.ventana_id).first() if payload.ventana_id else None
    )
    cohorte.save()
    log_action_from_request(
        request,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_COHORTE_UPDATE",
        entidad="CursoIntroductorioCohorte",
        entidad_id=cohorte.id,
        before=before_snapshot,
        after=_ci_cohorte_audit_snapshot(cohorte),
        metadata={"source": "curso-intro"},
    )
    return _serialize_ci_cohorte(cohorte)


@alumnos_router.get("/curso-intro/registros", response=list[CursoIntroRegistroOut], auth=JWTAuth())
def curso_intro_listar_registros(
    request,
    cohorte_id: int | None = None,
    profesorado_id: int | None = None,
    turno_id: int | None = None,
    resultado: str | None = None,
    anio: int | None = None,
):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    qs = (
        CursoIntroductorioRegistro.objects.select_related("estudiante__user", "cohorte", "profesorado", "turno")
        .all()
        .order_by("-inscripto_en")
    )
    if cohorte_id:
        qs = qs.filter(cohorte_id=cohorte_id)
    if profesorado_id:
        _ci_ensure_profesorado_access(request.user, profesorado_id)
        qs = qs.filter(profesorado_id=profesorado_id)
    qs = _ci_filter_registros_scope(request.user, qs)
    if turno_id:
        qs = qs.filter(turno_id=turno_id)
    if resultado:
        qs = qs.filter(resultado=resultado)
    if anio:
        qs = qs.filter(cohorte__anio_academico=anio)
    return [_serialize_ci_registro(registro) for registro in qs]


@alumnos_router.get("/curso-intro/pendientes", response=list[CursoIntroPendienteOut], auth=JWTAuth())
def curso_intro_listar_pendientes(request, profesorado_id: int | None = None):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    registros_activos = set(
        CursoIntroductorioRegistro.objects.values_list("estudiante_id", flat=True).distinct()
    )
    qs = (
        Estudiante.objects.filter(curso_introductorio_aprobado=False, carreras__isnull=False)
        .exclude(id__in=registros_activos)
        .prefetch_related("carreras_detalle__profesorado")
        .distinct()
    )
    allowed = _ci_allowed_profesorados(request.user)
    if profesorado_id:
        _ci_ensure_profesorado_access(request.user, profesorado_id)
        qs = qs.filter(carreras__id=profesorado_id)
    elif allowed is not None:
        if not allowed:
            return []
        qs = qs.filter(carreras__id__in=allowed)
    pendientes: list[CursoIntroPendienteOut] = []
    for est in qs:
        profesorados = []
        for detalle in est.carreras_detalle.all():
            profesorados.append(
                {
                    "id": detalle.profesorado_id,
                    "nombre": detalle.profesorado.nombre,
                    "anio_ingreso": detalle.anio_ingreso,
                }
            )
        pendientes.append(
            CursoIntroPendienteOut(
                estudiante_id=est.id,
                estudiante_dni=est.dni,
                estudiante_nombre=est.user.get_full_name() if est.user_id else "",
                profesorados=profesorados,
                anio_ingreso=profesorados[0].get("anio_ingreso") if profesorados else None,
            )
        )
    return pendientes


@alumnos_router.post("/curso-intro/registros", response=CursoIntroRegistroOut, auth=JWTAuth())
def curso_intro_inscribir(request, payload: CursoIntroRegistroIn):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    estudiante = Estudiante.objects.filter(id=payload.estudiante_id).select_related("user").first()
    if not estudiante:
        raise HttpError(404, "Estudiante no encontrado.")
    if _ci_estudiante_tiene_ci_aprobado(estudiante):
        raise HttpError(400, "El estudiante ya tiene aprobado el Curso Introductorio.")
    cohorte = None
    if payload.cohorte_id:
        cohorte = CursoIntroductorioCohorte.objects.filter(id=payload.cohorte_id).select_related("profesorado", "turno").first()
        if not cohorte:
            raise HttpError(404, "Cohorte no encontrada.")
    profesorado = _ci_select_profesorado(estudiante, payload.profesorado_id, cohorte)
    _ci_ensure_profesorado_access(request.user, profesorado.id if profesorado else None)
    turno = _ci_select_turno(payload.turno_id, cohorte)
    registro, created, before_snapshot = _ci_save_registro(estudiante, cohorte, profesorado, turno)
    log_action_from_request(
        request,
        accion=AuditLog.Accion.CREATE if created else AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_INSCRIPCION_MANUAL_CREATE" if created else "CI_INSCRIPCION_MANUAL_UPDATE",
        entidad="CursoIntroductorioRegistro",
        entidad_id=registro.id,
        before=before_snapshot,
        after=_ci_registro_audit_snapshot(registro),
        metadata={
            "cohorte_id": cohorte.id if cohorte else None,
            "profesorado_id": profesorado.id if profesorado else None,
        },
    )
    return _serialize_ci_registro(registro)


@alumnos_router.post("/curso-intro/auto-inscripcion", response=CursoIntroRegistroOut, auth=JWTAuth())
def curso_intro_auto_inscripcion(request, payload: CursoIntroAutoInscripcionIn):
    estudiante = _require_estudiante_user(request)
    if _ci_estudiante_tiene_ci_aprobado(estudiante):
        raise HttpError(400, "Ya tenés aprobado el Curso Introductorio.")
    cohorte = (
        CursoIntroductorioCohorte.objects.select_related("profesorado", "turno", "ventana_inscripcion")
        .filter(id=payload.cohorte_id)
        .first()
    )
    if not cohorte:
        raise HttpError(404, "Cohorte no encontrada.")
    if not _ci_has_active_window(cohorte.ventana_inscripcion):
        raise HttpError(400, "La cohorte seleccionada no está habilitada para inscripciones.")
    profesorado = _ci_select_profesorado(estudiante, payload.profesorado_id, cohorte)
    if profesorado and not estudiante.carreras.filter(id=profesorado.id).exists():
        raise HttpError(400, "El profesorado seleccionado no corresponde a tus inscripciones.")
    turno = _ci_select_turno(payload.turno_id, cohorte)
    registro, created, before_snapshot = _ci_save_registro(estudiante, cohorte, profesorado, turno)
    log_action_from_request(
        request,
        accion=AuditLog.Accion.CREATE if created else AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_INSCRIPCION_AUTO_CREATE" if created else "CI_INSCRIPCION_AUTO_UPDATE",
        entidad="CursoIntroductorioRegistro",
        entidad_id=registro.id,
        before=before_snapshot,
        after=_ci_registro_audit_snapshot(registro),
        metadata={
            "cohorte_id": cohorte.id,
            "profesorado_id": profesorado.id if profesorado else None,
        },
    )
    return _serialize_ci_registro(registro)


@alumnos_router.post(
    "/curso-intro/registros/{registro_id}/asistencia",
    response=CursoIntroRegistroOut,
    auth=JWTAuth(),
)
def curso_intro_registrar_asistencia(request, registro_id: int, payload: CursoIntroAsistenciaIn):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    registro = (
        CursoIntroductorioRegistro.objects.select_related("estudiante__user", "profesorado", "cohorte", "turno")
        .filter(id=registro_id)
        .first()
    )
    if not registro:
        raise HttpError(404, "Registro no encontrado.")
    _ci_ensure_profesorado_access(request.user, registro.profesorado_id)
    before_snapshot = _ci_registro_audit_snapshot(registro)
    asistencias = payload.asistencias_totales
    if asistencias < 0 or asistencias > 100:
        raise HttpError(400, "La asistencia debe estar entre 0 y 100.")
    registro.asistencias_totales = asistencias
    registro.save(update_fields=["asistencias_totales"])
    log_action_from_request(
        request,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_ASISTENCIA_UPDATE",
        entidad="CursoIntroductorioRegistro",
        entidad_id=registro.id,
        before=before_snapshot,
        after=_ci_registro_audit_snapshot(registro),
    )
    return _serialize_ci_registro(registro)


@alumnos_router.post(
    "/curso-intro/registros/{registro_id}/cierre",
    response=CursoIntroRegistroOut,
    auth=JWTAuth(),
)
def curso_intro_cerrar_registro(request, registro_id: int, payload: CursoIntroCierreIn):
    ensure_roles(request.user, CI_ALLOWED_ROLES)
    registro = (
        CursoIntroductorioRegistro.objects.select_related("estudiante", "estudiante__user", "profesorado", "cohorte", "turno")
        .filter(id=registro_id)
        .first()
    )
    if not registro:
        raise HttpError(404, "Registro no encontrado.")
    _ci_ensure_profesorado_access(request.user, registro.profesorado_id)
    before_snapshot = _ci_registro_audit_snapshot(registro)
    nota_value = payload.nota_final
    if nota_value is not None:
        if nota_value < 1 or nota_value > 10:
            raise HttpError(400, "La nota debe estar entre 1 y 10.")
        registro.nota_final = Decimal(str(nota_value)).quantize(Decimal("0.01"))
    else:
        registro.nota_final = None
    asistencias = payload.asistencias_totales
    if asistencias is not None:
        if asistencias < 0 or asistencias > 100:
            raise HttpError(400, "La asistencia debe estar entre 0 y 100.")
    registro.asistencias_totales = asistencias
    registro.resultado = payload.resultado
    registro.observaciones = payload.observaciones or ""
    registro.resultado_at = timezone.now()
    registro.resultado_por = request.user
    registro.es_historico = False
    registro.save(
        update_fields=[
            "nota_final",
            "asistencias_totales",
            "resultado",
            "observaciones",
            "resultado_at",
            "resultado_por",
            "es_historico",
        ]
    )
    estudiante = registro.estudiante
    _ci_set_ci_aprobado(
        estudiante,
        registro.resultado == CursoIntroductorioRegistro.Resultado.APROBADO,
    )
    log_action_from_request(
        request,
        accion=AuditLog.Accion.UPDATE,
        tipo_accion=AuditLog.TipoAccion.CRUD,
        detalle_accion="CI_RESULTADO_CIERRE",
        entidad="CursoIntroductorioRegistro",
        entidad_id=registro.id,
        before=before_snapshot,
        after=_ci_registro_audit_snapshot(registro),
    )
    return _serialize_ci_registro(registro)
