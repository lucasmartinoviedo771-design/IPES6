from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db.models import Max, Q
from django.http import HttpResponse
from django.utils import timezone
from ninja import Router
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamenAlumno,
    Bloque,
    Comision,
    Correlatividad,
    CorrelatividadVersion,
    EquivalenciaCurricular,
    Estudiante,
    HorarioCatedra,
    HorarioCatedraDetalle,
    InscripcionMateriaAlumno,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PedidoAnalitico,
    PlanDeEstudio,
    Preinscripcion,
    Profesorado,
    Regularidad,
    VentanaHabilitacion,
)
from core.permissions import ensure_roles

from .schemas import (
    CambioComisionIn,
    CambioComisionOut,
    CancelarInscripcionIn,
    CarreraDetalleResumen,
    CarreraPlanResumen,
    CartonEvento,
    CartonMateria,
    CartonPlan,
    ComisionResumen,
    EquivalenciaItem,
    EstudianteAdminDetail,
    EstudianteAdminDocumentacion,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
    EstudianteResumen,
    FinalHabilitado,
    HistorialAlumno,
    Horario,
    HorarioCelda,
    HorarioDia,
    HorarioFranja,
    HorarioMateriaCelda,
    HorarioTabla,
    InscripcionMateriaIn,
    InscripcionMateriaOut,
    InscripcionMesaIn,
    InscripcionMesaOut,
    MateriaInscriptaItem,
    MateriaPlan,
    MesaExamenIn,
    MesaExamenOut,
    PedidoAnaliticoIn,
    PedidoAnaliticoItem,
    PedidoAnaliticoOut,
    RecomendacionesOut,
    RegularidadResumen,
    RegularidadVigenciaOut,
    TrayectoriaEvento,
    TrayectoriaMesa,
    TrayectoriaOut,
)

alumnos_router = Router(tags=["alumnos"], auth=JWTAuth())

ADMIN_ALLOWED_ROLES = {"admin", "secretaria", "bedel"}
DOCUMENTACION_FIELDS = {
    "dni_legalizado",
    "fotos_4x4",
    "certificado_salud",
    "folios_oficio",
    "titulo_secundario_legalizado",
    "certificado_titulo_en_tramite",
    "analitico_legalizado",
    "certificado_alumno_regular_sec",
    "adeuda_materias",
    "adeuda_materias_detalle",
    "escuela_secundaria",
    "es_certificacion_docente",
    "titulo_terciario_univ",
}


def _ensure_admin(request):
    ensure_roles(request.user, ADMIN_ALLOWED_ROLES)


def _resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
    """Intenta resolver el estudiante a partir del DNI o del usuario autenticado."""
    if dni:
        return Estudiante.objects.filter(dni=dni).first()
    if isinstance(request.user, AnonymousUser):
        return None
    return getattr(request.user, "estudiante", None)


def _ensure_estudiante_access(request, dni: str | None) -> None:
    if not dni:
        return
    solicitante = getattr(request.user, "estudiante", None)
    if solicitante and solicitante.dni != dni:
        ensure_roles(request.user, ADMIN_ALLOWED_ROLES)


def _parse_optional_date(value: str | None):
    if not value:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(trimmed, fmt).date()
        except ValueError:
            continue
    return None


def _extract_documentacion(datos_extra: dict | None) -> dict:
    if not datos_extra:
        return {}
    raw = datos_extra.get("documentacion") or {}
    return {key: raw.get(key) for key in DOCUMENTACION_FIELDS if key in raw}


def _listar_carreras_detalle(est: Estudiante, carreras: Iterable[Profesorado] | None = None) -> list[dict]:
    carreras_list = list(carreras) if carreras is not None else list(est.carreras.all())
    if not carreras_list:
        return []
    planes_qs = PlanDeEstudio.objects.filter(profesorado__in=carreras_list).order_by(
        "profesorado_id", "-vigente", "-anio_inicio", "resolucion"
    )
    planes_por_prof: dict[int, list[PlanDeEstudio]] = {}
    for plan in planes_qs:
        planes_por_prof.setdefault(plan.profesorado_id, []).append(plan)
    detalle: list[dict] = []
    for prof in carreras_list:
        planes = planes_por_prof.get(prof.id, [])
        detalle.append(
            {
                "profesorado_id": prof.id,
                "nombre": prof.nombre,
                "planes": [
                    {
                        "id": plan.id,
                        "resolucion": plan.resolucion or "",
                        "vigente": bool(getattr(plan, "vigente", False)),
                    }
                    for plan in planes
                ],
            }
        )
    return detalle


def _apply_estudiante_updates(
    est: Estudiante,
    payload: EstudianteAdminUpdateIn,
    *,
    allow_estado_legajo: bool,
    allow_force_password: bool,
    mark_profile_complete: bool = False,
) -> tuple[bool, tuple[int, ApiResponse] | None]:
    fields_to_update: set[str] = set()

    if payload.telefono is not None:
        est.telefono = payload.telefono
        fields_to_update.add("telefono")

    if payload.domicilio is not None:
        est.domicilio = payload.domicilio
        fields_to_update.add("domicilio")

    if allow_estado_legajo and payload.estado_legajo is not None:
        est.estado_legajo = payload.estado_legajo.upper()
        fields_to_update.add("estado_legajo")

    if allow_force_password and payload.must_change_password is not None:
        est.must_change_password = payload.must_change_password
        fields_to_update.add("must_change_password")

    if payload.fecha_nacimiento is not None:
        raw_fecha = payload.fecha_nacimiento or ""
        new_date = _parse_optional_date(raw_fecha)
        if new_date is None and raw_fecha.strip():
            return False, (
                400,
                ApiResponse(
                    ok=False,
                    message="Formato de fecha invalido. Usa DD/MM/AAAA o AAAA-MM-DD.",
                ),
            )
        est.fecha_nacimiento = new_date
        fields_to_update.add("fecha_nacimiento")

    datos_extra = dict(est.datos_extra or {})

    if payload.documentacion is not None:
        doc_updates = payload.documentacion.model_dump(exclude_unset=True)
        current_doc = dict(datos_extra.get("documentacion") or {})
        for key, value in doc_updates.items():
            if value is None or isinstance(value, str) and not value.strip():
                current_doc.pop(key, None)
            else:
                current_doc[key] = value
        if current_doc:
            datos_extra["documentacion"] = current_doc
        else:
            datos_extra.pop("documentacion", None)

    for extra_key in ("anio_ingreso", "genero", "rol_extra", "observaciones", "cuil"):
        value = getattr(payload, extra_key)
        if value is None:
            continue
        if value == "":
            datos_extra.pop(extra_key, None)
        else:
            datos_extra[extra_key] = value

    if payload.curso_introductorio_aprobado is not None:
        datos_extra["curso_introductorio_aprobado"] = bool(payload.curso_introductorio_aprobado)
    if payload.libreta_entregada is not None:
        datos_extra["libreta_entregada"] = bool(payload.libreta_entregada)

    if mark_profile_complete and not datos_extra.get("perfil_actualizado"):
        datos_extra["perfil_actualizado"] = True

    if datos_extra != (est.datos_extra or {}):
        est.datos_extra = datos_extra
        fields_to_update.add("datos_extra")

    if fields_to_update:
        est.save(update_fields=list(fields_to_update))

    return True, None


def _determine_condicion(documentacion: dict | None) -> str:
    if not documentacion:
        return "Pendiente"
    requisito_basico = all(
        (
            bool(documentacion.get("dni_legalizado")),
            bool(documentacion.get("fotos_4x4")),
            bool(documentacion.get("certificado_salud")),
            (documentacion.get("folios_oficio") or 0) >= 3,
        )
    )
    requisito_secundario = any(
        (
            bool(documentacion.get("titulo_secundario_legalizado")),
            bool(documentacion.get("certificado_titulo_en_tramite")),
            bool(documentacion.get("analitico_legalizado")),
        )
    )
    if requisito_basico and requisito_secundario:
        return "Regular"
    if requisito_basico or requisito_secundario:
        return "Condicional"
    return "Pendiente"


def _build_admin_detail(estudiante: Estudiante) -> EstudianteAdminDetail:
    user = estudiante.user if estudiante.user_id else None
    carreras_nombres = [c.nombre for c in estudiante.carreras.all()]
    datos_extra = estudiante.datos_extra or {}
    documentacion_data = _extract_documentacion(datos_extra)
    documentacion = EstudianteAdminDocumentacion(**documentacion_data) if documentacion_data else None
    condicion = _determine_condicion(documentacion_data)
    curso_introductorio_aprobado = bool(datos_extra.get("curso_introductorio_aprobado"))
    libreta_entregada = bool(datos_extra.get("libreta_entregada"))
    regularidades_resumen = [
        RegularidadResumen(
            id=reg.id,
            materia_id=reg.materia_id,
            materia_nombre=reg.materia.nombre if reg.materia_id and reg.materia else "",
            situacion=reg.situacion,
            situacion_display=reg.get_situacion_display(),
            fecha_cierre=reg.fecha_cierre.isoformat(),
            nota_tp=(float(reg.nota_trabajos_practicos) if reg.nota_trabajos_practicos is not None else None),
            nota_final=reg.nota_final_cursada,
            asistencia=reg.asistencia_porcentaje,
            excepcion=reg.excepcion,
            observaciones=reg.observaciones or None,
        )
        for reg in Regularidad.objects.filter(estudiante=estudiante).select_related("materia").order_by("-fecha_cierre")
    ]
    return EstudianteAdminDetail(
        dni=estudiante.dni,
        apellido=user.last_name if user else "",
        nombre=user.first_name if user else "",
        email=user.email if user else None,
        telefono=estudiante.telefono or None,
        domicilio=estudiante.domicilio or None,
        fecha_nacimiento=(estudiante.fecha_nacimiento.isoformat() if estudiante.fecha_nacimiento else None),
        estado_legajo=estudiante.estado_legajo,
        estado_legajo_display=estudiante.get_estado_legajo_display(),
        must_change_password=estudiante.must_change_password,
        carreras=carreras_nombres,
        legajo=estudiante.legajo or None,
        datos_extra=datos_extra,
        documentacion=documentacion,
        condicion_calculada=condicion,
        curso_introductorio_aprobado=curso_introductorio_aprobado,
        libreta_entregada=libreta_entregada,
        regularidades=regularidades_resumen,
    )


