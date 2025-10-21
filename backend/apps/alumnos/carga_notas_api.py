from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from django.db import transaction
from django.db.models import Prefetch, Q
from ninja import Router, Schema

from apps.common.api_schemas import ApiResponse
from core.models import (
    Comision,
    InscripcionMateriaAlumno,
    Materia,
    Regularidad,
    Profesorado,
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


@carga_notas_router.get(
    "/comisiones",
    response=List[ComisionOption],
)
def listar_comisiones(
    request,
    profesorado_id: Optional[int] = None,
    materia_id: Optional[int] = None,
    plan_id: Optional[int] = None,
    anio: Optional[int] = None,
    cuatrimestre: Optional[str] = None,
):
    comisiones = (
        Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado",
            "turno",
        )
        .order_by("-anio_lectivo", "materia__nombre", "codigo")
    )

    if profesorado_id:
        comisiones = comisiones.filter(
            materia__plan_de_estudio__profesorado_id=profesorado_id
        )
    if plan_id:
        comisiones = comisiones.filter(materia__plan_de_estudio_id=plan_id)
    if materia_id:
        comisiones = comisiones.filter(materia_id=materia_id)
    if anio:
        comisiones = comisiones.filter(anio_lectivo=anio)
    if cuatrimestre:
        comisiones = comisiones.filter(
            Q(cuatrimestre=cuatrimestre)
            | Q(cuatrimestre__isnull=True)
            | Q(cuatrimestre="")
        )

    salida: List[ComisionOption] = []
    for com in comisiones:
        materia = com.materia
        plan = materia.plan_de_estudio
        profesorado = plan.profesorado
        salida.append(
            ComisionOption(
                id=com.id,
                materia_id=materia.id,
                materia_nombre=materia.nombre,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan.id,
                plan_resolucion=plan.resolucion,
                anio=com.anio_lectivo,
                cuatrimestre=com.cuatrimestre,
                turno=com.turno.nombre,
                codigo=com.codigo,
            )
        )
    return salida


def _formato_clave(formato: str) -> str:
    if formato in FORMATOS_TALLER:
        return "TAL"
    if formato == Materia.FormatoMateria.MODULO:
        return "MOD"
    return "ASI"


def _situaciones_para_formato(formato: str) -> List[dict]:
    clave = _formato_clave(formato)
    return _SITUACIONES[clave]


def _alias_desde_situacion(codigo: str) -> Optional[str]:
    return SITUACION_TO_ALIAS.get(codigo)


@carga_notas_router.get(
    "/regularidad",
    response={200: RegularidadPlanillaOut, 400: ApiResponse, 404: ApiResponse},
)
def obtener_planilla_regularidad(request, comision_id: int):
    comision = (
        Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado", "turno"
        )
        .filter(id=comision_id)
        .first()
    )
    if not comision:
        return 404, ApiResponse(ok=False, message="Comisión no encontrada.")

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

    return RegularidadPlanillaOut(
        materia_id=comision.materia_id,
        materia_nombre=comision.materia.nombre,
        formato=comision.materia.formato,
        comision_id=comision.id,
        comision_codigo=comision.codigo,
        anio=comision.anio_lectivo,
        turno=comision.turno.nombre,
        situaciones=situaciones,
        alumnos=alumnos,
    )


@carga_notas_router.post(
    "/regularidad",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def guardar_planilla_regularidad(request, payload: RegularidadCargaIn):
    comision = (
        Comision.objects.select_related("materia")
        .filter(id=payload.comision_id)
        .first()
    )
    if not comision:
        return 404, ApiResponse(ok=False, message="Comisión no encontrada.")

    situaciones_validas = {
        item["alias"] for item in _situaciones_para_formato(comision.materia.formato)
    }

    if not payload.alumnos:
        return 400, ApiResponse(ok=False, message="No se enviaron alumnos para guardar.")

    fecha = payload.fecha_cierre or date.today()

    with transaction.atomic():
        for alumno in payload.alumnos:
            if alumno.situacion not in situaciones_validas:
                return 400, ApiResponse(
                    ok=False,
                    message=f"Situación '{alumno.situacion}' no permitida para el formato de la materia.",
                )

            situacion_codigo = ALIAS_TO_SITUACION.get(alumno.situacion)
            if not situacion_codigo:
                return 400, ApiResponse(
                    ok=False, message=f"Situación desconocida: {alumno.situacion}"
                )

            if (
                alumno.situacion == "PROMOCION"
                and alumno.nota_final is not None
                and alumno.nota_final < 8
            ):
                return 400, ApiResponse(
                    ok=False,
                    message="La nota final debe ser ≥ 8 para registrar PROMOCION.",
                )

            inscripcion = (
                InscripcionMateriaAlumno.objects.filter(
                    id=alumno.inscripcion_id,
                    comision_id=comision.id,
                )
                .select_related("estudiante", "materia")
                .first()
            )
            if not inscripcion:
                return 400, ApiResponse(
                    ok=False,
                    message=f"Inscripción {alumno.inscripcion_id} no pertenece a la comisión.",
                )

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
