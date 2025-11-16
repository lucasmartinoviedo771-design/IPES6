from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.utils.text import slugify
from ninja import Router, Schema, Field
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamen,
    ActaExamenAlumno,
    ActaExamenDocente,
    Comision,
    Docente,
    InscripcionMateriaAlumno,
    InscripcionMesa,
    Materia,
    MesaActaOral,
    MesaExamen,
    PlanDeEstudio,
    PreinscripcionChecklist,
    Profesorado,
    Regularidad,
)

carga_notas_router = Router(tags=["carga_notas"])


class RegularidadAlumnoOut(Schema):
    inscripcion_id: int
    alumno_id: int
    orden: int
    apellido_nombre: str
    dni: str
    nota_tp: float | None = None
    nota_final: int | None = None
    asistencia: int | None = None
    excepcion: bool = False
    situacion: str | None = None
    observaciones: str | None = None


class RegularidadPlanillaOut(Schema):
    materia_id: int
    materia_nombre: str
    formato: str
    comision_id: int
    comision_codigo: str
    anio: int
    turno: str
    situaciones: list[dict]
    alumnos: list[RegularidadAlumnoOut]


class RegularidadAlumnoIn(Schema):
    inscripcion_id: int
    nota_tp: float | None = None
    nota_final: int | None = None
    asistencia: int | None = None
    excepcion: bool = False
    situacion: str
    observaciones: str | None = None


class RegularidadCargaIn(Schema):
    comision_id: int
    fecha_cierre: date | None = None
    alumnos: list[RegularidadAlumnoIn]
    observaciones_generales: str | None = None


class ActaDocenteIn(Schema):
    rol: str
    docente_id: int | None = None
    nombre: str
    dni: str | None = None


class ActaAlumnoIn(Schema):
    numero_orden: int
    permiso_examen: str | None = None
    dni: str
    apellido_nombre: str
    examen_escrito: str | None = None
    examen_oral: str | None = None
    calificacion_definitiva: str
    observaciones: str | None = None


class ActaCreateIn(Schema):
    tipo: str
    profesorado_id: int
    materia_id: int
    fecha: date
    folio: str
    libro: str | None = None
    observaciones: str | None = None
    docentes: list[ActaDocenteIn]
    alumnos: list[ActaAlumnoIn]
    total_aprobados: int | None = None
    total_desaprobados: int | None = None
    total_ausentes: int | None = None


class ActaCreateOut(Schema):
    id: int
    codigo: str


class OralTopicSchema(Schema):
    tema: str
    score: str | None = None


class ActaOralSchema(Schema):
    acta_numero: str | None = None
    folio_numero: str | None = None
    fecha: date | None = None
    curso: str | None = None
    nota_final: str | None = None
    observaciones: str | None = None
    temas_alumno: list[OralTopicSchema] = Field(default_factory=list)
    temas_docente: list[OralTopicSchema] = Field(default_factory=list)


class ActaOralListItemSchema(ActaOralSchema):
    inscripcion_id: int
    alumno: str
    dni: str


class ActaMetadataMateria(Schema):
    id: int
    nombre: str
    anio_cursada: int | None = None
    plan_id: int
    plan_resolucion: str


class ActaMetadataPlan(Schema):
    id: int
    resolucion: str
    materias: list[ActaMetadataMateria]


class ActaMetadataProfesorado(Schema):
    id: int
    nombre: str
    planes: list[ActaMetadataPlan]


class ActaMetadataDocente(Schema):
    id: int
    nombre: str
    dni: str | None = None


class ActaMetadataOut(Schema):
    profesorados: list[ActaMetadataProfesorado]
    docentes: list[ActaMetadataDocente]
    nota_opciones: list[dict[str, str]]


FORMATOS_TALLER = {"TAL", "PRA", "SEM", "LAB"}

_VIRTUAL_COMISION_FACTOR = 10000


def _virtual_comision_id(materia_id: int, anio: int | None) -> int:
    base = materia_id * _VIRTUAL_COMISION_FACTOR + (anio or 0)
    return -base


def _split_virtual_comision_id(raw_id: int) -> tuple[int, int | None]:
    absolute = abs(raw_id)
    materia_id = absolute // _VIRTUAL_COMISION_FACTOR
    anio = absolute % _VIRTUAL_COMISION_FACTOR
    return materia_id, anio or None


