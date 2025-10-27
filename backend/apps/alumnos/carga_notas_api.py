from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from django.db import transaction
from ninja import Router, Schema

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    Comision,
    InscripcionMateriaAlumno,
    Materia,
    PlanDeEstudio,
    Regularidad,
)




carga_notas_router = Router(tags=["carga_notas"])


class RegularidadAlumnoOut(Schema):
    inscripcion_id: int
    alumno_id: int
    orden: int
    apellido_nombre: str
    dni: str
    nota_tp: Optional[float] = None
    nota_final: Optional[int] = None
    asistencia: Optional[int] = None
    excepcion: bool = False
    situacion: Optional[str] = None
    observaciones: Optional[str] = None


class RegularidadPlanillaOut(Schema):
    materia_id: int
    materia_nombre: str
    formato: str
    comision_id: int
    comision_codigo: str
    anio: int
    turno: str
    situaciones: List[dict]
    alumnos: List[RegularidadAlumnoOut]


class RegularidadAlumnoIn(Schema):
    inscripcion_id: int
    nota_tp: Optional[float] = None
    nota_final: Optional[int] = None
    asistencia: Optional[int] = None
    excepcion: bool = False
    situacion: str
    observaciones: Optional[str] = None


class RegularidadCargaIn(Schema):
    comision_id: int
    fecha_cierre: Optional[date] = None
    alumnos: List[RegularidadAlumnoIn]
    observaciones_generales: Optional[str] = None


FORMATOS_TALLER = {"TAL", "PRA", "SEM", "LAB"}

_VIRTUAL_COMISION_FACTOR = 10000


def _virtual_comision_id(materia_id: int, anio: Optional[int]) -> int:
    base = materia_id * _VIRTUAL_COMISION_FACTOR + (anio or 0)
    return -base


def _split_virtual_comision_id(raw_id: int) -> tuple[int, Optional[int]]:
    absolute = abs(raw_id)
    materia_id = absolute // _VIRTUAL_COMISION_FACTOR
    anio = absolute % _VIRTUAL_COMISION_FACTOR
    return materia_id, anio or None

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

ALIAS_TO_SITUACION = {
    item["alias"]: item["codigo"]
    for items in _SITUACIONES.values()
    for item in items
}

SITUACION_TO_ALIAS = {v: k for k, v in ALIAS_TO_SITUACION.items()}


def _situaciones_para_formato(formato: str) -> List[dict]:
    if not formato:
        return _SITUACIONES["ASI"]
    formato_key = formato.upper()
    if formato_key in _SITUACIONES:
        return _SITUACIONES[formato_key]
    if formato_key in FORMATOS_TALLER:
        return _SITUACIONES["TAL"]
    return _SITUACIONES["ASI"]


def _alias_desde_situacion(codigo: str | None) -> Optional[str]:
    if not codigo:
        return None
    return SITUACION_TO_ALIAS.get(codigo, None)


class MateriaOption(Schema):
    id: int
    nombre: str
    plan_id: int
    anio: Optional[int] = None
    cuatrimestre: Optional[str] = None
    formato: Optional[str] = None


class ComisionOption(Schema):
    id: int
    materia_id: int
    materia_nombre: str
    profesorado_id: int
    profesorado_nombre: str
    plan_id: int
    plan_resolucion: str
    anio: int
    cuatrimestre: Optional[str] = None
    turno: str
    codigo: str


class CargaNotasLookup(Schema):
    materias: List[MateriaOption]
    comisiones: List[ComisionOption]



@carga_notas_router.get(
    "/comisiones",
    response=CargaNotasLookup,
    auth=JWTAuth(),
)
def listar_comisiones(
    request,
    profesorado_id: Optional[int] = None,
    materia_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    anio: Optional[int] = None,
    cuatrimestre: Optional[str] = None,
):
    if not plan_id:
        return CargaNotasLookup(materias=[], comisiones=[])

    plan = (
        PlanDeEstudio.objects.select_related("profesorado")
        .filter(id=plan_id)
        .first()
    )
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

    materias_out: List[MateriaOption] = [
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

    comisiones_out: List[ComisionOption] = []
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

    inscripciones_libres = InscripcionMateriaAlumno.objects.filter(
        materia__plan_de_estudio=plan, comision__isnull=True
    )
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


def _build_regularidad_alumnos(inscripciones) -> List[RegularidadAlumnoOut]:
    alumnos: List[RegularidadAlumnoOut] = []
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
                apellido_nombre=insc.estudiante.user.get_full_name()
                if insc.estudiante.user_id
                else "",
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
            Comision.objects.select_related(
                "materia__plan_de_estudio__profesorado", "turno"
            )
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

    materia = (
        Materia.objects.select_related("plan_de_estudio__profesorado")
        .filter(id=materia_id)
        .first()
    )
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
        comision = (
            Comision.objects.select_related("materia")
            .filter(id=payload.comision_id)
            .first()
        )
        if not comision:
            return 404, ApiResponse(ok=False, message="Comision no encontrada.")
        materia = comision.materia

    situaciones_validas = {
        item["alias"] for item in _situaciones_para_formato(materia.formato)
    }

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
                return 400, ApiResponse(
                    ok=False, message=f"Situacion desconocida: {alumno.situacion}"
                )

            if (
                alumno.situacion == "PROMOCION"
                and alumno.nota_final is not None
                and alumno.nota_final < 8
            ):
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

            inscripcion = (
                inscripcion_qs.select_related("estudiante", "materia").first()
            )

            if not inscripcion:
                if is_virtual:
                    message = (
                        f"Inscripcion {alumno.inscripcion_id} no corresponde a la materia sin comision."
                    )
                else:
                    message = (
                        f"Inscripcion {alumno.inscripcion_id} no pertenece a la comision."
                    )
                return 400, ApiResponse(ok=False, message=message)

            Regularidad.objects.update_or_create(
                inscripcion=inscripcion,
                defaults={
                    "estudiante": inscripcion.estudiante,
                    "materia": inscripcion.materia,
                    "fecha_cierre": fecha,
                    "nota_trabajos_practicos": Decimal(str(alumno.nota_tp))
                    if alumno.nota_tp is not None
                    else None,
                    "nota_final_cursada": alumno.nota_final,
                    "asistencia_porcentaje": alumno.asistencia,
                    "excepcion": alumno.excepcion,
                    "situacion": situacion_codigo,
                    "observaciones": alumno.observaciones or "",
                },
            )

    return ApiResponse(ok=True, message="Notas de regularidad guardadas correctamente.")
