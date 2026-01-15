from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.contrib.auth.models import AnonymousUser, User
from django.db.models import Q

from apps.common.api_schemas import ApiResponse
from core.permissions import ensure_roles
from core.models import (
    ActaExamenAlumno,
    Bloque,
    Correlatividad,
    CorrelatividadVersion,
    Docente,
    Estudiante,
    HorarioCatedra,
    HorarioCatedraDetalle,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    Profesorado,
    Regularidad,
)

from ..schemas import (
    EstudianteAdminDetail,
    EstudianteAdminDocumentacion,
    EstudianteAdminUpdateIn,
    Horario,
    HorarioCelda,
    HorarioDia,
    HorarioFranja,
    HorarioMateriaCelda,
    HorarioTabla,
    RegularidadResumen,
)

ORDINALES = {
    1: "1er",
    2: "2do",
    3: "3er",
    4: "4to",
    5: "5to",
    6: "6to",
    7: "7mo",
}

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
    "incumbencia",
}


def _docente_full_name(docente: Docente | None) -> str | None:
    if not docente:
        return None
    apellido = (docente.apellido or "").strip()
    nombre = (docente.nombre or "").strip()
    if apellido and nombre:
        return f"{apellido}, {nombre}"
    return apellido or nombre or None


def _format_user_display(user) -> str | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    full_name = (user.get_full_name() or "").strip()
    if full_name:
        return full_name
    username = getattr(user, "username", None)
    if username:
        return username
    return None


def _user_has_roles(user, roles: Iterable[str]) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser or user.is_staff:
        return True
    role_set = {role.lower() for role in roles}
    user_groups = {name.lower().strip() for name in user.groups.values_list("name", flat=True)}
    return bool(user_groups.intersection(role_set))


def _ensure_admin(request):
    ensure_roles(request.user, ADMIN_ALLOWED_ROLES)


def _resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
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


def _resolve_docente_from_user(user) -> Docente | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    lookup = Q()
    username = (getattr(user, "username", "") or "").strip()
    email = (getattr(user, "email", "") or "").strip()
    if username:
        lookup |= Q(dni__iexact=username)
    if email:
        lookup |= Q(email__iexact=email)
    if not lookup:
        return None
    return Docente.objects.filter(lookup).first()


def _user_can_manage_mesa_planilla(request, mesa) -> bool:
    if _user_has_roles(request.user, ADMIN_ALLOWED_ROLES):
        return True
    if _user_has_roles(request.user, {"docente"}):
        docente = _resolve_docente_from_user(request.user)
        if not docente:
            return False
        tribunal_ids = {
            mesa.docente_presidente_id,
            mesa.docente_vocal1_id,
            mesa.docente_vocal2_id,
        }
        return docente.id in tribunal_ids
    return False


def _user_can_override_planilla_lock(user) -> bool:
    return _user_has_roles(user, {"admin", "secretaria"})


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
    allow_estado_legajo: bool,
    allow_force_password: bool,
    mark_profile_complete: bool = False,
):
    fields_to_update: set[str] = set()
    user = est.user if est.user_id else None

    if payload.dni is not None:
        new_dni = payload.dni.strip()
        if new_dni and new_dni != est.dni:
            if Estudiante.objects.filter(dni=new_dni).exclude(id=est.id).exists():
                return False, (400, ApiResponse(ok=False, message=f"El DNI {new_dni} ya está registrado."))
            
            est.dni = new_dni
            fields_to_update.add("dni")
            
            if user:
                if User.objects.filter(username=new_dni).exclude(id=user.id).exists():
                     return False, (400, ApiResponse(ok=False, message=f"El usuario {new_dni} ya existe."))
                user.username = new_dni
                user.save(update_fields=["username"])

    if payload.email is not None and user:
        user.email = payload.email or ""
        user.save(update_fields=["email"])

    if user:
        user_updates = []
        if payload.nombre is not None:
            user.first_name = payload.nombre.strip()
            user_updates.append("first_name")
        if payload.apellido is not None:
            user.last_name = payload.apellido.strip()
            user_updates.append("last_name")
        if user_updates:
            user.save(update_fields=user_updates)

    if payload.telefono is not None:
        est.telefono = payload.telefono or ""
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
    return value.strftime("%H:%M") if value else ""


def _metadata_str(data: dict[str, object]) -> dict[str, str]:
    return {key: str(value) for key, value in data.items() if value not in (None, "", [], {})}


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
            tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
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
        mesa__tipo__in=(MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL),
        mesa__fecha__gte=regularidad.fecha_cierre,
        mesa__fecha__lte=limite,
    ).count()
    return limite, intentos


def _to_iso(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _format_nota(value: Decimal | float | int | None) -> str | None:
    if value is None:
        return None
    return f"{value:.1f}".rstrip("0").rstrip(".")


def _format_acta_calificacion(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip().upper()
    if text in {"APR", "APROBADO"}:
        return "APR"
    if text in {"DES", "DESAPROBADO"}:
        return "DES"
    if text in {"AUS", "AUSENTE"}:
        return "AUS"
    return text


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
                dia_nombre = Bloque.DIA_CHOICES[dia_num - 1][1] if 0 < dia_num <= len(Bloque.DIA_CHOICES) else str(dia_num)
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


def _anio_plan_label(numero: int) -> str:
    if not numero:
        return "Plan general"
    base = ORDINALES.get(numero, f"{numero}to")
    return f"{base} anio"


def _anio_regular_label(numero: int) -> str:
    if numero <= 0:
        return ""
    return f"{ORDINALES.get(numero, f'{numero}to')} año"


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


__all__ = [
    "ADMIN_ALLOWED_ROLES",
    "DOCUMENTACION_FIELDS",
    "_apply_estudiante_updates",
    "_build_admin_detail",
    "_determine_condicion",
    "_docente_full_name",
    "_ensure_admin",
    "_ensure_estudiante_access",
    "_extract_documentacion",
    "_format_user_display",
    "_listar_carreras_detalle",
    "_es_materia_edi",
    "_normalizar_regimen",
    "_format_time",
    "_metadata_str",
    "_add_years",
    "_calcular_vigencia_regularidad",
    "_to_iso",
    "_format_nota",
    "_format_acta_calificacion",
    "_acta_condicion",
    "_construir_tablas_horario",
    "_anio_plan_label",
    "_anio_regular_label",
    "_correlatividades_qs",
    "_parse_optional_date",
    "_resolve_docente_from_user",
    "_resolve_estudiante",
    "_user_has_roles",
    "_user_can_manage_mesa_planilla",
    "_user_can_override_planilla_lock",
]