def _nota_label(value: str) -> str:
    if not value:
        return "-"
    if value == ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO:
        return "Ausente justificado"
    if value == ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO:
        return "Ausente injustificado"
    return f"{value}"


def _compute_acta_codigo(profesorado: Profesorado, anio: int, numero: int) -> str:
    """Genera un código estable para las actas.

    Prioriza un posible acrónimo definido en el modelo y cae en un slug del nombre
    (o en una marca basada en el identificador) cuando dicho atributo no existe.
    Así evitamos depender de campos opcionales sin romper instalaciones que sí
    lo tengan configurado.
    """
    prefix = (
        getattr(profesorado, "acronimo", None) or slugify(profesorado.nombre or "") or f"P{profesorado.id}"
    ).upper()
    return f"ACTA-{prefix}-{anio}-{numero:03d}"


def _next_acta_numero(profesorado_id: int, anio: int) -> int:
    ultimo = (
        ActaExamen.objects.filter(profesorado_id=profesorado_id, anio_academico=anio)
        .aggregate(Max("numero"))
        .get("numero__max")
        or 0
    )
    return ultimo + 1


def _clasificar_resultado(nota: str) -> str:
    if nota in (
        ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
    ):
        return "ausente"
    try:
        valor = Decimal(nota.replace(",", "."))
    except Exception:
        return "desaprobado"
    return "aprobado" if valor >= 6 else "desaprobado"


def _acta_metadata() -> ActaMetadataOut:
    profesorados_data: list[ActaMetadataProfesorado] = []
    profesorados_qs = Profesorado.objects.order_by("nombre").prefetch_related("planes")

    for profesorado in profesorados_qs:
        planes_payload: list[ActaMetadataPlan] = []
        planes = (
            PlanDeEstudio.objects.filter(profesorado=profesorado)
            .order_by("resolucion", "id")
            .prefetch_related("materias")
        )
        for plan in planes:
            materias_payload: list[ActaMetadataMateria] = []
            for materia in plan.materias.all().order_by("anio_cursada", "nombre"):
                materias_payload.append(
                    ActaMetadataMateria(
                        id=materia.id,
                        nombre=materia.nombre,
                        anio_cursada=materia.anio_cursada,
                        plan_id=plan.id,
                        plan_resolucion=plan.resolucion,
                    )
                )
            planes_payload.append(
                ActaMetadataPlan(
                    id=plan.id,
                    resolucion=plan.resolucion,
                    materias=materias_payload,
                )
            )
        profesorados_data.append(
            ActaMetadataProfesorado(id=profesorado.id, nombre=profesorado.nombre, planes=planes_payload)
        )

    docentes_payload = [
        ActaMetadataDocente(
            id=doc.id,
            nombre=f"{doc.apellido}, {doc.nombre}".strip(", "),
            dni=doc.dni or None,
        )
        for doc in Docente.objects.order_by("apellido", "nombre", "id")
    ]

    nota_options = [{"value": value, "label": _nota_label(value)} for value in ACTA_NOTA_CHOICES]

    return ActaMetadataOut(
        profesorados=profesorados_data,
        docentes=docentes_payload,
        nota_opciones=nota_options,
    )


@carga_notas_router.get(
    "/actas/metadata",
    response={200: ApiResponse},
)
def obtener_acta_metadata(request):
    data = _acta_metadata()
    return ApiResponse(
        ok=True,
        message="Metadata para actas de examen.",
        data=data.dict(),
    )