def _comision_to_resumen(comision: Comision | None) -> ComisionResumen | None:
    if not comision:
        return None
    materia = comision.materia
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado if plan else None
    horarios: list[Horario] = []
    if comision.horario_id:
        detalles = (
            HorarioCatedraDetalle.objects.filter(horario_catedra_id=comision.horario_id)
            .select_related("bloque")
            .order_by("bloque__dia", "bloque__hora_desde")
        )
        horarios = [
            Horario(
                dia=det.bloque.get_dia_display(),
                desde=str(det.bloque.hora_desde)[:5],
                hasta=str(det.bloque.hora_hasta)[:5],
            )
            for det in detalles
        ]
    docente_nombre = None
    if comision.docente_id:
        docente_nombre = comision.docente.get_full_name()
    return ComisionResumen(
        id=comision.id,
        codigo=comision.codigo,
        anio_lectivo=comision.anio_lectivo,
        turno_id=comision.turno_id,
        turno=comision.turno.nombre,
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        plan_id=plan.id if plan else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        docente=docente_nombre,
        cupo_maximo=comision.cupo_maximo,
        estado=comision.estado,
        horarios=horarios,
    )


def _horarios_de_materia(materia: Materia) -> list[Horario]:
    detalles = (
        HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=materia)
        .select_related("bloque")
        .order_by("bloque__dia", "bloque__hora_desde")
    )
    return [
        Horario(
            dia=det.bloque.get_dia_display(),
            desde=str(det.bloque.hora_desde)[:5],
            hasta=str(det.bloque.hora_hasta)[:5],
        )
        for det in detalles
    ]


def _metadata_str(data: dict[str, object]) -> dict[str, str]:
    return {k: str(v) for k, v in data.items() if v not in (None, "")}


def _add_years(base: date, years: int) -> date:
    try:
        return base.replace(year=base.year + years)
    except ValueError:
        return base.replace(month=2, day=28, year=base.year + years)


