from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterable, Sequence

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from core.models import Comision, Docente, Estudiante, InscripcionMateriaAlumno

from .models import (
    AsistenciaAlumno,
    AsistenciaDocente,
    ClaseProgramada,
    CalendarioAsistenciaEvento,
    CursoAlumnoSnapshot,
    CursoHorarioSnapshot,
    DocenteMarcacionLog,
    Justificacion,
    JustificacionDetalle,
)


TOLERANCIA_ANTERIOR_MINUTOS = 10
TOLERANCIA_TARDE_MINUTOS = 15


@dataclass
class ClaseGenerada:
    clase: ClaseProgramada
    creada: bool


EVENT_NOTE_PREFIX = "[Evento] "


def _eventos_para_fecha(fecha: date) -> list[CalendarioAsistenciaEvento]:
    return list(
        CalendarioAsistenciaEvento.objects.filter(
            activo=True,
            fecha_desde__lte=fecha,
            fecha_hasta__gte=fecha,
        ).select_related(
            "turno",
            "profesorado",
            "plan",
            "plan__profesorado",
            "comision",
            "comision__materia__plan_de_estudio__profesorado",
            "docente",
        )
    )


def _buscar_evento_que_aplica(
    eventos: list[CalendarioAsistenciaEvento],
    *,
    fecha: date,
    turno_id: int | None,
    campo: str,
    contexto: dict[str, int | None] | None = None,
) -> CalendarioAsistenciaEvento | None:
    for evento in eventos:
        if not getattr(evento, campo, False):
            continue
        if not evento.cubre_fecha(fecha, turno_id):
            continue
        if contexto and not evento.aplica_a_contexto(contexto=contexto):
            continue
        return evento
    return None


def _contexto_para_horario(horario) -> dict[str, int | None]:
    comision = horario.comision
    plan_id = None
    profesorado_id = None
    if comision and comision.materia_id:
        materia = getattr(comision, "materia", None)
        if materia and materia.plan_de_estudio_id:
            plan_id = materia.plan_de_estudio_id
            profesorado_id = materia.plan_de_estudio.profesorado_id
    return {
        "comision_id": comision.id if comision else None,
        "plan_id": plan_id,
        "profesorado_id": profesorado_id,
        "docente_id": comision.docente_id if comision else None,
    }


def _mensaje_evento(evento: CalendarioAsistenciaEvento) -> str:
    partes = [evento.nombre]
    if evento.turno_id:
        partes.append(f"Turno {evento.turno.nombre}")
    if evento.motivo:
        partes.append(evento.motivo)
    cuerpo = " - ".join(part for part in partes if part)
    return f"{EVENT_NOTE_PREFIX}{cuerpo}" if cuerpo else EVENT_NOTE_PREFIX.strip()


def _aplicar_evento_sobre_clase(
    clase: ClaseProgramada,
    *,
    evento_docentes: CalendarioAsistenciaEvento | None,
    evento_estudiantes: CalendarioAsistenciaEvento | None,
) -> None:
    nota_evento = _mensaje_evento(evento_docentes or evento_estudiantes) if (evento_docentes or evento_estudiantes) else ""
    campos_actualizados: list[str] = []
    if clase.estado != ClaseProgramada.Estado.CANCELADA:
        clase.estado = ClaseProgramada.Estado.CANCELADA
        campos_actualizados.append("estado")
    if nota_evento and clase.notas != nota_evento:
        clase.notas = nota_evento
        campos_actualizados.append("notas")
    if campos_actualizados:
        clase.save(update_fields=[*campos_actualizados, "actualizado_en"])

    if evento_docentes and clase.docente_id:
        asistencia_docente, _ = AsistenciaDocente.objects.get_or_create(
            clase=clase,
            docente=clase.docente,
            defaults={
                "estado": AsistenciaDocente.Estado.JUSTIFICADA,
                "registrado_via": AsistenciaDocente.RegistradoVia.SISTEMA,
            },
        )
        asistencia_docente.estado = AsistenciaDocente.Estado.JUSTIFICADA
        asistencia_docente.justificacion = None
        asistencia_docente.alerta = False
        asistencia_docente.alerta_tipo = ""
        asistencia_docente.alerta_motivo = nota_evento
        asistencia_docente.registrado_via = AsistenciaDocente.RegistradoVia.SISTEMA
        asistencia_docente.registrado_por = None
        asistencia_docente.registrado_en = timezone.now()
        asistencia_docente.save(
            update_fields=[
                "estado",
                "justificacion",
                "alerta",
                "alerta_tipo",
                "alerta_motivo",
                "registrado_via",
                "registrado_por",
                "registrado_en",
            ]
        )

    if evento_estudiantes:
        _ensure_asistencias_estudiantes(clase)
        alumnos_qs = AsistenciaAlumno.objects.filter(clase=clase)
        alumnos_qs.update(
            estado=AsistenciaAlumno.Estado.AUSENTE_JUSTIFICADA,
            justificacion=None,
            registrado_via=AsistenciaAlumno.RegistradoVia.SISTEMA,
            registrado_por=None,
            registrado_en=timezone.now(),
        )


