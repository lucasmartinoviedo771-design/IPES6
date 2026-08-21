from datetime import date

from django.http import HttpRequest
from django.utils import timezone
from ninja import Router
from pydantic import BaseModel

from apps.asistencia.models import (
    AsistenciaCargoDocente,
    AsistenciaDocente,
    CargoDocente,
    ClaseProgramada,
    HorarioCargo,
)
from apps.common.date_utils import format_date, format_datetime
from core.auth_ninja import JWTAuth
from core.models import Docente, Estudiante

router = Router(tags=["asistencia-reportes"], auth=JWTAuth())


class ReporteDiarioDocenteItem(BaseModel):
    docente_id: int
    docente_nombre: str
    docente_dni: str
    es_cargo: bool
    clase_id: int | None = None
    cargo_id: int | None = None
    materia_o_cargo: str
    comision: str | None = None
    horario: str
    estado: str
    registrado_en: str | None = None
    observaciones: str | None = None


@router.get("/docentes/diario", response=list[ReporteDiarioDocenteItem])
def reporte_diario_docentes(request: HttpRequest, fecha: date):
    """
    Devuelve todas las clases y cargos programados para la fecha dada,
    junto con el estado de asistencia de cada docente responsable.
    """
    items = []

    # 1. Clases Programadas
    clases = ClaseProgramada.objects.filter(
        fecha=fecha,
        estado__in=[
            ClaseProgramada.Estado.PROGRAMADA,
            ClaseProgramada.Estado.EN_CURSO,
            ClaseProgramada.Estado.IMPARTIDA,
        ],
    ).select_related("docente__persona", "comision__materia", "comision__turno")

    # Buscar asistencias de las clases
    asistencias_clases = {a.clase_id: a for a in AsistenciaDocente.objects.filter(clase__in=clases)}

    for clase in clases:
        if not clase.docente or not clase.docente.persona:
            continue

        asistencia = asistencias_clases.get(clase.id)

        horario = ""
        if clase.hora_inicio and clase.hora_fin:
            horario = f"{clase.hora_inicio.strftime('%H:%M')} a {clase.hora_fin.strftime('%H:%M')}"

        items.append(
            ReporteDiarioDocenteItem(
                docente_id=clase.docente.id,
                docente_nombre=f"{clase.docente.apellido}, {clase.docente.nombre}",
                docente_dni=clase.docente.persona.dni,
                es_cargo=False,
                clase_id=clase.id,
                materia_o_cargo=clase.comision.materia.nombre,
                comision=clase.comision.codigo,
                horario=horario,
                estado=asistencia.get_estado_display() if asistencia else "Pendiente",
                registrado_en=format_datetime(asistencia.registrado_en) if asistencia else None,
                observaciones=asistencia.observaciones if asistencia else None,
            )
        )

    # 2. Cargos
    # Python weekday(): 0=Lunes, 1=Martes, 2=Miércoles, 3=Jueves, 4=Viernes, 5=Sábado, 6=Domingo
    # DB HorarioCargo.DIA_CHOICES: 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado
    dia_semana_py = fecha.weekday()
    dia_db = 0 if dia_semana_py == 6 else (dia_semana_py + 1)

    horarios_cargo = HorarioCargo.objects.filter(dia_semana=dia_db).select_related("cargo")

    for hc in horarios_cargo:
        if not hc.cargo or not hc.cargo.activo:
            continue
        cargos_docentes = CargoDocente.objects.filter(cargo=hc.cargo, activo=True).select_related("docente__persona")

        for cd in cargos_docentes:
            if not cd.docente or not cd.docente.persona:
                continue
            asistencia = AsistenciaCargoDocente.objects.filter(cargo_docente=cd, fecha=fecha, horario=hc).first()

            horario = f"{hc.hora_inicio.strftime('%H:%M')} a {hc.hora_fin.strftime('%H:%M')}"

            items.append(
                ReporteDiarioDocenteItem(
                    docente_id=cd.docente.id,
                    docente_nombre=f"{cd.docente.apellido}, {cd.docente.nombre}",
                    docente_dni=cd.docente.persona.dni,
                    es_cargo=True,
                    cargo_id=hc.id,
                    materia_o_cargo=hc.cargo.nombre,
                    comision=hc.cargo.codigo_cargo,
                    horario=horario,
                    estado=asistencia.get_estado_display() if asistencia else "Pendiente",
                    registrado_en=format_datetime(asistencia.registrado_en) if asistencia else None,
                    observaciones=asistencia.observaciones if asistencia else None,
                )
            )

    # 3. Cargos asignados a docentes activos que aún no tienen bloques horarios cargados
    cargos_sin_horario = CargoDocente.objects.filter(activo=True, cargo__activo=True).exclude(
        cargo__horarios__dia_semana=dia_db
    ).select_related("docente__persona", "cargo")

    for cd in cargos_sin_horario:
        # Solo mostrar si el cargo no tiene horarios definidos para ningún día
        if not cd.cargo.horarios.exists() and cd.docente and cd.docente.persona:
            asistencia = AsistenciaCargoDocente.objects.filter(cargo_docente=cd, fecha=fecha).first()
            items.append(
                ReporteDiarioDocenteItem(
                    docente_id=cd.docente.id,
                    docente_nombre=f"{cd.docente.apellido}, {cd.docente.nombre}",
                    docente_dni=cd.docente.persona.dni,
                    es_cargo=True,
                    cargo_id=None,
                    materia_o_cargo=cd.cargo.nombre,
                    comision=cd.cargo.codigo_cargo,
                    horario="Sin horario definido",
                    estado=asistencia.get_estado_display() if asistencia else "Asignado (s/horario)",
                    registrado_en=format_datetime(asistencia.registrado_en) if asistencia else None,
                    observaciones=asistencia.observaciones if asistencia else None,
                )
            )

    # Ordenar por nombre de docente
    items.sort(key=lambda x: x.docente_nombre)
    return items