@carga_notas_router.post(
    "/actas",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def crear_acta_examen(request, payload: ActaCreateIn):
    if payload.tipo not in dict(ActaExamen.Tipo.choices):
        return 400, ApiResponse(ok=False, message="Tipo de acta inválido.")

    try:
        profesorado = Profesorado.objects.get(pk=payload.profesorado_id)
    except Profesorado.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio").get(pk=payload.materia_id)
    except Materia.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    plan = materia.plan_de_estudio
    if plan.profesorado_id != profesorado.id:
        return 400, ApiResponse(
            ok=False,
            message="La materia seleccionada no pertenece al profesorado indicado.",
        )

    if not payload.alumnos:
        return 400, ApiResponse(ok=False, message="Debe ingresar al menos un alumno en el acta.")

    anio = payload.fecha.year
    numero = _next_acta_numero(profesorado.id, anio)
    codigo = _compute_acta_codigo(profesorado, anio, numero)

    alumnos_payload = []
    for alumno in payload.alumnos:
        if alumno.calificacion_definitiva not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(
                ok=False,
                message=f"Calificación '{alumno.calificacion_definitiva}' inválida para el alumno {alumno.dni}.",
            )
        if alumno.examen_escrito and alumno.examen_escrito not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen escrito para {alumno.dni}.")
        if alumno.examen_oral and alumno.examen_oral not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Valor inválido en examen oral para {alumno.dni}.")
        alumnos_payload.append(alumno)

    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for alumno in alumnos_payload:
        categoria = _clasificar_resultado(alumno.calificacion_definitiva)
        categoria_counts[categoria] += 1

    if payload.total_aprobados is not None and payload.total_aprobados != categoria_counts["aprobado"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de aprobados no coincide con las calificaciones cargadas.",
        )
    if payload.total_desaprobados is not None and payload.total_desaprobados != categoria_counts["desaprobado"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de desaprobados no coincide con las calificaciones cargadas.",
        )
    if payload.total_ausentes is not None and payload.total_ausentes != categoria_counts["ausente"]:
        return 400, ApiResponse(
            ok=False,
            message="La cantidad de ausentes no coincide con las calificaciones cargadas.",
        )

    usuario = getattr(request, "user", None)
    with transaction.atomic():
        acta = ActaExamen.objects.create(
            codigo=codigo,
            numero=numero,
            anio_academico=anio,
            tipo=payload.tipo,
            profesorado=profesorado,
            materia=materia,
            plan=plan,
            anio_cursada=materia.anio_cursada,
            fecha=payload.fecha,
            folio=payload.folio,
            libro=payload.libro or "",
            observaciones=payload.observaciones or "",
            total_alumnos=len(alumnos_payload),
            total_aprobados=categoria_counts["aprobado"],
            total_desaprobados=categoria_counts["desaprobado"],
            total_ausentes=categoria_counts["ausente"],
            created_by=usuario if getattr(usuario, "is_authenticated", False) else None,
            updated_by=usuario if getattr(usuario, "is_authenticated", False) else None,
        )

        for idx, docente_data in enumerate(payload.docentes or [], start=1):
            rol = (
                docente_data.rol
                if docente_data.rol in dict(ActaExamenDocente.Rol.choices)
                else ActaExamenDocente.Rol.PRESIDENTE
            )
            docente_obj = None
            if docente_data.docente_id:
                docente_obj = Docente.objects.filter(id=docente_data.docente_id).first()
            ActaExamenDocente.objects.create(
                acta=acta,
                docente=docente_obj,
                nombre=docente_data.nombre.strip(),
                dni=(docente_data.dni or "").strip(),
                rol=rol,
                orden=idx,
            )

        for alumno in alumnos_payload:
            ActaExamenAlumno.objects.create(
                acta=acta,
                numero_orden=alumno.numero_orden,
                permiso_examen=alumno.permiso_examen or "",
                dni=alumno.dni.strip(),
                apellido_nombre=alumno.apellido_nombre.strip(),
                examen_escrito=alumno.examen_escrito or "",
                examen_oral=alumno.examen_oral or "",
                calificacion_definitiva=alumno.calificacion_definitiva,
                observaciones=alumno.observaciones or "",
            )

    return ApiResponse(
        ok=True,
        message="Acta de examen generada correctamente.",
        data=ActaCreateOut(id=acta.id, codigo=acta.codigo).dict(),
    )


NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
    ActaExamenAlumno.NOTA_AUSENTE_JUSTIFICADO,
    ActaExamenAlumno.NOTA_AUSENTE_INJUSTIFICADO,
]