def _docente_nombre_snapshot(docente: Docente | None) -> str:
    if not docente:
        return ""
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part).strip()
    return nombre or docente.dni or ""


def _resolver_estudiante(snapshot: CursoAlumnoSnapshot) -> Estudiante | None:
    if snapshot.estudiante_id:
        return snapshot.estudiante
    return Estudiante.objects.filter(dni=snapshot.dni).first()


def _obtener_clases_del_turno(clase: ClaseProgramada):
    turno = clase.comision.turno if clase.comision_id else None
    queryset = ClaseProgramada.objects.filter(
        docente=clase.docente,
        fecha=clase.fecha,
        comision__in=Comision.objects.filter(docente=clase.docente, turno=turno),
    )
    return queryset


def calcular_ventanas_turno(clase: ClaseProgramada):
    """
    Devuelve una tupla (ventana_inicio, umbral_tarde, ventana_fin, turno_nombre).
    Las fechas devueltas son aware usando la zona horaria actual.
    """
    if not clase.docente:
        return None
    clases_turno = list(
        _obtener_clases_del_turno(clase)
        .exclude(hora_inicio__isnull=True)
        .order_by("hora_inicio")
    )
    if not clases_turno:
        return None

    primera = min(
        (c.hora_inicio for c in clases_turno if c.hora_inicio),
        default=None,
    )
    ultima = max(
        (c.hora_fin for c in clases_turno if c.hora_fin),
        default=None,
    )

    if not primera:
        return None

    # Fallback de fin si no hay hora_fin: asumimos 3 horas desde el inicio.
    if not ultima:
        ultima_dt = datetime.combine(clase.fecha, primera) + timedelta(hours=3)
        ultima = ultima_dt.time()

    base_date = clase.fecha
    base_inicio = datetime.combine(base_date, primera)
    base_fin = datetime.combine(base_date, ultima)

    if settings.USE_TZ:
        tz = timezone.get_current_timezone()
        ventana_inicio = timezone.make_aware(
            base_inicio - timedelta(minutes=TOLERANCIA_ANTERIOR_MINUTOS),
            tz,
        )
        umbral_tarde = timezone.make_aware(
            base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS),
            tz,
        )
        ventana_fin = timezone.make_aware(base_fin, tz)
    else:
        ventana_inicio = base_inicio - timedelta(minutes=TOLERANCIA_ANTERIOR_MINUTOS)
        umbral_tarde = base_inicio + timedelta(minutes=TOLERANCIA_TARDE_MINUTOS)
        ventana_fin = base_fin
    turno_nombre = clase.comision.turno.nombre if clase.comision and clase.comision.turno_id else ""
    return ventana_inicio, umbral_tarde, ventana_fin, turno_nombre



