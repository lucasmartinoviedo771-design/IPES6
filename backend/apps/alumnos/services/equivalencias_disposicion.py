from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from itertools import chain

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q

from core.models import (
    ActaExamen,
    ActaExamenAlumno,
    Correlatividad,
    CorrelatividadVersion,
    EquivalenciaDisposicion,
    EquivalenciaDisposicionDetalle,
    Estudiante,
    InscripcionMesa,
    Materia,
    PlanDeEstudio,
    Profesorado,
    Regularidad,
)
from apps.alumnos.services.cursada import estudiante_tiene_materia_aprobada


@dataclass
class EquivalenciaDisposicionResult:
    disposicion: EquivalenciaDisposicion
    detalles: list[EquivalenciaDisposicionDetalle]


def _correlatividades_qs(materia: Materia, tipo: str, estudiante: Estudiante | None = None):
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


def _materias_aprobadas_ids(estudiante: Estudiante, plan: PlanDeEstudio) -> set[int]:
    actas_ids = set(
        ActaExamenAlumno.objects.filter(
            dni=estudiante.dni,
            acta__materia__plan_de_estudio=plan,
        ).values_list("acta__materia_id", flat=True)
    )
    mesas_ids = set(
        InscripcionMesa.objects.filter(
            estudiante=estudiante,
            mesa__materia__plan_de_estudio=plan,
            condicion=InscripcionMesa.Condicion.APROBADO,
        ).values_list("mesa__materia_id", flat=True)
    )
    reg_ids = set(
        Regularidad.objects.filter(
            estudiante=estudiante,
            materia__plan_de_estudio=plan,
            situacion__in=(
                Regularidad.Situacion.PROMOCIONADO,
                Regularidad.Situacion.APROBADO,
            ),
        ).values_list("materia_id", flat=True)
    )
    return set(chain(actas_ids, mesas_ids, reg_ids))


def materias_pendientes_para_equivalencia(estudiante: Estudiante, plan: PlanDeEstudio):
    aprobadas = _materias_aprobadas_ids(estudiante, plan)
    materias = Materia.objects.filter(plan_de_estudio=plan).order_by("anio_cursada", "nombre")
    return materias.exclude(id__in=aprobadas)