def _calcular_vigencia_regularidad(estudiante: Estudiante, regularidad: Regularidad) -> tuple[date, int]:
    limite_base = _add_years(regularidad.fecha_cierre, 2)
    siguiente_llamado = (
        MesaExamen.objects.filter(
            materia=regularidad.materia,
            tipo=MesaExamen.Tipo.FINAL,
            fecha__gte=limite_base,
        )
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    limite = siguiente_llamado or limite_base

    intentos = InscripcionMesa.objects.filter(
        estudiante=estudiante,
        estado=InscripcionMesa.Estado.INSCRIPTO,
        mesa__materia=regularidad.materia,
        mesa__tipo=MesaExamen.Tipo.FINAL,
        mesa__fecha__gte=regularidad.fecha_cierre,
        mesa__fecha__lte=limite,
    ).count()
    return limite, intentos


@alumnos_router.get(
    "/admin/estudiantes",
    response=EstudianteAdminListResponse,
)
def admin_list_estudiantes(
    request,
    q: str | None = None,
    carrera_id: int | None = None,
    estado_legajo: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _ensure_admin(request)
    qs = (
        Estudiante.objects.select_related("user")
        .prefetch_related("carreras")
        .order_by("user__last_name", "user__first_name", "dni")
    )
    if q:
        q_clean = q.strip()
        if q_clean:
            qs = qs.filter(
                Q(dni__icontains=q_clean)
                | Q(user__first_name__icontains=q_clean)
                | Q(user__last_name__icontains=q_clean)
            )
    if carrera_id:
        qs = qs.filter(carreras__id=carrera_id)
    if estado_legajo:
        qs = qs.filter(estado_legajo=estado_legajo.upper())

    total = qs.count()
    qs = qs[offset : offset + limit] if limit else qs[offset:]

    items = []
    for est in qs:
        user = est.user if est.user_id else None
        items.append(
            EstudianteAdminListItem(
                dni=est.dni,
                apellido=user.last_name if user else "",
                nombre=user.first_name if user else "",
                email=user.email if user else None,
                telefono=est.telefono or None,
                estado_legajo=est.estado_legajo,
                estado_legajo_display=est.get_estado_legajo_display(),
                carreras=[c.nombre for c in est.carreras.all()],
                legajo=est.legajo or None,
            )
        )
    return EstudianteAdminListResponse(total=total, items=items)


@alumnos_router.get(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def admin_get_estudiante(request, dni: str):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")
    return _build_admin_detail(est)


@alumnos_router.put(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def admin_update_estudiante(request, dni: str, payload: EstudianteAdminUpdateIn):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=True,
        allow_force_password=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)


@alumnos_router.get(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def alumno_get_perfil_completar(request):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")
    return _build_admin_detail(est)


@alumnos_router.put(
    "/perfil/completar",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def alumno_update_perfil_completar(request, payload: EstudianteAdminUpdateIn):
    est = _resolve_estudiante(request)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante asociado a la cuenta")

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=False,
        allow_force_password=False,
        mark_profile_complete=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)


def _to_iso(value):
    if not value:
        return timezone.now().isoformat()
    return value.isoformat()


def _format_nota(value: Decimal | float | int | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        normalized = value.normalize()
        text = f"{normalized:f}"
        if "." in text:
            text = text.rstrip("0").rstrip(".")
        return text
    if isinstance(value, float):
        text = f"{value:.2f}".rstrip("0").rstrip(".")
        return text
    return str(value)


def _format_acta_calificacion(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    normalized = text.replace(",", ".")
    upper_value = normalized.upper()
    if upper_value in {
        ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
    }:
        return upper_value
    try:
        number = Decimal(normalized)
    except InvalidOperation:
        return text.upper()
    return _format_nota(number)


def _acta_condicion(calificacion: str | None) -> tuple[str, str]:
    if not calificacion:
        return ("SIN", "Sin resultado")
    normalized = calificacion.strip().upper()
    if normalized == ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO:
        return ("AUS", "Ausente (justificado)")
    if normalized == ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO:
        return ("AUS", "Ausente")
    try:
        valor = Decimal(normalized.replace(",", "."))
    except InvalidOperation:
        return ("DES", "Desaprobado")
    return ("APR", "Aprobado") if valor >= 6 else ("DES", "Desaprobado")


def _correlatividades_qs(
    materia: Materia,
    tipo: str,
    estudiante: Estudiante | None = None,
):
    qs = Correlatividad.objects.filter(materia_origen=materia, tipo=tipo)
    if not estudiante or not materia.plan_de_estudio_id:
        return qs
    profesorado_id = getattr(materia.plan_de_estudio, "profesorado_id", None)
    if not profesorado_id:
        return qs
    cohorte = estudiante.obtener_anio_ingreso(profesorado_id)
    version = CorrelatividadVersion.vigente_para(
        plan_id=materia.plan_de_estudio_id,
        profesorado_id=profesorado_id,
        cohorte=cohorte,
    )
    if version:
        return qs.filter(versiones__version=version)
    return qs


@alumnos_router.post(
    "/inscripcion-materia",
    response={200: InscripcionMateriaOut, 400: ApiResponse, 404: ApiResponse},
)
def inscripcion_materia(request, payload: InscripcionMateriaIn):
    from datetime import datetime

    _ensure_estudiante_access(request, getattr(payload, "dni", None))
    est = _resolve_estudiante(request, getattr(payload, "dni", None))
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante (inicie sesión)")
    mat = Materia.objects.filter(id=payload.materia_id).first()
    if not mat:
        return 404, ApiResponse(ok=False, message="Materia no encontrada")

    anio_actual = datetime.now().year

    # Correlatividades para cursar
    req_reg = list(
        _correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, est).values_list(
            "materia_correlativa_id", flat=True
        )
    )
    req_apr = list(
        _correlatividades_qs(mat, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, est).values_list(
            "materia_correlativa_id", flat=True
        )
    )

    def ultima_situacion(mid: int):
        r = Regularidad.objects.filter(estudiante=est, materia_id=mid).order_by("-fecha_cierre").first()
        return r.situacion if r else None

    faltan = []
    for mid in req_reg:
        s = ultima_situacion(mid)
        if s not in (
            Regularidad.Situacion.REGULAR,
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Regular en {m.nombre if m else mid}")
    for mid in req_apr:
        s = ultima_situacion(mid)
        if s not in (
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Aprobada {m.nombre if m else mid}")
    if faltan:
        return 400, ApiResponse(
            ok=False,
            message="Correlatividades no cumplidas para cursar",
            data={"faltantes": faltan},
        )

    # Superposición horaria
    detalles_cand = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "bloque").filter(
        horario_catedra__espacio=mat
    )
    cand = [
        (
            d.horario_catedra.turno_id,
            d.bloque.dia,
            d.bloque.hora_desde,
            d.bloque.hora_hasta,
        )
        for d in detalles_cand
    ]
    if cand:
        actuales = InscripcionMateriaAlumno.objects.filter(estudiante=est, anio=anio_actual)
        if actuales.exists():
            det_act = HorarioCatedraDetalle.objects.select_related("horario_catedra__turno", "bloque").filter(
                horario_catedra__espacio_id__in=list(actuales.values_list("materia_id", flat=True))
            )
            for d in det_act:
                for t, dia, desde, hasta in cand:
                    if (
                        t == d.horario_catedra.turno_id
                        and dia == d.bloque.dia
                        and not (hasta <= d.bloque.hora_desde or desde >= d.bloque.hora_hasta)
                    ):
                            return 400, ApiResponse(
                                ok=False,
                                message="Superposición horaria con otra materia inscripta",
                            )

    InscripcionMateriaAlumno.objects.get_or_create(estudiante=est, materia=mat, anio=anio_actual)
    return {"message": "Inscripción a materia registrada"}


@alumnos_router.get(
    "/materias-inscriptas",
    response={200: list[MateriaInscriptaItem], 400: ApiResponse},
)
def materias_inscriptas(request, anio: int | None = None, dni: str | None = None):
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    qs = (
        InscripcionMateriaAlumno.objects.filter(estudiante=est)
        .select_related(
            "materia__plan_de_estudio__profesorado",
            "comision__turno",
            "comision__docente",
            "comision__horario",
            "comision_solicitada__turno",
            "comision_solicitada__docente",
            "comision_solicitada__horario",
        )
        .order_by("-anio", "-created_at")
    )
    if anio:
        qs = qs.filter(anio=anio)

    items: list[MateriaInscriptaItem] = []
    for ins in qs:
        materia = ins.materia
        plan = materia.plan_de_estudio
        profesorado = plan.profesorado if plan else None
        # Si la inscripción todavía no fue asignada a una comisión definitiva,
        # reutilizamos la comisión solicitada para exponer los horarios y así
        # poder detectar superposiciones desde el frontend.
        comision_visible = ins.comision or ins.comision_solicitada
        items.append(
            MateriaInscriptaItem(
                inscripcion_id=ins.id,
                materia_id=materia.id,
                materia_nombre=materia.nombre,
                plan_id=plan.id if plan else None,
                profesorado_id=profesorado.id if profesorado else None,
                profesorado_nombre=profesorado.nombre if profesorado else None,
                anio_plan=materia.anio_cursada,
                anio_academico=ins.anio,
                estado=ins.estado,
                estado_display=ins.get_estado_display(),
                comision_actual=_comision_to_resumen(comision_visible),
                comision_solicitada=_comision_to_resumen(ins.comision_solicitada),
                fecha_creacion=(ins.created_at or timezone.now()).isoformat(),
                fecha_actualizacion=(ins.updated_at or ins.created_at or timezone.now()).isoformat(),
            )
        )
    return items


@alumnos_router.post(
    "/inscripcion-materia/{inscripcion_id}/cancelar",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def cancelar_inscripcion_materia(request, inscripcion_id: int, payload: CancelarInscripcionIn):
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    inscripcion = (
        InscripcionMateriaAlumno.objects.filter(id=inscripcion_id, estudiante=est)
        .select_related("materia", "comision")
        .first()
    )
    if not inscripcion:
        return 404, ApiResponse(ok=False, message="Inscripción no encontrada.")

    if inscripcion.estado not in (
        InscripcionMateriaAlumno.Estado.CONFIRMADA,
        InscripcionMateriaAlumno.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(
            ok=False,
            message="Solo se pueden cancelar inscripciones confirmadas o pendientes.",
        )

    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    inscripcion.estado = InscripcionMateriaAlumno.Estado.ANULADA
    inscripcion.comision = None
    inscripcion.comision_solicitada = None
    inscripcion.save(update_fields=["estado", "comision", "comision_solicitada", "updated_at"])

    return ApiResponse(ok=True, message="Inscripción cancelada exitosamente.")


@alumnos_router.post("/cambio-comision", response=CambioComisionOut)
def cambio_comision(request, payload: CambioComisionIn):
    # Placeholder logic
    return {"message": "Solicitud de cambio de comisión recibida."}


@alumnos_router.get("/pedido_analitico", response=PedidoAnaliticoOut, auth=JWTAuth())
def pedido_analitico(request):
    # Placeholder logic
    return {"message": "Solicitud de pedido de analítico recibida."}


@alumnos_router.post("/mesa-examen", response=MesaExamenOut, auth=JWTAuth())
def mesa_examen(request, payload: MesaExamenIn):
    # Placeholder logic
    return {"message": "Solicitud de mesa de examen recibida."}


# Listar mesas disponibles para alumno (por ventana/tipo)
@alumnos_router.get(
    "/mesas",
    response={200: list[dict], 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_mesas_alumno(
    request,
    tipo: str | None = None,
    ventana_id: int | None = None,
    dni: str | None = None,
    solo_rendibles: bool = False,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
):
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    carreras_est = list(est.carreras.all()) if est else []

    plan_obj: PlanDeEstudio | None = None
    plan_profesorado: Profesorado | None = None

    if plan_id is not None:
        plan_obj = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
        if not plan_obj:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
        plan_profesorado = plan_obj.profesorado
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(
                ok=False,
                message="El estudiante no pertenece al profesorado de ese plan.",
            )
    elif profesorado_id is not None:
        plan_profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not plan_profesorado:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado solicitado.")
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no está inscripto en ese profesorado.")
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para listar mesas.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            plan_profesorado = carreras_est[0]

    qs = MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").all()

    if tipo:
        qs = qs.filter(tipo=tipo)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if plan_obj:
        qs = qs.filter(materia__plan_de_estudio=plan_obj)
    elif plan_profesorado:
        qs = qs.filter(materia__plan_de_estudio__profesorado=plan_profesorado)

    out = []
    if not solo_rendibles:
        estudiante_para_rendir = None
    else:
        estudiante_para_rendir = est
        if not estudiante_para_rendir and dni:
            estudiante_para_rendir = Estudiante.objects.filter(dni=dni).first()
        elif not estudiante_para_rendir and not isinstance(request.user, AnonymousUser):
            estudiante_para_rendir = getattr(request.user, "estudiante", None)

    for m in qs.order_by("fecha", "hora_desde"):
        # correlativas que requieren estar APROBADAS PARA RENDIR FINAL
        req_aprob = list(
            _correlatividades_qs(
                m.materia,
                Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
                estudiante_para_rendir,
            ).values_list("materia_correlativa_id", flat=True)
        )
        row = {
            "id": m.id,
            "materia": {
                "id": m.materia_id,
                "nombre": m.materia.nombre,
                "anio": m.materia.anio_cursada,
            },
            "tipo": m.tipo,
            "fecha": m.fecha.isoformat(),
            "hora_desde": str(m.hora_desde) if m.hora_desde else None,
            "hora_hasta": str(m.hora_hasta) if m.hora_hasta else None,
            "aula": m.aula,
            "cupo": m.cupo,
            "correlativas_aprob": req_aprob,
            "plan_id": m.materia.plan_de_estudio_id if m.materia_id else None,
            "profesorado_id": (
                m.materia.plan_de_estudio.profesorado_id if m.materia_id and m.materia.plan_de_estudio_id else None
            ),
        }
        if not solo_rendibles or not estudiante_para_rendir:
            out.append(row)
            continue
        if m.tipo == MesaExamen.Tipo.FINAL:
            legajo_ok = estudiante_para_rendir.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
            if not legajo_ok:
                prof = m.materia.plan_de_estudio.profesorado if m.materia and m.materia.plan_de_estudio else None
                pre = (
                    (
                        Preinscripcion.objects.filter(alumno=estudiante_para_rendir, carrera=prof)
                        .order_by("-anio", "-id")
                        .first()
                    )
                    if prof
                    else None
                )
                cl = getattr(pre, "checklist", None) if pre else None
                if not (cl and cl.certificado_titulo_en_tramite):
                    continue
            reg = (
                Regularidad.objects.filter(estudiante=estudiante_para_rendir, materia=m.materia)
                .order_by("-fecha_cierre")
                .first()
            )
            if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                continue
            from datetime import date

            def _add_years(d: date, years: int) -> date:
                try:
                    return d.replace(year=d.year + years)
                except ValueError:
                    return d.replace(month=2, day=28, year=d.year + years)

            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = (
                MesaExamen.objects.filter(materia=m.materia, tipo=MesaExamen.Tipo.FINAL, fecha__gte=two_years)
                .order_by("fecha")
                .values_list("fecha", flat=True)
                .first()
            )
            allowed_until = next_call or two_years
            if m.fecha > allowed_until:
                continue
            if req_aprob:
                regs = Regularidad.objects.filter(estudiante=estudiante_para_rendir, materia_id__in=req_aprob).order_by(
                    "materia_id", "-fecha_cierre"
                )
                latest = {}
                for r in regs:
                    latest.setdefault(r.materia_id, r)
                ok = True
                for mid in req_aprob:
                    r = latest.get(mid)
                    if not r or r.situacion not in (
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                    ):
                        ok = False
                        break
                if not ok:
                    continue
        out.append(row)
    return out


# Inscripción a mesa (alumno o por DNI para roles)
@alumnos_router.post("/inscribir_mesa", response=InscripcionMesaOut, auth=JWTAuth())
def inscribir_mesa(request, payload: InscripcionMesaIn):
    mesa = MesaExamen.objects.filter(id=payload.mesa_id).select_related("materia__plan_de_estudio__profesorado").first()
    if not mesa:
        return 404, {"message": "Mesa no encontrada"}
    # Resolver estudiante
    est = None
    if payload.dni:
        est = Estudiante.objects.filter(dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, "estudiante", None)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}
    # Cupo
    if mesa.cupo and mesa.inscripciones.filter(estado=InscripcionMesa.Estado.INSCRIPTO).count() >= mesa.cupo:
        return 400, {"message": "Cupo completo"}

    # Validaciones para Finales
    if mesa.tipo == MesaExamen.Tipo.FINAL:
        # 1) Legajo completo o excepción por 'Título en trámite'
        if est.estado_legajo != Estudiante.EstadoLegajo.COMPLETO:
            prof = mesa.materia.plan_de_estudio.profesorado if mesa.materia and mesa.materia.plan_de_estudio else None
            pre = None
            if prof:
                pre = Preinscripcion.objects.filter(alumno=est, carrera=prof).order_by("-anio", "-id").first()
            cl = getattr(pre, "checklist", None) if pre else None
            if not (cl and cl.certificado_titulo_en_tramite):
                return 400, {
                    "message": "Legajo condicional/pending: no puede rendir Final (salvo 'Título en trámite')."
                }

        # 2) Regularidad vigente en la materia
        reg = Regularidad.objects.filter(estudiante=est, materia=mesa.materia).order_by("-fecha_cierre").first()
        if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
            if reg and reg.situacion == Regularidad.Situacion.PROMOCIONADO:
                return 400, {"message": "Materia promocionada: no requiere final."}
            return 400, {"message": "No posee regularidad vigente en la materia."}

        # 2.b) Vigencia: 2 años y el siguiente llamado posterior
        from datetime import date

        def _add_years(d: date, years: int) -> date:
            try:
                return d.replace(year=d.year + years)
            except ValueError:
                # Ajuste para 29/02 → 28/02 en años no bisiestos
                return d.replace(month=2, day=28, year=d.year + years)

        two_years = _add_years(reg.fecha_cierre, 2)
        next_call = (
            MesaExamen.objects.filter(materia=mesa.materia, tipo=MesaExamen.Tipo.FINAL, fecha__gte=two_years)
            .order_by("fecha")
            .values_list("fecha", flat=True)
            .first()
        )
        allowed_until = next_call or two_years
        if mesa.fecha > allowed_until:
            return 400, {"message": "Venció la vigencia de regularidad (2 años y un llamado). Debe recursar."}

        intentos = InscripcionMesa.objects.filter(
            estudiante=est,
            estado=InscripcionMesa.Estado.INSCRIPTO,
            mesa__materia=mesa.materia,
            mesa__tipo=MesaExamen.Tipo.FINAL,
            mesa__fecha__gte=reg.fecha_cierre,
            mesa__fecha__lte=allowed_until,
        ).count()
        if intentos >= 3:
            return 400, {"message": "Ya usaste 3 llamados de final dentro de la vigencia. Debe recursar."}

        # 3) Correlatividades APR (aprobadas o promocionadas)
        req_ids = list(
            _correlatividades_qs(
                mesa.materia,
                Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
                est,
            ).values_list("materia_correlativa_id", flat=True)
        )
        if req_ids:
            faltan = []
            regs = Regularidad.objects.filter(estudiante=est, materia_id__in=req_ids).order_by(
                "materia_id", "-fecha_cierre"
            )
            latest: dict[int, Regularidad] = {}
            for r in regs:
                latest.setdefault(r.materia_id, r)
            for mid in req_ids:
                r = latest.get(mid)
                if not r or r.situacion not in (
                    Regularidad.Situacion.APROBADO,
                    Regularidad.Situacion.PROMOCIONADO,
                ):
                    m = Materia.objects.filter(id=mid).first()
                    faltan.append(m.nombre if m else f"Materia {mid}")
            if faltan:
                return 400, {
                    "message": "Correlativas sin aprobar para rendir final",
                    "faltantes": faltan,
                }
    ins, created = InscripcionMesa.objects.get_or_create(mesa=mesa, estudiante=est)
    if not created and ins.estado == InscripcionMesa.Estado.INSCRIPTO:
        return 400, {"message": "Ya estabas inscripto"}
    ins.estado = InscripcionMesa.Estado.INSCRIPTO
    ins.save()
    return {"message": "Inscripción registrada"}


# Nuevos endpoints
@alumnos_router.get(
    "/materias-plan",
    response={
        200: list[MateriaPlan],
        400: ApiResponse,
        403: ApiResponse,
        404: ApiResponse,
    },
)
def materias_plan(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    dni: str | None = None,
):
    """Devuelve las materias del plan de estudio elegido para el alumno."""
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    carreras_est = list(est.carreras.all()) if est else []
    plan_profesorado: Profesorado | None = None

    plan: PlanDeEstudio | None = None
    if plan_id is not None:
        plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
        if not plan:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
        plan_profesorado = plan.profesorado
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(
                ok=False,
                message="El estudiante no pertenece al profesorado de ese plan.",
            )
    elif profesorado_id is not None:
        plan_profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not plan_profesorado:
            return 404, ApiResponse(ok=False, message="No se encontró el profesorado solicitado.")
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no está inscripto en ese profesorado.")
        plan = PlanDeEstudio.objects.filter(profesorado=plan_profesorado).order_by("-vigente", "-anio_inicio").first()
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para continuar.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            plan_profesorado = carreras_est[0]
            plan = (
                PlanDeEstudio.objects.filter(profesorado=plan_profesorado).order_by("-vigente", "-anio_inicio").first()
            )
        else:
            plan = (
                PlanDeEstudio.objects.select_related("profesorado")
                .filter(vigente=True)
                .order_by("-anio_inicio")
                .first()
            )
            if plan:
                plan_profesorado = plan.profesorado

    if not plan or not plan_profesorado:
        return 404, ApiResponse(ok=False, message="No se pudo resolver un plan de estudio válido.")

    # Helper: map regimen -> cuatrimestre label
    def map_cuat(regimen: str) -> str:
        return (
            "ANUAL"
            if regimen == Materia.TipoCursada.ANUAL
            else ("1C" if regimen == Materia.TipoCursada.PRIMER_CUATRIMESTRE else "2C")
        )

    # Horarios por materia (último año disponible, consolidado por bloque)
    def horarios_para(m: Materia) -> list[Horario]:
        hcs = HorarioCatedra.objects.filter(espacio=m).annotate(max_anio=Max("anio_cursada")).order_by("-anio_cursada")
        if not hcs:
            return []
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__in=hcs[:1]).select_related(
            "bloque", "horario_catedra"
        )
        hs: list[Horario] = []
        for d in detalles:
            b: Bloque = d.bloque
            hs.append(
                Horario(
                    dia=b.get_dia_display(),
                    desde=str(b.hora_desde)[:5],
                    hasta=str(b.hora_hasta)[:5],
                )
            )
        # Ordenar por día/hora
        return sorted(hs, key=lambda x: (x.dia, x.desde))

    # Correlatividades por tipo
    def correlativas_ids(m: Materia, tipo: str, estudiante: Estudiante | None = None) -> list[int]:
        return list(
            _correlatividades_qs(m, tipo, estudiante).values_list("materia_correlativa_id", flat=True)
        )

    materias = []
    for m in plan.materias.all().order_by("anio_cursada", "nombre"):
        materias.append(
            MateriaPlan(
                id=m.id,
                nombre=m.nombre,
                anio=m.anio_cursada,
                cuatrimestre=map_cuat(m.regimen),
                horarios=horarios_para(m),
                correlativas_regular=correlativas_ids(m, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR),
                correlativas_aprob=correlativas_ids(m, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR),
                profesorado=plan_profesorado.nombre,
                profesorado_id=plan_profesorado.id,
                plan_id=plan.id,
            )
        )
    return materias


@alumnos_router.get(
    "/horarios",
    response={
        200: list[HorarioTabla],
        400: ApiResponse,
        403: ApiResponse,
        404: ApiResponse,
    },
)
def horarios_profesorado(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    turno_id: int | None = None,
    anio_plan: int | None = None,
    cuatrimestre: str | None = None,
    dni: str | None = None,
):
    est = _resolve_estudiante(request, dni)
    if dni and not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante indicado.")
    carreras_est = list(est.carreras.all()) if est else []

    profesorado: Profesorado | None = None
    if profesorado_id is not None:
        profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not profesorado:
            return 404, ApiResponse(ok=False, message="No se encontro el profesorado solicitado.")
        if est and profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no pertenece a ese profesorado.")
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene profesorados asociados.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Debe seleccionar un profesorado para continuar.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            profesorado = carreras_est[0]
        else:
            return 400, ApiResponse(ok=False, message="Debe indicar un profesorado.")

    plan: PlanDeEstudio | None = None
    planes_qs = (
        PlanDeEstudio.objects.select_related("profesorado")
        .filter(profesorado=profesorado)
        .order_by("-vigente", "-anio_inicio", "resolucion")
    )
    if plan_id is not None:
        plan = planes_qs.filter(id=plan_id).first()
        if not plan:
            return 404, ApiResponse(ok=False, message="No se encontró el plan de estudio solicitado.")
    else:
        planes_list = list(planes_qs)
        if not planes_list:
            return 404, ApiResponse(ok=False, message="El profesorado no tiene planes asociados.")
        if len(planes_list) > 1:
            return 400, ApiResponse(
                ok=False,
                message="Debe seleccionar un plan de estudio para continuar.",
                data={
                    "planes": [
                        {
                            "id": p.id,
                            "resolucion": p.resolucion or "",
                            "anio_inicio": getattr(p, "anio_inicio", None),
                            "vigente": bool(getattr(p, "vigente", False)),
                        }
                        for p in planes_list
                    ]
                },
            )
        plan = planes_list[0]

    horarios_qs = (
        HorarioCatedra.objects.filter(espacio__plan_de_estudio=plan)
        .select_related("espacio", "espacio__plan_de_estudio", "turno")
        .prefetch_related("detalles__bloque", "comisiones__docente")
    )

    if turno_id is not None:
        horarios_qs = horarios_qs.filter(turno_id=turno_id)
    if anio_plan is not None:
        horarios_qs = horarios_qs.filter(anio_cursada=anio_plan)
    if cuatrimestre:
        valor = cuatrimestre.upper()
        if valor == "ANUAL":
            horarios_qs = horarios_qs.filter(Q(cuatrimestre__isnull=True) | Q(cuatrimestre=Materia.TipoCursada.ANUAL))
        elif valor == "1C":
            horarios_qs = horarios_qs.filter(cuatrimestre=Materia.TipoCursada.PRIMER_CUATRIMESTRE)
        elif valor == "2C":
            horarios_qs = horarios_qs.filter(cuatrimestre=Materia.TipoCursada.SEGUNDO_CUATRIMESTRE)

    tablas = _construir_tablas_horario(profesorado, plan, list(horarios_qs))
    return tablas


@alumnos_router.get(
    "/carreras-activas",
    response={200: list[CarreraDetalleResumen], 404: ApiResponse},
)
def carreras_activas(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")
    carreras_est = list(est.carreras.all())
    if not carreras_est:
        return []
    detalle = _listar_carreras_detalle(est, carreras_est)
    return [
        CarreraDetalleResumen(
            profesorado_id=item["profesorado_id"],
            nombre=item["nombre"],
            planes=[
                CarreraPlanResumen(
                    id=plan["id"],
                    resolucion=plan["resolucion"],
                    vigente=plan["vigente"],
                )
                for plan in item["planes"]
            ],
        )
        for item in detalle
    ]


@alumnos_router.get("/historial", response=HistorialAlumno, auth=JWTAuth())
def historial_alumno(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return HistorialAlumno(aprobadas=[], regularizadas=[], inscriptas_actuales=[])

    aprobadas = list(
        Regularidad.objects.filter(
            estudiante=est,
            situacion__in=[
                Regularidad.Situacion.APROBADO,
                Regularidad.Situacion.PROMOCIONADO,
            ],
        ).values_list("materia_id", flat=True)
    )
    regularizadas = list(
        Regularidad.objects.filter(estudiante=est, situacion=Regularidad.Situacion.REGULAR).values_list(
            "materia_id", flat=True
        )
    )
    inscriptas_actuales = list(
        InscripcionMateriaAlumno.objects.filter(
            estudiante=est,
            estado__in=[
                InscripcionMateriaAlumno.Estado.CONFIRMADA,
                InscripcionMateriaAlumno.Estado.PENDIENTE,
            ],
        ).values_list("materia_id", flat=True)
    )

    return HistorialAlumno(
        aprobadas=aprobadas,
        regularizadas=regularizadas,
        inscriptas_actuales=inscriptas_actuales,
    )


@alumnos_router.get("/trayectoria", response={200: TrayectoriaOut, 404: ApiResponse})
def trayectoria_alumno(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")

    carreras_est = list(est.carreras.order_by("nombre"))
    carreras = [profesorado.nombre for profesorado in carreras_est]

    eventos_raw: list[dict] = []
    mesas_raw: list[dict] = []

    preinscripciones = list(Preinscripcion.objects.filter(alumno=est).select_related("carrera").order_by("-created_at"))
    for pre in preinscripciones:
        eventos_raw.append(
            {
                "id": f"pre-{pre.id}",
                "tipo": "preinscripcion",
                "fecha": _to_iso(pre.created_at or pre.updated_at),
                "titulo": f"Preinscripción a {pre.carrera.nombre}",
                "subtitulo": pre.estado,
                "detalle": None,
                "estado": pre.estado,
                "profesorado_id": pre.carrera_id,
                "profesorado_nombre": pre.carrera.nombre,
                "metadata": _metadata_str(
                    {
                        "carrera": pre.carrera.nombre,
                        "anio": pre.anio,
                        "codigo": pre.codigo,
                    }
                ),
            }
        )

    inscripciones_qs = (
        InscripcionMateriaAlumno.objects.filter(estudiante=est)
        .select_related(
            "materia",
            "materia__plan_de_estudio",
            "materia__plan_de_estudio__profesorado",
            "comision",
            "comision__turno",
            "comision_solicitada",
        )
        .order_by("-created_at")
    )
    inscripciones = list(inscripciones_qs)
    for insc in inscripciones:
        detalle = None
        if insc.comision:
            detalle = f"Comisión {insc.comision.codigo}"
        elif insc.comision_solicitada:
            detalle = f"Cambio solicitado a {insc.comision_solicitada.codigo}"
        plan_estudio = getattr(insc.materia, "plan_de_estudio", None)
        profesorado = getattr(plan_estudio, "profesorado", None)
        eventos_raw.append(
            {
                "id": f"insc-{insc.id}",
                "tipo": "inscripcion_materia",
                "fecha": _to_iso(insc.created_at or insc.updated_at),
                "titulo": f"Inscripción a {insc.materia.nombre}",
                "subtitulo": f"Año académico {insc.anio}",
                "detalle": detalle,
                "estado": insc.estado,
                "profesorado_id": getattr(profesorado, "id", None),
                "profesorado_nombre": getattr(profesorado, "nombre", None),
                "metadata": _metadata_str(
                    {
                        "materia": insc.materia.nombre,
                        "materia_id": insc.materia_id,
                        "estado": insc.get_estado_display(),
                        "anio": insc.anio,
                    }
                ),
            }
        )

    regularidades_qs = (
        Regularidad.objects.filter(estudiante=est)
        .select_related(
            "materia",
            "materia__plan_de_estudio",
            "materia__plan_de_estudio__profesorado",
        )
        .order_by("-fecha_cierre")
    )
    regularidades = list(regularidades_qs)
    regularidad_map: dict[int, Regularidad] = {}
    for reg in regularidades:
        if reg.materia_id not in regularidad_map:
            regularidad_map[reg.materia_id] = reg

    regularidades_resumen_data: list[dict] = []
    regularidades_vigencia_data: list[dict] = []
    finales_habilitados_data: list[dict] = []
    alertas: list[str] = []

    hoy = timezone.now().date()
    for reg in regularidades:
        vigencia_iso = None
        vigente = None
        dias_restantes: int | None = None
        if reg.situacion == Regularidad.Situacion.REGULAR:
            vigencia_limite, intentos = _calcular_vigencia_regularidad(est, reg)
            dias_restantes = (vigencia_limite - hoy).days
            vigente = dias_restantes >= 0
            vigencia_iso = vigencia_limite.isoformat()
            regularidades_vigencia_data.append(
                {
                    "materia_id": reg.materia_id,
                    "materia_nombre": reg.materia.nombre,
                    "situacion": reg.situacion,
                    "situacion_display": reg.get_situacion_display(),
                    "fecha_cierre": reg.fecha_cierre.isoformat(),
                    "vigencia_hasta": vigencia_iso,
                    "dias_restantes": dias_restantes,
                    "vigente": vigente,
                    "intentos_usados": intentos,
                    "intentos_max": 3,
                }
            )
            if vigente:
                comentarios: list[str] = []
                if dias_restantes <= 30:
                    comentarios.append("La regularidad vence en menos de 30 días.")
                finales_habilitados_data.append(
                    {
                        "materia_id": reg.materia_id,
                        "materia_nombre": reg.materia.nombre,
                        "regularidad_fecha": reg.fecha_cierre.isoformat(),
                        "vigencia_hasta": vigencia_iso,
                        "dias_restantes": dias_restantes,
                        "comentarios": comentarios,
                    }
                )
            else:
                alertas.append(f"La regularidad de {reg.materia.nombre} está vencida desde {vigencia_iso}.")
        regularidades_resumen_data.append(
            {
                "id": reg.id,
                "materia_id": reg.materia_id,
                "materia_nombre": reg.materia.nombre,
                "situacion": reg.situacion,
                "situacion_display": reg.get_situacion_display(),
                "fecha_cierre": reg.fecha_cierre.isoformat(),
                "nota_tp": (float(reg.nota_trabajos_practicos) if reg.nota_trabajos_practicos is not None else None),
                "nota_final": reg.nota_final_cursada,
                "asistencia": reg.asistencia_porcentaje,
                "excepcion": reg.excepcion,
                "observaciones": reg.observaciones,
                "vigencia_hasta": vigencia_iso,
                "vigente": vigente,
                "dias_restantes": dias_restantes,
            }
        )
        if dias_restantes is not None and dias_restantes >= 0 and dias_restantes <= 30:
            alertas.append(f"La regularidad de {reg.materia.nombre} vence en {dias_restantes} días.")

        plan_estudio_reg = getattr(reg.materia, "plan_de_estudio", None)
        profesorado_reg = getattr(plan_estudio_reg, "profesorado", None)
        eventos_raw.append(
            {
                "id": f"reg-{reg.id}",
                "tipo": "regularidad",
                "fecha": reg.fecha_cierre.isoformat(),
                "titulo": reg.materia.nombre,
                "subtitulo": reg.get_situacion_display(),
                "detalle": reg.observaciones or None,
                "estado": reg.situacion,
                "profesorado_id": getattr(profesorado_reg, "id", None),
                "profesorado_nombre": getattr(profesorado_reg, "nombre", None),
                "metadata": _metadata_str(
                    {
                        "nota_tp": reg.nota_trabajos_practicos,
                        "nota_final": reg.nota_final_cursada,
                        "asistencia": reg.asistencia_porcentaje,
                    }
                ),
            }
        )

    mesas_qs = (
        InscripcionMesa.objects.filter(estudiante=est)
        .select_related(
            "mesa__materia",
            "mesa__materia__plan_de_estudio",
            "mesa__materia__plan_de_estudio__profesorado",
        )
        .order_by("-mesa__fecha", "-created_at")
    )
    mesas = list(mesas_qs)
    finales_map: dict[int, InscripcionMesa] = {}
    for insc in mesas:
        mesa = insc.mesa
        plan_materia = getattr(mesa.materia, "plan_de_estudio", None)
        profesorado_mesa = getattr(plan_materia, "profesorado", None)
        mesas_raw.append(
            {
                "id": insc.id,
                "mesa_id": mesa.id,
                "materia_id": mesa.materia_id,
                "materia_nombre": mesa.materia.nombre,
                "tipo": mesa.tipo,
                "tipo_display": mesa.get_tipo_display(),
                "fecha": mesa.fecha.isoformat(),
                "estado": insc.estado,
                "estado_display": insc.get_estado_display(),
                "aula": mesa.aula,
                "nota": None,
            }
        )
        eventos_raw.append(
            {
                "id": f"mesa-{insc.id}",
                "tipo": "mesa",
                "fecha": mesa.fecha.isoformat(),
                "titulo": f"Mesa {mesa.get_tipo_display()}",
                "subtitulo": mesa.materia.nombre,
                "detalle": mesa.aula,
                "estado": insc.estado,
                "profesorado_id": getattr(profesorado_mesa, "id", None),
                "profesorado_nombre": getattr(profesorado_mesa, "nombre", None),
                "metadata": _metadata_str(
                    {
                        "mesa_id": mesa.id,
                        "estado": insc.get_estado_display(),
                    }
                ),
            }
        )
        if mesa.tipo == MesaExamen.Tipo.FINAL and mesa.materia_id not in finales_map:
            finales_map[mesa.materia_id] = insc

    actas_finales_map: dict[int, ActaExamenAlumno] = {}
    actas_qs = (
        ActaExamenAlumno.objects.filter(dni=est.dni)
        .select_related(
            "acta",
            "acta__materia",
            "acta__profesorado",
            "acta__plan",
        )
        .order_by("-acta__fecha", "-acta__id", "-id")
    )
    for acta_fila in actas_qs:
        acta = acta_fila.acta
        condicion_codigo, condicion_display = _acta_condicion(acta_fila.calificacion_definitiva)
        nota_formateada = _format_acta_calificacion(acta_fila.calificacion_definitiva)
        eventos_raw.append(
            {
                "id": f"acta-{acta.id}-{acta_fila.id}",
                "tipo": "nota",
                "fecha": acta.fecha.isoformat(),
                "titulo": f"Acta de examen - {acta.materia.nombre}",
                "subtitulo": condicion_display,
                "detalle": acta_fila.observaciones or acta.observaciones or None,
                "estado": condicion_codigo,
                "profesorado_id": getattr(acta.profesorado, "id", None),
                "profesorado_nombre": getattr(acta.profesorado, "nombre", None),
                "metadata": _metadata_str(
                    {
                        "materia": acta.materia.nombre,
                        "materia_id": acta.materia_id,
                        "nota": nota_formateada or acta_fila.calificacion_definitiva,
                        "folio": acta.folio,
                        "libro": acta.libro,
                        "acta_codigo": acta.codigo,
                    }
                ),
            }
        )
        if acta.materia_id not in actas_finales_map:
            actas_finales_map[acta.materia_id] = acta_fila

    aprobadas_set = {
        reg.materia_id
        for reg in regularidades
        if reg.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO)
    }
    regularizadas_set = {reg.materia_id for reg in regularidades if reg.situacion == Regularidad.Situacion.REGULAR}
    inscriptas_actuales_set = {
        insc.materia_id
        for insc in inscripciones
        if insc.estado
        in (
            InscripcionMateriaAlumno.Estado.CONFIRMADA,
            InscripcionMateriaAlumno.Estado.PENDIENTE,
        )
    }

    carton_planes: list[CartonPlan] = []
    total_materias = 0
    carreras_detalle_data: list[dict] = []
    for profesorado in carreras_est:
        planes_prof = list(PlanDeEstudio.objects.filter(profesorado=profesorado).order_by("resolucion"))
        carreras_detalle_data.append(
            {
                "profesorado_id": profesorado.id,
                "nombre": profesorado.nombre,
                "planes": [
                    {
                        "id": plan.id,
                        "resolucion": plan.resolucion or "",
                        "vigente": bool(getattr(plan, "vigente", False)),
                    }
                    for plan in planes_prof
                ],
            }
        )
        for plan in planes_prof:
            materias_qs = Materia.objects.filter(plan_de_estudio=plan).order_by("anio_cursada", "regimen", "nombre")
            materias_out: list[CartonMateria] = []
            for materia in materias_qs:
                reg = regularidad_map.get(materia.id)
                regularidad_evt = None
                if reg:
                    nota_reg = _format_nota(
                        reg.nota_final_cursada if reg.nota_final_cursada is not None else reg.nota_trabajos_practicos
                    )
                    regularidad_evt = CartonEvento(
                        fecha=reg.fecha_cierre.isoformat(),
                        condicion=reg.get_situacion_display(),
                        nota=nota_reg,
                    )

                final_insc = finales_map.get(materia.id)
                acta_fila = actas_finales_map.get(materia.id)
                final_evt = None
                if final_insc or acta_fila:
                    final_fecha = None
                    final_condicion = None
                    final_nota = None
                    final_folio = None
                    final_libro = None
                    final_id_fila = None

                    if final_insc:
                        mesa_final = final_insc.mesa
                        if final_insc.fecha_resultado:
                            final_fecha = final_insc.fecha_resultado.isoformat()
                        elif mesa_final and mesa_final.fecha:
                            final_fecha = mesa_final.fecha.isoformat()
                        if final_insc.condicion:
                            final_condicion = final_insc.get_condicion_display()
                        else:
                            final_condicion = final_insc.get_estado_display()
                        if final_insc.nota is not None:
                            final_nota = _format_nota(final_insc.nota)
                        if final_insc.folio:
                            final_folio = final_insc.folio
                        if final_insc.libro:
                            final_libro = final_insc.libro

                    if acta_fila:
                        final_fecha = acta_fila.acta.fecha.isoformat()
                        _, condicion_display = _acta_condicion(acta_fila.calificacion_definitiva)
                        final_condicion = condicion_display
                        nota_acta = _format_acta_calificacion(acta_fila.calificacion_definitiva)
                        if nota_acta:
                            final_nota = nota_acta
                        elif final_nota is None:
                            final_nota = acta_fila.calificacion_definitiva
                        if acta_fila.acta.folio:
                            final_folio = acta_fila.acta.folio
                        if acta_fila.acta.libro:
                            final_libro = acta_fila.acta.libro
                        final_id_fila = acta_fila.id

                    final_evt = CartonEvento(
                        fecha=final_fecha,
                        condicion=final_condicion,
                        nota=final_nota,
                        folio=final_folio,
                        libro=final_libro,
                        id_fila=final_id_fila,
                    )

                materias_out.append(
                    CartonMateria(
                        materia_id=materia.id,
                        materia_nombre=materia.nombre,
                        anio=materia.anio_cursada,
                        regimen=materia.regimen,
                        regimen_display=materia.get_regimen_display(),
                        regularidad=regularidad_evt,
                        final=final_evt,
                    )
                )

            if materias_out:
                total_materias += len(materias_out)
                carton_planes.append(
                    CartonPlan(
                        profesorado_id=profesorado.id,
                        profesorado_nombre=profesorado.nombre,
                        plan_id=plan.id,
                        plan_resolucion=plan.resolucion or "",
                        materias=materias_out,
                    )
                )

    regularizadas_sin_final = regularizadas_set.difference(aprobadas_set)

    confirmada_pre = next(
        (pre for pre in preinscripciones if (pre.estado or "").upper() == "CONFIRMADA"),
        None,
    )
    cohorte_val = None
    if confirmada_pre:
        if getattr(confirmada_pre, "anio", None):
            cohorte_val = str(confirmada_pre.anio)
        else:
            referencia = confirmada_pre.updated_at or confirmada_pre.created_at
            if referencia:
                cohorte_val = str(referencia.year)

    extra_sources = [extra for extra in (getattr(pre, "datos_extra", None) or {} for pre in preinscripciones) if extra]

    def _extra_value(*keys):
        for extra in extra_sources:
            for key in keys:
                value = extra.get(key)
                if value not in (None, "", []):
                    return value
        return None

    def _to_bool(value):
        if isinstance(value, bool):
            return value
        if value is None:
            return None
        if isinstance(value, int | float):
            return value != 0
        text = str(value).strip().lower()
        if not text:
            return None
        if text in {"si", "sí", "true", "1", "entregado", "presentado"}:
            return True
        if text in {"no", "false", "0", "pendiente", "ausente"}:
            return False
        return None

    lugar_nacimiento = _extra_value("lugar_nacimiento", "lugarNacimiento")
    curso_introductorio = _extra_value("curso_introductorio", "cursoIntroductorio")
    promedio_general = _extra_value("promedio_general", "promedioGeneral")
    libreta_extra = _extra_value("libreta_entregada", "libretaEntregada", "libreta")
    foto_url = _extra_value("foto_dataUrl", "foto_4x4_dataurl")
    libreta_entregada = _to_bool(libreta_extra)
    if libreta_entregada is None:
        libreta_entregada = est.documentacion_presentada.exists()

    promedio_general_str = None
    if promedio_general is not None:
        promedio_general_str = str(promedio_general)

    estudiante_out = EstudianteResumen(
        dni=est.dni,
        legajo=est.legajo,
        apellido_nombre=est.user.get_full_name() if est.user_id else "",
        carreras=carreras,
        carreras_detalle=carreras_detalle_data,
        email=est.user.email if est.user_id else None,
        telefono=est.telefono or None,
        fecha_nacimiento=(est.fecha_nacimiento.isoformat() if est.fecha_nacimiento else None),
        lugar_nacimiento=lugar_nacimiento,
        curso_introductorio=curso_introductorio,
        promedio_general=promedio_general_str,
        libreta_entregada=bool(libreta_entregada),
        legajo_estado=est.get_estado_legajo_display(),
        cohorte=cohorte_val,
        activo=est.user.is_active if est.user_id else None,
        materias_totales=total_materias or None,
        materias_aprobadas=len(aprobadas_set),
        materias_regularizadas=len(regularizadas_sin_final),
        materias_en_curso=len(inscriptas_actuales_set),
        fotoUrl=foto_url,
    )

    eventos_raw.sort(key=lambda item: item["fecha"], reverse=True)
    mesas_raw.sort(key=lambda item: item["fecha"], reverse=True)
    regularidades_resumen_data.sort(key=lambda item: item["fecha_cierre"], reverse=True)
    regularidades_vigencia_data.sort(key=lambda item: item["vigencia_hasta"] if item["vigencia_hasta"] else "")
    finales_habilitados_data.sort(
        key=lambda item: (item["dias_restantes"] if item["dias_restantes"] is not None else 9999)
    )
    alertas = list(dict.fromkeys(alertas))

    recomendaciones = RecomendacionesOut(
        materias_sugeridas=[],
        finales_habilitados=[FinalHabilitado(**item) for item in finales_habilitados_data],
        alertas=alertas,
    )

    trayectoria = TrayectoriaOut(
        estudiante=estudiante_out,
        historial=[TrayectoriaEvento(**item) for item in eventos_raw],
        mesas=[TrayectoriaMesa(**item) for item in mesas_raw],
        regularidades=[RegularidadResumen(**item) for item in regularidades_resumen_data],
        recomendaciones=recomendaciones,
        regularidades_vigencia=[RegularidadVigenciaOut(**item) for item in regularidades_vigencia_data],
        aprobadas=sorted(aprobadas_set),
        regularizadas=sorted(regularizadas_set),
        inscriptas_actuales=sorted(inscriptas_actuales_set),
        carton=carton_planes,
        updated_at=timezone.now().isoformat(),
    )

    return trayectoria


@alumnos_router.get("/equivalencias", response=list[EquivalenciaItem], auth=JWTAuth())
def equivalencias_para_materia(request, materia_id: int):
    """Devuelve materias equivalentes (otros profesorados) para la materia indicada.

    Requiere que exista un registro de EquivalenciaCurricular que relacione la materia con sus equivalentes.
    """
    try:
        m = Materia.objects.get(id=materia_id)
    except Materia.DoesNotExist:
        return []
    grupos = EquivalenciaCurricular.objects.filter(materias=m)
    if not grupos.exists():
        # fallback por nombre exacto (no recomendado, pero útil mientras se cargan equivalencias)
        candidates = Materia.objects.filter(nombre__iexact=m.nombre).exclude(id=m.id)
        items: list[EquivalenciaItem] = []
        for mm in candidates:
            # Horarios simplificados
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
    # Usar equivalencias cargadas
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


def _formatear_rango_ventana(ventana, ventana_id: int) -> str:
    if not ventana:
        return f"Ventana ID: {ventana_id}"
    rango = f"{ventana.desde.strftime('%d/%m/%Y')} - {ventana.hasta.strftime('%d/%m/%Y')}"
    etiqueta = " (Activo)" if ventana.activo else ""
    return f"Ventana: {rango}{etiqueta}"


@alumnos_router.get("/analiticos/pdf")
def analiticos_pdf(request, ventana_id: int):
    qs = (
        PedidoAnalitico.objects.select_related("estudiante__user", "profesorado", "ventana")
        .filter(ventana_id=ventana_id)
        .order_by("-created_at")
    )
    ventana = VentanaHabilitacion.objects.filter(id=ventana_id).first()
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="analiticos_{ventana_id}.pdf"'

    doc = SimpleDocTemplate(
        response,
        pagesize=A4,
        rightMargin=24,
        leftMargin=24,
        topMargin=24,
        bottomMargin=24,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Pedidos de Analitico", styles["Title"]))
    story.append(Paragraph(_formatear_rango_ventana(ventana, ventana_id), styles["Normal"]))
    story.append(Spacer(1, 12))

    data = [["DNI", "Apellido y Nombre", "Profesorado", "Cohorte", "Fecha solicitud"]]
    for p in qs:
        est = p.estudiante
        data.append(
            [
                est.dni,
                est.user.get_full_name() if est.user_id else "",
                p.profesorado.nombre if p.profesorado_id else "",
                str(p.cohorte or ""),
                p.created_at.strftime("%d/%m/%Y %H:%M"),
            ]
        )

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return response


@alumnos_router.get("/analiticos_ext", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico_ext(request, ventana_id: int, dni: str | None = None):
    qs = PedidoAnalitico.objects.select_related("estudiante__user", "profesorado", "ventana").filter(
        ventana_id=ventana_id
    )
    if dni:
        qs = qs.filter(estudiante__dni=dni)
    qs = qs.order_by("-created_at")
    out: list[PedidoAnaliticoItem] = []
    for p in qs:
        est = p.estudiante
        out.append(
            PedidoAnaliticoItem(
                dni=est.dni,
                apellido_nombre=est.user.get_full_name() if est.user_id else "",
                profesorado=p.profesorado.nombre if p.profesorado_id else None,
                anio_cursada=None,
                cohorte=p.cohorte,
                fecha_solicitud=p.created_at.isoformat(),
                motivo=p.motivo,
                motivo_otro=p.motivo_otro,
            )
        )
    return out


@alumnos_router.get("/analiticos_ext/pdf")
def analiticos_ext_pdf(request, ventana_id: int, dni: str | None = None):
    qs = PedidoAnalitico.objects.select_related("estudiante__user", "profesorado", "ventana").filter(
        ventana_id=ventana_id
    )
    if dni:
        qs = qs.filter(estudiante__dni=dni)
    qs = qs.order_by("-created_at")
    ventana = VentanaHabilitacion.objects.filter(id=ventana_id).first()

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="analiticos_{ventana_id}.pdf"'

    doc = SimpleDocTemplate(
        response,
        pagesize=A4,
        rightMargin=24,
        leftMargin=24,
        topMargin=24,
        bottomMargin=24,
    )
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Pedidos de Analitico", styles["Title"]))
    story.append(Paragraph(_formatear_rango_ventana(ventana, ventana_id), styles["Normal"]))
    story.append(Spacer(1, 12))

    data = [
        [
            "DNI",
            "Apellido y Nombre",
            "Profesorado",
            "Cohorte",
            "Fecha solicitud",
            "Motivo",
        ]
    ]
    for p in qs:
        est = p.estudiante
        motivo_txt = p.get_motivo_display() if hasattr(p, "get_motivo_display") else str(p.motivo)
        if p.motivo == "otro" and p.motivo_otro:
            motivo_txt += f" - {p.motivo_otro}"
        data.append(
            [
                est.dni,
                est.user.get_full_name() if est.user_id else "",
                p.profesorado.nombre if p.profesorado_id else "",
                str(p.cohorte or ""),
                p.created_at.strftime("%d/%m/%Y %H:%M"),
                motivo_txt,
            ]
        )

    table = Table(data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(table)
    doc.build(story)
    return response


@alumnos_router.get("/certificados/alumno-regular", auth=JWTAuth())
def certificado_alumno_regular(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    dni: str | None = None,
):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontro el estudiante.")

    carreras_est = list(est.carreras.all())
    if not carreras_est:
        return 400, ApiResponse(ok=False, message="El estudiante no posee profesorados asociados.")

    profesorado: Profesorado | None = None
    if profesorado_id is not None:
        profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not profesorado:
            return 404, ApiResponse(ok=False, message="No se encontro el profesorado solicitado.")
        if profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El estudiante no pertenece a ese profesorado.")
    else:
        if len(carreras_est) > 1:
            return 400, ApiResponse(
                ok=False,
                message="Debe seleccionar un profesorado.",
                data={"carreras": _listar_carreras_detalle(est, carreras_est)},
            )
        profesorado = carreras_est[0]

    anio_academico_actual = timezone.now().year
    inscripciones_qs = (
        InscripcionMateriaAlumno.objects.select_related(
            "materia",
            "materia__plan_de_estudio",
            "materia__plan_de_estudio__profesorado",
        )
        .filter(
            estudiante=est,
            anio=anio_academico_actual,
            estado=InscripcionMateriaAlumno.Estado.CONFIRMADA,
        )
        .order_by("materia__anio_cursada", "materia__nombre")
    )
    if profesorado:
        inscripciones_qs = inscripciones_qs.filter(materia__plan_de_estudio__profesorado=profesorado)

    inscripciones_filtradas: list[InscripcionMateriaAlumno] = [
        ins for ins in inscripciones_qs if ins.materia_id and not _es_materia_edi(ins.materia.nombre)
    ]
    if not inscripciones_filtradas:
        return 400, ApiResponse(
            ok=False,
            message=(
                "El estudiante no registra inscripciones confirmadas en el ciclo lectivo actual para ese profesorado."
            ),
        )

    planes_disponibles: dict[int, PlanDeEstudio] = {}
    for ins in inscripciones_filtradas:
        plan = ins.materia.plan_de_estudio
        if plan:
            planes_disponibles[plan.id] = plan

    if not planes_disponibles:
        return 400, ApiResponse(
            ok=False,
            message="No se pudieron resolver planes de estudio asociados a las inscripciones.",
        )

    plan: PlanDeEstudio | None = None
    if plan_id is not None:
        plan = planes_disponibles.get(plan_id)
        if not plan:
            return 404, ApiResponse(ok=False, message="No se encontro el plan de estudio solicitado.")
    else:
        if len(planes_disponibles) > 1:
            return 400, ApiResponse(
                ok=False,
                message="Debe seleccionar un plan de estudio.",
                data={
                    "planes": [
                        {
                            "id": p.id,
                            "resolucion": p.resolucion or "",
                            "anio_inicio": getattr(p, "anio_inicio", None),
                        }
                        for p in planes_disponibles.values()
                    ]
                },
            )
        plan = next(iter(planes_disponibles.values()))

    inscripciones_plan = [ins for ins in inscripciones_filtradas if ins.materia.plan_de_estudio_id == plan.id]
    if not inscripciones_plan:
        return 400, ApiResponse(
            ok=False,
            message="No se encontraron inscripciones confirmadas para el plan seleccionado.",
        )

    materias_plan = [ins.materia for ins in inscripciones_plan if ins.materia_id]
    if not materias_plan:
        return 400, ApiResponse(
            ok=False,
            message="No se pudieron obtener materias asociadas a las inscripciones.",
        )

    max_anio = max((mat.anio_cursada or 0) for mat in materias_plan)
    if max_anio <= 0:
        return 400, ApiResponse(ok=False, message="No se pudo determinar el anio academico de la cursada.")

    materias_anio = [mat for mat in materias_plan if (mat.anio_cursada or 0) == max_anio] or materias_plan
    regimenes_anio = {mat.regimen for mat in materias_anio if mat.regimen}

    incluye_primer = any(
        regimen in (Materia.TipoCursada.ANUAL, Materia.TipoCursada.PRIMER_CUATRIMESTRE) for regimen in regimenes_anio
    )
    ventana_1c = _buscar_ventana_cuatrimestre("1C", anio_academico_actual)
    ventana_2c = _buscar_ventana_cuatrimestre("2C", anio_academico_actual)

    if incluye_primer:
        fecha_regular_desde = ventana_1c.desde if ventana_1c and ventana_1c.desde else None
    else:
        fecha_regular_desde = ventana_2c.desde if ventana_2c and ventana_2c.desde else None
    if not fecha_regular_desde:
        fecha_regular_desde = timezone.now().date()

    fecha_emision = timezone.now().date()

    anio_label = _anio_regular_label(max_anio)
    fecha_regular_str = fecha_regular_desde.strftime("%d/%m/%Y")
    mes_nombre = MONTH_NAMES.get(fecha_emision.month, fecha_emision.strftime("%B").lower())

    estudiante_nombre = est.user.get_full_name() if est.user_id else est.dni
    profesorado_nombre = profesorado.nombre if profesorado else plan.profesorado.nombre
    plan_resolucion = plan.resolucion or ""

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="certificado_regular_{est.dni}.pdf"'

    doc = SimpleDocTemplate(
        response,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CertTitle",
        parent=styles["Heading2"],
        alignment=TA_CENTER,
        fontSize=16,
        leading=18,
        spaceAfter=16,
        textColor=colors.black,
    )
    body_style = ParagraphStyle(
        "CertBody",
        parent=styles["Normal"],
        alignment=TA_JUSTIFY,
        fontSize=12,
        leading=18,
        spaceAfter=12,
        firstLineIndent=36,
    )
    motto_style = ParagraphStyle(
        "CertMotto",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=8,
        leading=10,
        textColor=colors.grey,
    )

    story: list = []
    story.extend(_build_certificate_header(doc))
    story.append(Paragraph("CONSTANCIA DE ALUMNO REGULAR", title_style))

    primer_parrafo = (
        'Por medio de la presente el <b>Instituto Provincial de Educación Superior "Paulo Freire"</b>, '
        "deja constancia que el/la Sr./a <b>{nombre}</b>, DNI Nro <b>{dni}</b>, cursa sus estudios "
        "regularmente en <b>{anio} del {profesorado}</b> (Plan {plan})."
    ).format(
        nombre=estudiante_nombre,
        dni=est.dni,
        anio=anio_label,
        profesorado=profesorado_nombre,
        plan=plan_resolucion or "sin resolución",
    )
    segundo_parrafo = (
        f"La presente acredita la condición de alumno/a regular desde el día {fecha_regular_str} "
        "y a la fecha de emisión del presente mantiene dicha situación."
    )
    tercer_parrafo = (
        f"Se emite la presente a pedido del/de la interesado/a para ser presentada ante quien corresponda, "
        f"en la ciudad de {CERTIFICATE_LOCATION}, a los {fecha_emision.day} días del mes de {mes_nombre} "
        f"del año {fecha_emision.year}."
    )

    story.append(Paragraph(primer_parrafo, body_style))
    story.append(Paragraph(segundo_parrafo, body_style))
    story.append(Paragraph(tercer_parrafo, body_style))
    story.append(Spacer(1, 30))

    firma_table = Table(
        [
            ["____________________", "", "____________________"],
            ["FIRMA BEDEL", "", "FIRMA AUTORIDAD"],
        ],
        colWidths=[doc.width / 3, doc.width / 3, doc.width / 3],
        hAlign="CENTER",
    )
    firma_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(firma_table)
    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            "Las Islas Malvinas, Georgia, Sandwich del Sur y los Hielos Continentales, son y seran Argentinas",
            motto_style,
        )
    )

    doc.build(story)
    return response


@alumnos_router.post("/pedido_analitico", response=PedidoAnaliticoOut)
def crear_pedido_analitico(request, payload: PedidoAnaliticoIn):
    v = (
        VentanaHabilitacion.objects.filter(tipo=VentanaHabilitacion.Tipo.ANALITICOS, activo=True)
        .order_by("-desde")
        .first()
    )
    if not v:
        return 400, {"message": "No hay periodo activo para pedido de analítico."}
    est = None
    if payload.dni:
        est = Estudiante.objects.filter(dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, "estudiante", None)
    if not est:
        return 400, {"message": "No se encontró el estudiante."}
    carreras_est = list(est.carreras.all())
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
                "data": {"carreras": _listar_carreras_detalle(est, carreras_est)},
            }
        profesorado_obj = carreras_est[0] if carreras_est else None

    PedidoAnalitico.objects.create(
        estudiante=est,
        ventana=v,
        motivo=payload.motivo,
        motivo_otro=payload.motivo_otro,
        profesorado=profesorado_obj,
        cohorte=payload.cohorte,
    )
    return {"message": "Solicitud registrada."}


# Listar pedidos de analítico por ventana (para tutor/bedel/secretaría/admin)
@alumnos_router.get("/analiticos", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico(request, ventana_id: int):
    qs = (
        PedidoAnalitico.objects.select_related("estudiante__user", "profesorado", "ventana")
        .filter(ventana_id=ventana_id)
        .order_by("-created_at")
    )
    out: list[PedidoAnaliticoItem] = []
    for p in qs:
        est = p.estudiante
        out.append(
            PedidoAnaliticoItem(
                dni=est.dni,
                apellido_nombre=est.user.get_full_name() if est.user_id else "",
                profesorado=p.profesorado.nombre if p.profesorado_id else None,
                anio_cursada=None,
                cohorte=p.cohorte,
                fecha_solicitud=p.created_at.isoformat(),
            )
        )
    return out


@alumnos_router.get("/vigencia-regularidad", response=dict)
def vigencia_regularidad(request, materia_id: int, dni: str | None = None):
    """Calcula hasta cuándo está vigente la regularidad del alumno en una materia.

    Regla: 2 años desde 'fecha_cierre' y el siguiente llamado FINAL posterior a esa fecha.
    Devuelve fechas y cantidad de intentos usados dentro de la vigencia (máx. 3).
    """
    from datetime import date

    est = None
    if dni:
        est = Estudiante.objects.filter(dni=dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, "estudiante", None)
    if not est:
        return {"vigente": False, "motivo": "estudiante_no_encontrado"}

    materia = Materia.objects.filter(id=materia_id).first()
    if not materia:
        return {"vigente": False, "motivo": "materia_no_encontrada"}

    reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
    if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
        return {"vigente": False, "motivo": "sin_regularidad"}

    def _add_years(d: date, years: int) -> date:
        try:
            return d.replace(year=d.year + years)
        except ValueError:
            return d.replace(month=2, day=28, year=d.year + years)

    two_years = _add_years(reg.fecha_cierre, 2)
    next_call = (
        MesaExamen.objects.filter(materia=materia, tipo=MesaExamen.Tipo.FINAL, fecha__gte=two_years)
        .order_by("fecha")
        .values_list("fecha", flat=True)
        .first()
    )
    allowed_until = next_call or two_years

    intentos = InscripcionMesa.objects.filter(
        estudiante=est,
        estado=InscripcionMesa.Estado.INSCRIPTO,
        mesa__materia=materia,
        mesa__tipo=MesaExamen.Tipo.FINAL,
        mesa__fecha__gte=reg.fecha_cierre,
        mesa__fecha__lte=allowed_until,
    ).count()

    return {
        "vigente": True,
        "fecha_cierre": reg.fecha_cierre.isoformat(),
        "hasta": allowed_until.isoformat(),
        "intentos_usados": intentos,
        "intentos_max": 3,
    }


ORDINALES = {
    1: "1er",
    2: "2do",
    3: "3er",
    4: "4to",
    5: "5to",
    6: "6to",
    7: "7mo",
}

DIA_LABELS = dict(Bloque.DIA_CHOICES)


def _anio_plan_label(numero: int) -> str:
    if not numero:
        return "Plan general"
    base = ORDINALES.get(numero, f"{numero}to")
    return f"{base} anio"


MONTH_NAMES = {
    1: "enero",
    2: "febrero",
    3: "marzo",
    4: "abril",
    5: "mayo",
    6: "junio",
    7: "julio",
    8: "agosto",
    9: "septiembre",
    10: "octubre",
    11: "noviembre",
    12: "diciembre",
}

CERTIFICATE_LOCATION = "Río Grande, Provincia de Tierra del Fuego, Antártida e Islas del Atlántico Sur"


def _anio_regular_label(numero: int) -> str:
    if numero <= 0:
        return ""
    return f"{ORDINALES.get(numero, f'{numero}to')} año"


def _resolve_logo_image(
    width: float,
    env_setting_name: str,
    fallback_names: list[str],
    placeholder_style: ParagraphStyle,
    placeholder_text: str,
):
    candidate_paths: list[Path] = []
    setting_value = getattr(settings, env_setting_name, None)
    if setting_value:
        candidate_paths.append(Path(setting_value))

    base_dir = Path(getattr(settings, "BASE_DIR", "."))
    search_roots = [
        base_dir,
        base_dir / "static",
        base_dir / "static" / "logos",
        base_dir / "docs",
    ]
    media_root = getattr(settings, "MEDIA_ROOT", "")
    if media_root:
        search_roots.append(Path(media_root))

    for root in search_roots:
        for name in fallback_names:
            candidate_paths.append(root / name)

    seen: set[Path] = set()
    for path_candidate in candidate_paths:
        candidate = path_candidate.expanduser()
        if candidate in seen:
            continue
        seen.add(candidate)
        if not candidate.exists():
            continue
        try:
            image = Image(str(candidate))
            if image.imageWidth:
                scale = width / float(image.imageWidth)
                image.drawWidth = width
                image.drawHeight = image.imageHeight * scale
            image.hAlign = "CENTER"
            return image
        except Exception:
            continue

    return Paragraph(f"[{placeholder_text}]", placeholder_style)


def _build_certificate_header(doc: SimpleDocTemplate) -> list:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CertHeaderTitle",
        parent=styles["Normal"],
        fontSize=12,
        leading=14,
        alignment=TA_CENTER,
        spaceAfter=2,
        spaceBefore=0,
        textColor=colors.black,
    )
    subtitle_style = ParagraphStyle(
        "CertHeaderSubtitle",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        spaceAfter=0,
        spaceBefore=0,
        textColor=colors.black,
    )
    placeholder_style = ParagraphStyle(
        "CertHeaderPlaceholder",
        parent=styles["Normal"],
        fontSize=9,
        alignment=TA_CENTER,
        textColor=colors.grey,
    )

    logo_ministerio = _resolve_logo_image(
        70.0,
        "PRIMERA_CARGA_PDF_LOGO_MINISTERIO",
        [
            "escudo_ministerio_tdf.png",
            "static/logos/escudo_ministerio_tdf.png",
            "logo_ministerio.png",
            "logos/logo_ministerio.png",
        ],
        placeholder_style,
        "MINISTERIO",
    )
    logo_ipes = _resolve_logo_image(
        70.0,
        "PRIMERA_CARGA_PDF_LOGO_IPES",
        [
            "logo_ipes.png",
            "static/logos/logo_ipes.png",
            "logos/logo_ipes.png",
        ],
        placeholder_style,
        "IPES",
    )

    center_column = [
        Paragraph("IPES PAULO FREIRE", title_style),
        Paragraph("INSTITUTO PROVINCIAL DE EDUCACIÓN SUPERIOR", subtitle_style),
    ]

    logo_width = 70.0
    center_width = max(140.0, doc.width - (2 * logo_width))
    header_table = Table(
        [[logo_ministerio, center_column, logo_ipes]],
        colWidths=[logo_width, center_width, logo_width],
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (0, 0), "CENTER"),
                ("ALIGN", (1, 0), (1, 0), "CENTER"),
                ("ALIGN", (2, 0), (2, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return [header_table, Spacer(1, 12)]


def _buscar_ventana_cuatrimestre(periodo: str, anio: int) -> VentanaHabilitacion | None:
    qs = VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.CALENDARIO_CUATRIMESTRE, periodo=periodo
    ).order_by("-desde")
    seleccionado: VentanaHabilitacion | None = None
    for ventana in qs:
        if ventana.desde and ventana.desde.year == anio:
            return ventana
        if seleccionado is None:
            seleccionado = ventana
    return seleccionado


def _es_materia_edi(nombre: str) -> bool:
    valor = (nombre or "").strip().upper()
    return valor.startswith("EDI") or valor.startswith("ESPACIO DE DEFINICION INSTITUCIONAL")


def _normalizar_regimen(valor: str | None) -> str:
    if not valor or valor == Materia.TipoCursada.ANUAL:
        return "ANUAL"
    if valor == Materia.TipoCursada.PRIMER_CUATRIMESTRE:
        return "1C"
    if valor == Materia.TipoCursada.SEGUNDO_CUATRIMESTRE:
        return "2C"
    return valor


def _format_time(value) -> str:
    return value.strftime("%H:%M")


def _construir_tablas_horario(
    profesorado: Profesorado,
    plan: PlanDeEstudio,
    horarios: list[HorarioCatedra],
) -> list[HorarioTabla]:
    if not horarios:
        return []

    tablas: list[HorarioTabla] = []
    grupos: dict[tuple[int, int], list[HorarioCatedra]] = defaultdict(list)
    for horario in horarios:
        materia = horario.espacio
        anio_plan = getattr(materia, "anio_cursada", None)
        if anio_plan is None:
            anio_plan = getattr(horario, "anio_cursada", None)
        if not anio_plan or anio_plan < 0 or anio_plan > 20:
            anio_plan = 0
        turno_key = horario.turno_id or 0
        grupos[(turno_key, anio_plan)].append(horario)

    for (turno_id, anio_plan), items in sorted(grupos.items(), key=lambda entry: (entry[0][1], entry[0][0])):
        if not items:
            continue

        dias: dict[int, str] = {}
        franjas_raw: dict[tuple[str, str], None] = {}
        celdas_dict: dict[tuple[int, tuple[str, str]], list[HorarioMateriaCelda]] = defaultdict(list)
        cuatrimestres_set: set[str] = set()

        for horario in items:
            regimen_label = _normalizar_regimen(horario.cuatrimestre or horario.espacio.regimen)
            if regimen_label:
                cuatrimestres_set.add(regimen_label)

            comisiones = list(horario.comisiones.select_related("docente"))
            docentes = sorted(
                {
                    (
                        f"{c.docente.apellido}, {c.docente.nombre}"
                        if c.docente and c.docente.apellido
                        else (c.docente.nombre if c.docente else "")
                    )
                    for c in comisiones
                    if c.docente_id
                }
            )
            docentes = [doc for doc in docentes if doc]
            comision_codigos = sorted({c.codigo for c in comisiones if c.codigo})
            observaciones = sorted({c.observaciones for c in comisiones if c.observaciones})
            observaciones_text = "; ".join(observaciones) if observaciones else None

            detalles = list(horario.detalles.select_related("bloque"))
            if not detalles:
                continue

            for detalle in detalles:
                bloque = detalle.bloque
                dia_num = bloque.dia
                dia_nombre = DIA_LABELS.get(dia_num, str(dia_num))
                dias[dia_num] = dia_nombre
                franja_key = (
                    _format_time(bloque.hora_desde),
                    _format_time(bloque.hora_hasta),
                )
                franjas_raw[franja_key] = None

                materia = horario.espacio
                materia_entry = HorarioMateriaCelda(
                    materia_id=materia.id,
                    materia_nombre=materia.nombre,
                    comisiones=comision_codigos,
                    docentes=docentes,
                    observaciones=observaciones_text,
                    regimen=_normalizar_regimen(materia.regimen),
                    cuatrimestre=regimen_label,
                    es_cuatrimestral=regimen_label in {"1C", "2C"},
                )
                celdas_dict[(dia_num, franja_key)].append(materia_entry)

        if not franjas_raw:
            continue

        franjas_sorted = sorted(franjas_raw.keys(), key=lambda item: item)
        franjas: list[HorarioFranja] = []
        franja_orden: dict[tuple[str, str], int] = {}
        for idx, (desde, hasta) in enumerate(franjas_sorted, start=1):
            franjas.append(HorarioFranja(orden=idx, desde=desde, hasta=hasta))
            franja_orden[(desde, hasta)] = idx

        dias_list = [HorarioDia(numero=numero, nombre=nombre) for numero, nombre in sorted(dias.items())]

        celdas: list[HorarioCelda] = []
        for dia in dias_list:
            for desde, hasta in franjas_sorted:
                orden = franja_orden[(desde, hasta)]
                materias = celdas_dict.get((dia.numero, (desde, hasta)), [])
                celdas.append(
                    HorarioCelda(
                        dia_numero=dia.numero,
                        franja_orden=orden,
                        dia=dia.nombre,
                        desde=desde,
                        hasta=hasta,
                        materias=materias,
                    )
                )

        turno_nombre = items[0].turno.nombre if items[0].turno else ""
        cuatrimestres = sorted(cuatrimestres_set) if cuatrimestres_set else ["ANUAL"]
        key = f"{profesorado.id}-{plan.id}-{turno_id}-{anio_plan}"
        tablas.append(
            HorarioTabla(
                key=key,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan.id,
                plan_resolucion=getattr(plan, "resolucion", None),
                anio_plan=anio_plan,
                anio_plan_label=_anio_plan_label(anio_plan),
                turno_id=turno_id,
                turno_nombre=turno_nombre,
                cuatrimestres=cuatrimestres,
                dias=dias_list,
                franjas=franjas,
                celdas=celdas,
                observaciones=(
                    "Las materias cuatrimestrales se encuentran identificadas con el cuatrimestre correspondiente."
                ),
            )
        )

    return sorted(tablas, key=lambda tabla: (tabla.anio_plan, tabla.turno_nombre))