@transaction.atomic
def generate_classes_for_date(target_date: date, *, comision_ids: Sequence[int] | None = None) -> list[ClaseGenerada]:
    """
    Crea (si no existen) las ClaseProgramada según los snapshots del día indicado.

    También prepara registros de asistencia de estudiantes con estado "ausente" por defecto,
    dejando todo listo para que el docente marque presentes.
    """
    weekday = target_date.weekday()  # 0 = lunes
    horario_qs = CursoHorarioSnapshot.objects.filter(dia_semana=weekday)
    if comision_ids:
        horario_qs = horario_qs.filter(comision_id__in=comision_ids)

    eventos_dia = _eventos_para_fecha(target_date)

    generadas: list[ClaseGenerada] = []
    for horario in horario_qs.select_related(
        "comision",
        "comision__docente",
        "comision__turno",
        "comision__materia__plan_de_estudio__profesorado",
    ):
        turno_id = horario.comision.turno_id
        contexto = _contexto_para_horario(horario)
        evento_doc = _buscar_evento_que_aplica(
            eventos_dia,
            fecha=target_date,
            turno_id=turno_id,
            campo="aplica_docentes",
            contexto=contexto,
        )
        evento_est = _buscar_evento_que_aplica(
            eventos_dia,
            fecha=target_date,
            turno_id=turno_id,
            campo="aplica_estudiantes",
            contexto=contexto,
        )

        if evento_doc or evento_est:
            clase_existente = ClaseProgramada.objects.filter(
                comision=horario.comision,
                fecha=target_date,
                hora_inicio=horario.hora_inicio,
                hora_fin=horario.hora_fin,
            ).first()
            if clase_existente:
                _aplicar_evento_sobre_clase(
                    clase_existente,
                    evento_docentes=evento_doc,
                    evento_estudiantes=evento_est,
                )
                generadas.append(ClaseGenerada(clase=clase_existente, creada=False))
            continue

        docente = horario.comision.docente
        defaults = {
            "hora_inicio": horario.hora_inicio,
            "hora_fin": horario.hora_fin,
            "docente": docente,
            "docente_dni": docente.dni if docente else "",
            "docente_nombre": _docente_nombre_snapshot(docente),
        }

        clase, created = ClaseProgramada.objects.get_or_create(
            comision=horario.comision,
            fecha=target_date,
            hora_inicio=horario.hora_inicio,
            hora_fin=horario.hora_fin,
            defaults=defaults,
        )

        if not created and docente and clase.docente_id != docente.id:
            clase.docente = docente
            clase.docente_dni = docente.dni
            clase.docente_nombre = _docente_nombre_snapshot(docente)
            clase.save(update_fields=["docente", "docente_dni", "docente_nombre", "actualizado_en"])
        elif created is False and clase.estado == ClaseProgramada.Estado.CANCELADA:
            clase.estado = ClaseProgramada.Estado.PROGRAMADA
            if clase.notas and clase.notas.startswith(EVENT_NOTE_PREFIX):
                clase.notas = ""
            clase.save(update_fields=["estado", "notas", "actualizado_en"])

        _ensure_asistencias_estudiantes(clase)
        _ensure_asistencia_docente(clase)

        generadas.append(ClaseGenerada(clase=clase, creada=created))

    return generadas


def generate_classes_for_range(start: date, end: date, *, comision_ids: Sequence[int] | None = None) -> list[ClaseGenerada]:
    """
    Genera clases programadas para un rango de fechas (inclusive).
    """
    current = start
    generadas: list[ClaseGenerada] = []
    while current <= end:
        generadas.extend(generate_classes_for_date(current, comision_ids=comision_ids))
        current += timedelta(days=1)
    return generadas


def _ensure_asistencias_estudiantes(clase: ClaseProgramada) -> None:
    snapshot_qs = CursoAlumnoSnapshot.objects.filter(comision=clase.comision, activo=True)

    for snapshot in snapshot_qs:
        estudiante = _resolver_estudiante(snapshot)
        if not estudiante:
            continue

        AsistenciaAlumno.objects.get_or_create(
            clase=clase,
            estudiante=estudiante,
            defaults={
                "estado": AsistenciaAlumno.Estado.AUSENTE,
                "registrado_via": AsistenciaAlumno.RegistradoVia.SISTEMA,
            },
        )


def _ensure_asistencia_docente(clase: ClaseProgramada) -> None:
    docente = clase.docente
    if not docente:
        return
    AsistenciaDocente.objects.get_or_create(
        clase=clase,
        docente=docente,
        defaults={
            "estado": AsistenciaDocente.Estado.AUSENTE,
            "registrado_via": AsistenciaDocente.RegistradoVia.SISTEMA,
        },
    )


def registrar_log_docente(
    *,
    dni: str,
    resultado: DocenteMarcacionLog.Resultado,
    docente: Docente | None = None,
    clase: ClaseProgramada | None = None,
    detalle: str = "",
    alerta: bool = False,
    origen: str = "kiosk",
) -> DocenteMarcacionLog:
    return DocenteMarcacionLog.objects.create(
        dni=dni,
        docente=docente,
        clase=clase,
        resultado=resultado,
        detalle=detalle[:255],
        alerta=alerta,
        origen=origen,
    )


@transaction.atomic
def sync_course_snapshots(*, comisiones: Iterable[Comision] | None = None, anio: int | None = None) -> None:
    """
    Actualiza las tablas snapshot (horarios y alumnos) a partir de las comisiones reales.
    """
    comision_qs = comisiones if comisiones is not None else Comision.objects.all()
    for comision in comision_qs:
        _sync_horarios_snapshot(comision)
        _sync_alumnos_snapshot(comision, anio=anio)