def _verificar_correlatividades_final(estudiante: Estudiante, materia: Materia) -> list[str]:
    faltantes: list[str] = []
    req_ids = list(
        _correlatividades_qs(
            materia,
            Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR,
            estudiante,
        ).values_list("materia_correlativa_id", flat=True)
    )
    if not req_ids:
        return faltantes
    reg_map: dict[int, Regularidad] = {}
    regularidades = (
        Regularidad.objects.filter(estudiante=estudiante, materia_id__in=req_ids)
        .order_by("materia_id", "-fecha_cierre")
        .all()
    )
    for reg in regularidades:
        reg_map.setdefault(reg.materia_id, reg)
    for mid in req_ids:
        reg = reg_map.get(mid)
        if not reg or reg.situacion not in (
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            faltantes.append(mid)
    return faltantes


def _crear_acta_equivalencia(
    *,
    estudiante: Estudiante,
    materia: Materia,
    plan: PlanDeEstudio,
    profesorado: Profesorado,
    fecha: date,
    numero_disposicion: str,
    nota: str,
    usuario: User | None,
) -> ActaExamen:
    anio = fecha.year
    codigo = f"EQUIV-{materia.id}-{estudiante.dni}-{numero_disposicion}"
    ultimo_numero = (
        ActaExamen.objects.filter(profesorado=profesorado, anio_academico=anio)
        .order_by("-numero")
        .values_list("numero", flat=True)
        .first()
        or 0
    )
    numero = ultimo_numero + 1
    acta, created = ActaExamen.objects.get_or_create(
        codigo=codigo,
        defaults={
            "numero": numero,
            "anio_academico": anio,
            "tipo": ActaExamen.Tipo.REGULAR,
            "profesorado": profesorado,
            "materia": materia,
            "plan": plan,
            "anio_cursada": materia.anio_cursada,
            "fecha": fecha,
            "folio": numero_disposicion,
            "libro": "",
            "observaciones": "Equivalencia otorgada.",
            "total_alumnos": 1,
            "total_aprobados": 1,
            "total_desaprobados": 0,
            "total_ausentes": 0,
            "created_by": usuario if usuario and usuario.is_authenticated else None,
            "updated_by": usuario if usuario and usuario.is_authenticated else None,
        },
    )
    if not created:
        acta.alumnos.all().delete()
    ActaExamenAlumno.objects.create(
        acta=acta,
        numero_orden=1,
        permiso_examen="EQUIV",
        dni=estudiante.dni,
        apellido_nombre=estudiante.user.get_full_name(),
        calificacion_definitiva=str(nota),
    )
    return acta


@transaction.atomic
def registrar_disposicion_equivalencia(
    *,
    estudiante: Estudiante,
    profesorado: Profesorado,
    plan: PlanDeEstudio,
    numero_disposicion: str,
    fecha_disposicion,
    observaciones: str,
    detalles_payload: list[dict],
    origen: str,
    usuario: User | None,
    validar_correlatividades: bool,
) -> EquivalenciaDisposicionResult:
    dispo = EquivalenciaDisposicion.objects.create(
        origen=origen,
        estudiante=estudiante,
        profesorado=profesorado,
        plan=plan,
        numero_disposicion=numero_disposicion,
        fecha_disposicion=fecha_disposicion,
        observaciones=observaciones or "",
        creado_por=usuario if usuario and usuario.is_authenticated else None,
    )

    detalles: list[EquivalenciaDisposicionDetalle] = []


    for payload in detalles_payload:
        materia = Materia.objects.filter(id=payload["materia_id"], plan_de_estudio=plan).first()
        if not materia:
            raise ValueError("La materia seleccionada no pertenece al plan indicado.")
        
        if estudiante_tiene_materia_aprobada(estudiante, materia):
            raise ValueError(f"La materia {materia.nombre} ya figura como aprobada.")
        nota = (payload.get("nota") or "").strip()
        if not nota:
            raise ValueError(f"Debe indicar la nota para {materia.nombre}.")
        if validar_correlatividades:
            faltantes = _verificar_correlatividades_final(estudiante, materia)
            if faltantes:
                nombres = list(
                    Materia.objects.filter(id__in=faltantes).values_list("nombre", flat=True)
                )
                raise ValueError(
                    f"No se cumplen las correlatividades para rendir {materia.nombre}: {', '.join(nombres)}."
                )

        detalle = EquivalenciaDisposicionDetalle.objects.create(
            disposicion=dispo,
            materia=materia,
            nota=nota,
        )
        detalles.append(detalle)
        _crear_acta_equivalencia(
            estudiante=estudiante,
            materia=materia,
            plan=plan,
            profesorado=profesorado,
            fecha=fecha_disposicion,
            numero_disposicion=numero_disposicion,
            nota=nota,
            usuario=usuario,
        )


    return EquivalenciaDisposicionResult(disposicion=dispo, detalles=detalles)


def resolver_contexto_equivalencia(
    *,
    dni: str,
    profesorado_id: int,
    plan_id: int,
) -> tuple[Estudiante, Profesorado, PlanDeEstudio]:
    estudiante = Estudiante.objects.select_related("user").filter(dni=dni).first()
    if not estudiante:
        raise ValueError("No se encontró el estudiante indicado.")
    profesorado = Profesorado.objects.filter(id=profesorado_id).first()
    if not profesorado:
        raise ValueError("No se encontró el profesorado seleccionado.")
    if not estudiante.carreras.filter(id=profesorado.id).exists():
        raise ValueError("El estudiante no está inscripto en el profesorado seleccionado.")
    plan = (
        PlanDeEstudio.objects.select_related("profesorado")
        .filter(id=plan_id, profesorado=profesorado)
        .first()
    )
    if not plan:
        raise ValueError("El plan de estudio no pertenece al profesorado indicado.")
    return estudiante, profesorado, plan


def serialize_disposicion(dispo: EquivalenciaDisposicion, detalles=None) -> dict:
    detalles = detalles or list(dispo.detalles.select_related("materia"))
    return {
        "id": dispo.id,
        "origen": dispo.origen,
        "numero_disposicion": dispo.numero_disposicion,
        "fecha_disposicion": dispo.fecha_disposicion.isoformat(),
        "profesorado_id": dispo.profesorado_id,
        "profesorado_nombre": dispo.profesorado.nombre,
        "plan_id": dispo.plan_id,
        "plan_resolucion": dispo.plan.resolucion,
        "observaciones": dispo.observaciones,
        "creado_por": dispo.creado_por.get_full_name() if dispo.creado_por else None,
        "creado_en": dispo.creado_en.isoformat(),
        "detalles": [
            {
                "id": detalle.id,
                "materia_id": detalle.materia_id,
                "materia_nombre": detalle.materia.nombre,
                "nota": detalle.nota,
            }
            for detalle in detalles
        ],
    }