class ReporteMateriaEstudianteItem(BaseModel):
    estudiante_id: int
    estudiante_nombre: str
    estudiante_dni: str
    clase_id: int
    fecha: str
    estado: str
    justificado: bool
    observaciones: str | None = None


@router.get("/estudiantes/materia", response=list[ReporteMateriaEstudianteItem])
def reporte_materia_estudiantes(request: HttpRequest, comision_id: int):
    """
    Devuelve el reporte de asistencia detallado por clase para todos los alumnos
    inscritos en una comisión.
    """
    from apps.asistencia.models import AsistenciaEstudiante
    from apps.estudiantes.models import InscripcionCursada

    # Obtener todas las clases de esta comisión que ya ocurrieron
    clases = ClaseProgramada.objects.filter(
        comision_id=comision_id, estado__in=[ClaseProgramada.Estado.CONFIRMADA, ClaseProgramada.Estado.FINALIZADA]
    ).order_by("fecha")

    # Obtener estudiantes inscritos
    inscripciones = InscripcionCursada.objects.filter(
        comision_id=comision_id, estado=InscripcionCursada.Estado.ACTIVA
    ).select_related("estudiante__persona")

    items = []

    asistencias = AsistenciaEstudiante.objects.filter(clase__in=clases).select_related("clase")

    # Agrupar asistencias
    asistencia_map = {}
    for a in asistencias:
        key = f"{a.estudiante_id}_{a.clase_id}"
        asistencia_map[key] = a

    for ins in inscripciones:
        est = ins.estudiante
        for clase in clases:
            key = f"{est.id}_{clase.id}"
            a = asistencia_map.get(key)

            estado_str = "Ausente"
            justificado = False
            obs = None
            if a:
                estado_str = a.get_estado_display()
                justificado = a.justificada
                obs = a.observaciones

            items.append(
                ReporteMateriaEstudianteItem(
                    estudiante_id=est.id,
                    estudiante_nombre=f"{est.apellido}, {est.nombre}",
                    estudiante_dni=est.persona.dni,
                    clase_id=clase.id,
                    fecha=format_date(clase.fecha),
                    estado=estado_str,
                    justificado=justificado,
                    observaciones=obs,
                )
            )

    return items