def _sync_horarios_snapshot(comision: Comision) -> None:
    CursoHorarioSnapshot.objects.filter(comision=comision).delete()

    if not comision.horario_id:
        return

    detalles = comision.horario.detalles.select_related("bloque")
    bulk = [
        CursoHorarioSnapshot(
            comision=comision,
            dia_semana=detalle.bloque.dia % 7,
            hora_inicio=detalle.bloque.hora_desde,
            hora_fin=detalle.bloque.hora_hasta,
            origen_id=str(detalle.id),
        )
        for detalle in detalles
    ]
    if bulk:
        CursoHorarioSnapshot.objects.bulk_create(bulk, ignore_conflicts=True)


def _sync_alumnos_snapshot(comision: Comision, *, anio: int | None = None) -> None:
    CursoAlumnoSnapshot.objects.filter(comision=comision).delete()

    inscripciones = comision.inscripciones.filter(
        estado=InscripcionMateriaAlumno.Estado.CONFIRMADA,
    )
    if anio is not None:
        inscripciones = inscripciones.filter(anio=anio)

    bulk = []
    for inscripcion in inscripciones.select_related("estudiante__user"):
        estudiante = inscripcion.estudiante
        nombre = estudiante.user.first_name if estudiante.user_id else ""
        apellido = estudiante.user.last_name if estudiante.user_id else ""
        if estudiante.user_id and not (nombre and apellido):
            full_name = estudiante.user.get_full_name()
            if full_name:
                parts = full_name.split(" ", 1)
                if not nombre and parts:
                    nombre = parts[-1] if len(parts) == 1 else parts[0]
                if not apellido and len(parts) > 1:
                    apellido = parts[1]
        bulk.append(
            CursoAlumnoSnapshot(
                comision=comision,
                estudiante=estudiante,
                dni=estudiante.dni,
                nombre=nombre or estudiante.dni,
                apellido=apellido or "",
                activo=True,
            )
        )
    if bulk:
        CursoAlumnoSnapshot.objects.bulk_create(bulk, ignore_conflicts=True)


@transaction.atomic
def apply_justification(justificacion: Justificacion) -> None:
    """
    Aplica el efecto de una justificación aprobada sobre las asistencias registradas.
    """
    detalles = justificacion.detalles.select_related("clase", "estudiante", "docente")

    for detalle in detalles:
        clase = detalle.clase
        if justificacion.tipo == Justificacion.Tipo.ESTUDIANTE and detalle.estudiante:
            asistencia, _ = AsistenciaAlumno.objects.get_or_create(
                clase=clase,
                estudiante=detalle.estudiante,
                defaults={
                    "estado": AsistenciaAlumno.Estado.AUSENTE,
                    "registrado_via": AsistenciaAlumno.RegistradoVia.SISTEMA,
                },
            )
            asistencia.estado = AsistenciaAlumno.Estado.AUSENTE_JUSTIFICADA
            asistencia.justificacion = justificacion
            asistencia.save(update_fields=["estado", "justificacion", "registrado_en"])

        if justificacion.tipo == Justificacion.Tipo.DOCENTE and detalle.docente:
            asistencia, _ = AsistenciaDocente.objects.get_or_create(
                clase=clase,
                docente=detalle.docente,
                defaults={
                    "estado": AsistenciaDocente.Estado.AUSENTE,
                    "registrado_via": AsistenciaDocente.RegistradoVia.SISTEMA,
                },
            )
            asistencia.estado = AsistenciaDocente.Estado.JUSTIFICADA
            asistencia.justificacion = justificacion
            asistencia.save(update_fields=["estado", "justificacion", "registrado_en"])


def attach_classes_to_justification(
    justificacion: Justificacion,
    *,
    comision: Comision,
    estudiante: Estudiante | None = None,
    docente: Docente | None = None,
) -> list[JustificacionDetalle]:
    """
    Crea (si no existen) los detalles de una justificación para cada clase del rango de vigencia.
    """
    clases = ClaseProgramada.objects.filter(
        comision=comision,
        fecha__range=(justificacion.vigencia_desde, justificacion.vigencia_hasta),
    )
    detalles_creados: list[JustificacionDetalle] = []
    for clase in clases:
        detalle, created = JustificacionDetalle.objects.get_or_create(
            justificacion=justificacion,
            clase=clase,
            estudiante=estudiante,
            docente=docente,
        )
        if created:
            detalles_creados.append(detalle)
    return detalles_creados