_SITUACIONES = {
    "ASI": [
        {
            "alias": "REGULAR",
            "codigo": Regularidad.Situacion.REGULAR,
            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10).",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "DESAPROBADO_PA",
            "codigo": Regularidad.Situacion.DESAPROBADO_PA,
            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
    "MOD": [
        {
            "alias": "PROMOCION",
            "codigo": Regularidad.Situacion.PROMOCIONADO,
            "descripcion": "Cumple con asistencia (80%), aprueba TP y parcial (nota final ≥ 8).",
        },
        {
            "alias": "REGULAR",
            "codigo": Regularidad.Situacion.REGULAR,
            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y parcial/recuperatorio (nota ≥ 6/10).",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "DESAPROBADO_PA",
            "codigo": Regularidad.Situacion.DESAPROBADO_PA,
            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
    "TAL": [
        {
            "alias": "APROBADO",
            "codigo": Regularidad.Situacion.APROBADO,
            "descripcion": "Cumple con el régimen de asistencia y con las evaluaciones.",
        },
        {
            "alias": "DESAPROBADO_TP",
            "codigo": Regularidad.Situacion.DESAPROBADO_TP,
            "descripcion": "Desaprueba TP y sus recuperatorios.",
        },
        {
            "alias": "LIBRE-I",
            "codigo": Regularidad.Situacion.LIBRE_I,
            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
        },
        {
            "alias": "LIBRE-AT",
            "codigo": Regularidad.Situacion.LIBRE_AT,
            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
        },
    ],
}

ALIAS_TO_SITUACION = {item["alias"]: item["codigo"] for items in _SITUACIONES.values() for item in items}

SITUACION_TO_ALIAS = {v: k for k, v in ALIAS_TO_SITUACION.items()}


def _situaciones_para_formato(formato: str) -> list[dict]:
    if not formato:
        return _SITUACIONES["ASI"]
    formato_key = formato.upper()
    if formato_key in _SITUACIONES:
        return _SITUACIONES[formato_key]
    if formato_key in FORMATOS_TALLER:
        return _SITUACIONES["TAL"]
    return _SITUACIONES["ASI"]


def _alias_desde_situacion(codigo: str | None) -> str | None:
    if not codigo:
        return None
    return SITUACION_TO_ALIAS.get(codigo)


class MateriaOption(Schema):
    id: int
    nombre: str
    plan_id: int
    anio: int | None = None
    cuatrimestre: str | None = None
    formato: str | None = None


class ComisionOption(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    anio: int
    cuatrimestre: str | None = None
    turno: str
    codigo: str


class CargaNotasLookup(Schema):
    materias: list[MateriaOption]
    comisiones: list[ComisionOption]


@carga_notas_router.get(
    "/comisiones",
    response=CargaNotasLookup,
    auth=JWTAuth(),
)
def listar_comisiones(
    request,
    profesorado_id: int | None = None,
    materia_id: int | None = None,
    plan_id: int | None = None,
    anio: int | None = None,
    cuatrimestre: str | None = None,
):
    if not plan_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    plan = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
    if not plan:
        return CargaNotasLookup(materias=[], comisiones=[])

    if profesorado_id and profesorado_id != plan.profesorado_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    comisiones_qs = (
        Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
        )
        .filter(materia__plan_de_estudio=plan)
        .order_by("-anio_lectivo", "materia__nombre", "codigo")
    )

    if materia_id:
        comisiones_qs = comisiones_qs.filter(materia_id=materia_id)
    if anio:
        comisiones_qs = comisiones_qs.filter(anio_lectivo=anio)
    if cuatrimestre:
        comisiones_qs = comisiones_qs.filter(materia__regimen=cuatrimestre)

    materias_qs = Materia.objects.filter(plan_de_estudio=plan)
    if materia_id:
        materias_qs = materias_qs.filter(id=materia_id)
    materias_qs = materias_qs.order_by("anio_cursada", "nombre")

    materias_out: list[MateriaOption] = [
        MateriaOption(
            id=m.id,
            nombre=m.nombre,
            plan_id=plan.id,
            anio=m.anio_cursada,
            cuatrimestre=m.regimen,
            formato=getattr(m, "formato", None),
        )
        for m in materias_qs
    ]

    comisiones_out: list[ComisionOption] = []
    for com in comisiones_qs:
        materia_obj = com.materia
        plan_obj = materia_obj.plan_de_estudio
        profesorado = plan_obj.profesorado
        comisiones_out.append(
            ComisionOption(
                id=com.id,
                materia_id=materia_obj.id,
                materia_nombre=materia_obj.nombre,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan_obj.id,
                plan_resolucion=plan_obj.resolucion,
                anio=com.anio_lectivo,
                cuatrimestre=materia_obj.regimen,
                turno=com.turno.nombre if com.turno else "",
                codigo=com.codigo,
            )
        )

    inscripciones_libres = InscripcionMateriaAlumno.objects.filter(materia__plan_de_estudio=plan, comision__isnull=True)
    if materia_id:
        inscripciones_libres = inscripciones_libres.filter(materia_id=materia_id)
    if anio:
        inscripciones_libres = inscripciones_libres.filter(anio=anio)
    if cuatrimestre:
        inscripciones_libres = inscripciones_libres.filter(materia__regimen=cuatrimestre)

    libres_distintos = inscripciones_libres.values(
        "materia_id",
        "materia__nombre",
        "materia__regimen",
        "materia__formato",
        "anio",
    ).distinct()

    for row in libres_distintos:
        materia_row_id = row["materia_id"]
        materia_nombre = row["materia__nombre"]
        regimen = row["materia__regimen"]
        anio_row = row["anio"]
        comisiones_out.append(
            ComisionOption(
                id=_virtual_comision_id(materia_row_id, anio_row),
                materia_id=materia_row_id,
                materia_nombre=materia_nombre,
                profesorado_id=plan.profesorado_id,
                profesorado_nombre=plan.profesorado.nombre,
                plan_id=plan.id,
                plan_resolucion=plan.resolucion,
                anio=anio_row or 0,
                cuatrimestre=regimen,
                turno="Sin turno",
                codigo="Sin comision",
            )
        )

    return CargaNotasLookup(materias=materias_out, comisiones=comisiones_out)


def _build_regularidad_alumnos(inscripciones) -> list[RegularidadAlumnoOut]:
    alumnos: list[RegularidadAlumnoOut] = []
    for idx, insc in enumerate(inscripciones, start=1):
        regularidad = (
            Regularidad.objects.filter(
                inscripcion=insc,
            )
            .order_by("-fecha_cierre", "-id")
            .first()
        )

        alias = _alias_desde_situacion(regularidad.situacion) if regularidad else None
        alumnos.append(
            RegularidadAlumnoOut(
                inscripcion_id=insc.id,
                alumno_id=insc.estudiante_id,
                orden=idx,
                apellido_nombre=insc.estudiante.user.get_full_name() if insc.estudiante.user_id else "",
                dni=insc.estudiante.dni,
                nota_tp=float(regularidad.nota_trabajos_practicos)
                if regularidad and regularidad.nota_trabajos_practicos is not None
                else None,
                nota_final=regularidad.nota_final_cursada if regularidad else None,
                asistencia=regularidad.asistencia_porcentaje if regularidad else None,
                excepcion=regularidad.excepcion if regularidad else False,
                situacion=alias,
                observaciones=regularidad.observaciones if regularidad else None,
            )
        )
    return alumnos


@carga_notas_router.get(
    "/regularidad",
    response={200: RegularidadPlanillaOut, 400: ApiResponse, 404: ApiResponse},
)
def obtener_planilla_regularidad(request, comision_id: int):
    if comision_id >= 0:
        comision = (
            Comision.objects.select_related("materia__plan_de_estudio__profesorado", "turno")
            .filter(id=comision_id)
            .first()
        )
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")

        situaciones = _situaciones_para_formato(comision.materia.formato)

        inscripciones = (
            InscripcionMateriaAlumno.objects.filter(
                comision_id=comision.id,
                anio=comision.anio_lectivo,
            )
            .select_related("estudiante__user", "materia")
            .order_by(
                "estudiante__user__last_name",
                "estudiante__user__first_name",
                "estudiante__dni",
            )
        )

        alumnos = _build_regularidad_alumnos(inscripciones)
        turno_nombre = comision.turno.nombre if comision.turno else ""

        return RegularidadPlanillaOut(
            materia_id=comision.materia_id,
            materia_nombre=comision.materia.nombre,
            formato=comision.materia.formato,
            comision_id=comision.id,
            comision_codigo=comision.codigo,
            anio=comision.anio_lectivo,
            turno=turno_nombre,
            situaciones=situaciones,
            alumnos=alumnos,
        )

    materia_id, anio_virtual = _split_virtual_comision_id(comision_id)

    materia = Materia.objects.select_related("plan_de_estudio__profesorado").filter(id=materia_id).first()
    if not materia:
        return 404, ApiResponse(
            ok=False,
            message="Materia no encontrada para la comision virtual.",
        )

    situaciones = _situaciones_para_formato(materia.formato)

    inscripciones = (
        InscripcionMateriaAlumno.objects.filter(
            materia_id=materia.id,
            comision__isnull=True,
        )
        .select_related("estudiante__user", "materia")
        .order_by(
            "estudiante__user__last_name",
            "estudiante__user__first_name",
            "estudiante__dni",
        )
    )
    if anio_virtual is not None:
        inscripciones = inscripciones.filter(anio=anio_virtual)

    alumnos = _build_regularidad_alumnos(inscripciones)

    return RegularidadPlanillaOut(
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        formato=materia.formato,
        comision_id=comision_id,
        comision_codigo="Sin comision",
        anio=anio_virtual if anio_virtual is not None else date.today().year,
        turno="Sin turno",
        situaciones=situaciones,
        alumnos=alumnos,
    )


@carga_notas_router.post(
    "/regularidad",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def guardar_planilla_regularidad(request, payload: RegularidadCargaIn):
    is_virtual = payload.comision_id < 0
    comision = None
    materia = None
    anio_virtual = None

    if is_virtual:
        materia_id, anio_virtual = _split_virtual_comision_id(payload.comision_id)
        materia = Materia.objects.filter(id=materia_id).first()
        if not materia:
            return 404, ApiResponse(
                ok=False,
                message="Materia no encontrada para la comision virtual.",
            )
    else:
        comision = Comision.objects.select_related("materia").filter(id=payload.comision_id).first()
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        materia = comision.materia

    situaciones_validas = {item["alias"] for item in _situaciones_para_formato(materia.formato)}

    if not payload.alumnos:
        return 400, ApiResponse(ok=False, message="No se enviaron alumnos para guardar.")

    fecha = payload.fecha_cierre or date.today()

    with transaction.atomic():
        for alumno in payload.alumnos:
            if alumno.situacion not in situaciones_validas:
                return 400, ApiResponse(
                    ok=False,
                    message=f"Situacion '{alumno.situacion}' no permitida para el formato de la materia.",
                )

            situacion_codigo = ALIAS_TO_SITUACION.get(alumno.situacion)
            if not situacion_codigo:
                return 400, ApiResponse(ok=False, message=f"Situacion desconocida: {alumno.situacion}")

            if alumno.situacion == "PROMOCION" and alumno.nota_final is not None and alumno.nota_final < 8:
                return 400, ApiResponse(
                    ok=False,
                    message="La nota final debe ser >= 8 para registrar PROMOCION.",
                )

            inscripcion_qs = InscripcionMateriaAlumno.objects.filter(
                id=alumno.inscripcion_id,
            )

            if is_virtual:
                inscripcion_qs = inscripcion_qs.filter(
                    materia_id=materia.id,
                    comision__isnull=True,
                )
                if anio_virtual is not None:
                    inscripcion_qs = inscripcion_qs.filter(anio=anio_virtual)
            else:
                inscripcion_qs = inscripcion_qs.filter(comision_id=comision.id)

            inscripcion = inscripcion_qs.select_related("estudiante", "materia").first()

            if not inscripcion:
                if is_virtual:
                    message = f"Inscripcion {alumno.inscripcion_id} no corresponde a la materia sin comision."
                else:
                    message = f"Inscripcion {alumno.inscripcion_id} no pertenece a la comision."
                return 400, ApiResponse(ok=False, message=message)

            # --- NEW VALIDATION FOR EDI SUBJECTS AND INTRODUCTORY COURSE ---
            if materia.nombre.startswith("EDI: "):
                estudiante = inscripcion.estudiante
                try:
                    checklist = PreinscripcionChecklist.objects.get(preinscripcion__alumno=estudiante)
                    if not checklist.curso_introductorio_aprobado and situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                            raise HttpError(
                                400,
                                f"El estudiante {estudiante.dni} no tiene el curso introductorio aprobado. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'. Debe ser 'Condicional' o similar.",
                            )
                except PreinscripcionChecklist.DoesNotExist:
                    # If no checklist exists, assume introductory course is not approved for this validation
                    if situacion_codigo in [
                        Regularidad.Situacion.APROBADO,
                        Regularidad.Situacion.PROMOCIONADO,
                        Regularidad.Situacion.REGULAR,
                    ]:
                        raise HttpError(
                            400,
                            (
                                f"El estudiante {estudiante.dni} no tiene un checklist de preinscripción. "
                                f"La situación de la materia EDI '{materia.nombre}' no puede ser 'Aprobado', "
                                f"'Promocionado' o 'Regular'."
                            ),
                        ) from None
            # --- END NEW VALIDATION ---

            Regularidad.objects.update_or_create(
                inscripcion=inscripcion,
                defaults={
                    "estudiante": inscripcion.estudiante,
                    "materia": inscripcion.materia,
                    "fecha_cierre": fecha,
                    "nota_trabajos_practicos": Decimal(str(alumno.nota_tp)) if alumno.nota_tp is not None else None,
                    "nota_final_cursada": alumno.nota_final,
                    "asistencia_porcentaje": alumno.asistencia,
                    "excepcion": alumno.excepcion,
                    "situacion": situacion_codigo,
                    "observaciones": alumno.observaciones or "",
                },
            )

    return ApiResponse(ok=True, message="Notas de regularidad guardadas correctamente.")


def _get_inscripcion_mesa_or_404(mesa_id: int, inscripcion_id: int) -> InscripcionMesa:
    inscripcion = (
        InscripcionMesa.objects.select_related("mesa", "estudiante")
        .filter(id=inscripcion_id, mesa_id=mesa_id)
        .first()
    )
    if not inscripcion:
        raise HttpError(404, "La inscripcion indicada no pertenece a la mesa seleccionada.")
    return inscripcion


@carga_notas_router.get(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ActaOralSchema, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def obtener_acta_oral(request, mesa_id: int, inscripcion_id: int):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    acta: MesaActaOral | None = getattr(inscripcion, "acta_oral", None)
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta oral no registrada para el estudiante.")

    return ActaOralSchema(
        acta_numero=acta.acta_numero or None,
        folio_numero=acta.folio_numero or None,
        fecha=acta.fecha,
        curso=acta.curso or None,
        nota_final=acta.nota_final or None,
        observaciones=acta.observaciones or None,
        temas_alumno=acta.temas_alumno or [],
        temas_docente=acta.temas_docente or [],
    )


@carga_notas_router.post(
    "/mesas/{mesa_id}/oral-actas/{inscripcion_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def guardar_acta_oral(request, mesa_id: int, inscripcion_id: int, payload: ActaOralSchema):
    try:
        inscripcion = _get_inscripcion_mesa_or_404(mesa_id, inscripcion_id)
    except HttpError as exc:
        return exc.status_code, ApiResponse(ok=False, message=str(exc))

    temas_alumno = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_alumno or [])
        if item.tema
    ]
    temas_docente = [
        {"tema": item.tema, "score": item.score}
        for item in (payload.temas_docente or [])
        if item.tema
    ]

    MesaActaOral.objects.update_or_create(
        inscripcion=inscripcion,
        defaults={
            "mesa": inscripcion.mesa,
            "acta_numero": payload.acta_numero or "",
            "folio_numero": payload.folio_numero or "",
            "fecha": payload.fecha,
            "curso": payload.curso or "",
            "nota_final": payload.nota_final or "",
            "observaciones": payload.observaciones or "",
            "temas_alumno": temas_alumno,
            "temas_docente": temas_docente,
        },
    )

    return ApiResponse(ok=True, message="Acta oral guardada correctamente.")


@carga_notas_router.get(
    "/mesas/{mesa_id}/oral-actas",
    response={200: list[ActaOralListItemSchema], 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_actas_orales(request, mesa_id: int):
    mesa = MesaExamen.objects.filter(id=mesa_id).first()
    if not mesa:
        return 404, ApiResponse(ok=False, message="Mesa no encontrada.")

    actas = (
        MesaActaOral.objects.filter(mesa_id=mesa_id)
        .select_related("inscripcion__estudiante__user")
        .order_by(
            "inscripcion__estudiante__user__last_name",
            "inscripcion__estudiante__user__first_name",
        )
    )

    payload: list[ActaOralListItemSchema] = []
    for acta in actas:
        estudiante = acta.inscripcion.estudiante
        full_name = estudiante.user.get_full_name().strip() or f"{estudiante.user.last_name} {estudiante.user.first_name}".strip()
        payload.append(
            ActaOralListItemSchema(
                inscripcion_id=acta.inscripcion_id,
                alumno=full_name,
                dni=estudiante.dni,
                acta_numero=acta.acta_numero or None,
                folio_numero=acta.folio_numero or None,
                fecha=acta.fecha,
                curso=acta.curso or None,
                nota_final=acta.nota_final or None,
                observaciones=acta.observaciones or None,
                temas_alumno=acta.temas_alumno or [],
                temas_docente=acta.temas_docente or [],
            )
        )

    return payload
