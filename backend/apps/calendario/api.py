from datetime import time

from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import Bloque, Comision, HorarioCatedra, HorarioCatedraDetalle, Materia, Turno
from core.permissions import (
    ensure_profesorado_access,
    require,
)

from .schemas import (
    BloqueIn,
    BloqueOut,
    HorarioCatedraDetalleIn,
    HorarioCatedraDetalleOut,
    HorarioCatedraIn,
    HorarioCatedraOut,
    TurnoIn,
    TurnoOut,
)


def _ensure_structure_view(user, profesorado_id: int | None = None) -> None:
    require(user, "ver_estructura")
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _ensure_structure_edit(user, profesorado_id: int | None = None) -> None:
    require(user, "editar_calendario")
    if profesorado_id is not None:
        ensure_profesorado_access(user, profesorado_id)


def _compatible_cuatrimestres(valor: str | None):
    v = (valor or "ANU").upper()
    if v == "ANU":
        return ["ANU", "PCU", "SCU", None]
    if v == "PCU" or v == "1C":
        return ["ANU", "PCU", "1C", None]
    if v == "SCU" or v == "2C":
        return ["ANU", "SCU", "2C", None]
    return ["ANU", v, None]


def _es_taller_residencia(materia: Materia) -> bool:
    nombre = (materia.nombre or "").lower()
    return "taller" in nombre and "residencia" in nombre


def _normalizar(texto: str) -> str:
    return (
        texto.upper().replace("Á", "A").replace("É", "E").replace("Í", "I").replace("Ó", "O").replace("Ú", "U").strip()
    )


def _es_taller_o_practica_4_residencia(materia: Materia) -> bool:
    """
    Retorna True si la materia es un taller de residencia, residencia o práctica 4 (de 4° año)
    con base en los nombres exactos provistos por profesorado.
    """
    if getattr(materia, "anio_cursada", None) != 4:
        return False
    nombre_norm = _normalizar(getattr(materia, "nombre", "") or "")

    # Nombres válidos para Primaria, Secundaria y Especial
    nombres_primaria = {
        "PRACTICA IV: RESIDENCIA PEDAGOGICA",
        "TALLER DE RESIDENCIA DE CIENCIAS NATURALES",
        "TALLER DE RESIDENCIA DE CIENCIAS SOCIALES",
        "TALLER DE RESIDENCIA DE MATEMATICA",
        "TALLER DE RESIDENCIA DE PRACTICAS DEL LENGUAJE",
    }
    if any(nombre_norm.startswith(nv) for nv in nombres_primaria):
        return True

    # Nombres válidos específicamente para Inicial
    try:
        prof_nombre = _normalizar(materia.plan_de_estudio.profesorado.nombre or "")
    except AttributeError:
        prof_nombre = ""
    if "INICIAL" in prof_nombre:
        nombres_inicial = {"PRACTICA IV", "TALLER INTEGRADOR INTERDISCIPLINARIO"}
        if any(nombre_norm.startswith(nv) for nv in nombres_inicial):
            return True

    return False


def _permite_superposicion_residencia(m1: Materia, m2: Materia) -> bool:
    """
    Permite superponer talleres de residencia y práctica 4 del 4° año entre sí.
    """
    return _es_taller_o_practica_4_residencia(m1) and _es_taller_o_practica_4_residencia(m2)


router = Router(tags=["Calendario"])

# --- TURNOS ---


@router.get("/turnos", response=list[TurnoOut])
def list_turnos(request):
    user = getattr(request, "user", None)
    if getattr(user, "is_authenticated", False):
        _ensure_structure_view(user)
    return Turno.objects.all()


@router.post("/turnos", response=TurnoOut, auth=JWTAuth())
def create_turno(request, payload: TurnoIn):
    _ensure_structure_edit(request.user)
    return Turno.objects.create(**payload.dict())


# --- BLOQUES ---


@router.get("/turnos/{turno_id}/bloques", response=list[BloqueOut])
def list_bloques_for_turno(request, turno_id: int):
    user = getattr(request, "user", None)
    if getattr(user, "is_authenticated", False):
        _ensure_structure_view(user)

    return (
        Bloque.objects.filter(turno_id=turno_id)
        .annotate(
            turno_nombre=F("turno__nombre"),
            # dia_display se maneja en el modelo o via annotation si es necesario
        )
        .order_by("dia", "hora_desde")
    )


@router.post("/turnos/{turno_id}/bloques", response=BloqueOut, auth=JWTAuth())
def create_bloque(request, turno_id: int, payload: BloqueIn):
    _ensure_structure_edit(request.user)
    turno = get_object_or_404(Turno, id=turno_id)
    bloque = Bloque.objects.create(turno=turno, **payload.dict())
    return bloque


# --- HORARIOS CATEDRA ---


@router.get("/horarios_catedra", response=list[HorarioCatedraOut], auth=JWTAuth())
def list_horarios_catedra(
    request,
    espacio_id: int | None = None,
    turno_id: int | None = None,
    cuatrimestre: str | None = None,
    anio_cursada: int | None = None,
):
    _ensure_structure_view(request.user)
    qs = HorarioCatedra.objects.all().select_related("espacio", "turno")
    if espacio_id:
        qs = qs.filter(espacio_id=espacio_id)
    if turno_id:
        qs = qs.filter(turno_id=turno_id)
    if cuatrimestre:
        qs = qs.filter(cuatrimestre=cuatrimestre)
    if anio_cursada:
        qs = qs.filter(anio_academico=anio_cursada)

    return qs.annotate(espacio_nombre=F("espacio__nombre"), turno_nombre=F("turno__nombre"))


@router.post("/horarios_catedra", response=HorarioCatedraOut, auth=JWTAuth())
def create_horario_catedra(request, payload: HorarioCatedraIn):
    materia = get_object_or_404(Materia, id=payload.espacio_id)
    _ensure_structure_edit(request.user, materia.plan_de_estudio.profesorado_id)
    hc, _ = HorarioCatedra.objects.get_or_create(
        espacio=materia,
        turno_id=payload.turno_id,
        anio_academico=payload.anio_academico,
        cuatrimestre=payload.cuatrimestre,
    )
    return hc


@router.get("/horarios_catedra/{horario_id}", response=HorarioCatedraOut, auth=JWTAuth())
def get_horario_catedra(request, horario_id: int):
    hc = get_object_or_404(HorarioCatedra.objects.select_related("espacio", "turno"), id=horario_id)
    _ensure_structure_view(request.user, hc.espacio.plan_de_estudio.profesorado_id)
    return hc


@router.put("/horarios_catedra/{horario_id}", response=HorarioCatedraOut, auth=JWTAuth())
def update_horario_catedra(request, horario_id: int, payload: HorarioCatedraIn):
    hc = get_object_or_404(HorarioCatedra, id=horario_id)
    _ensure_structure_edit(request.user, hc.espacio.plan_de_estudio.profesorado_id)
    for attr, value in payload.dict().items():
        setattr(hc, attr, value)
    hc.save()
    return hc


@router.delete("/horarios_catedra/{horario_id}", response={204: None}, auth=JWTAuth())
def delete_horario_catedra(request, horario_id: int):
    hc = get_object_or_404(HorarioCatedra, id=horario_id)
    _ensure_structure_edit(request.user, hc.espacio.plan_de_estudio.profesorado_id)
    hc.delete()
    return 204, None


# --- DETALLES DE HORARIO ---


@router.get("/horarios_catedra/{horario_id}/detalles", response=list[HorarioCatedraDetalleOut], auth=JWTAuth())
def list_horario_detalles(request, horario_id: int):
    hc = get_object_or_404(HorarioCatedra, id=horario_id)
    _ensure_structure_view(request.user, hc.espacio.plan_de_estudio.profesorado_id)
    return hc.detalles.select_related("bloque").annotate(
        bloque_dia=F("bloque__dia"),
        bloque_hora_desde=F("bloque__hora_desde"),
        bloque_hora_hasta=F("bloque__hora_hasta"),
    )


@router.post(
    "/horarios_catedra/{horario_id}/detalles",
    response={200: HorarioCatedraDetalleOut, 409: ApiResponse},
    auth=JWTAuth(),
)
def create_horario_detalle(request, horario_id: int, payload: HorarioCatedraDetalleIn):
    hc = get_object_or_404(HorarioCatedra, id=horario_id)
    _ensure_structure_edit(request.user, hc.espacio.plan_de_estudio.profesorado_id)
    bloque = get_object_or_404(Bloque, id=payload.bloque_id)

    # Un espacio (materia/EDI) con fecha_fin ya vencida no debe seguir "ocupando"
    # el bloque horario para futuras cargas, aunque sus registros históricos
    # de HorarioCatedra/HorarioCatedraDetalle sigan existiendo.
    hoy = timezone.now().date()

    # 1. Conflicto por Alumnos (Mismo Plan + Mismo Año de Carrera + Mismo Turno + Mismo Cuatrimestre)
    # Esto permite que 1er año y 2do año del mismo profesorado tengan clases al mismo tiempo.
    conflictos_alumnos = (
        HorarioCatedraDetalle.objects.filter(
            bloque=bloque,
            horario_catedra__anio_academico=hc.anio_academico,
            horario_catedra__turno=hc.turno,
            horario_catedra__espacio__plan_de_estudio=hc.espacio.plan_de_estudio,
            horario_catedra__espacio__anio_cursada=hc.espacio.anio_cursada,
            horario_catedra__cuatrimestre__in=_compatible_cuatrimestres(hc.cuatrimestre),
        )
        .exclude(horario_catedra=hc)
        .exclude(horario_catedra__espacio__fecha_fin__lt=hoy)
    )

    if conflictos_alumnos.exists():
        real_conflict = None
        for conf in conflictos_alumnos.select_related("horario_catedra__espacio"):
            if _permite_superposicion_residencia(hc.espacio, conf.horario_catedra.espacio):
                if payload.forzar:
                    continue
                return 409, ApiResponse(
                    ok=False,
                    message=f"Existe una superposición horaria con '{conf.horario_catedra.espacio.nombre}'. ¿Desea guardarla de todas formas?",
                    data={"superposicion_residencia": True, "materia_nombre": conf.horario_catedra.espacio.nombre},
                )
            real_conflict = conf
            break

        if real_conflict:
            return 409, ApiResponse(
                ok=False,
                message=f"Espacio ocupado por {real_conflict.horario_catedra.espacio.nombre} ({real_conflict.horario_catedra.espacio.anio_cursada}º año)",
            )

    # 2. Conflicto por Docente (Mismo docente en cualquier año/profesorado en este bloque)
    # Buscamos qué docentes activos están asignados a esta materia en este año lectivo (excluyendo licencias)
    docentes_ids = (
        Comision.objects.filter(materia=hc.espacio, anio_lectivo=hc.anio_academico)
        .exclude(estado="LIC")
        .values_list("docente_id", flat=True)
        .distinct()
    )
    docentes_ids = [d for d in docentes_ids if d]

    if docentes_ids:
        conflictos_docente = (
            HorarioCatedraDetalle.objects.filter(
                bloque=bloque,
                horario_catedra__anio_academico=hc.anio_academico,
                horario_catedra__cuatrimestre__in=_compatible_cuatrimestres(hc.cuatrimestre),
                horario_catedra__comisiones__docente_id__in=docentes_ids,
            )
            .exclude(horario_catedra=hc)
            .exclude(
                horario_catedra__comisiones__docente_id__in=docentes_ids, horario_catedra__comisiones__estado="LIC"
            )
            .exclude(horario_catedra__espacio__fecha_fin__lt=hoy)
        )

        if conflictos_docente.exists():
            conf = conflictos_docente.select_related("horario_catedra__espacio").first()
            return 409, ApiResponse(
                ok=False,
                message=f"Conflicto de docente: El docente asignado ya tiene clase en {conf.horario_catedra.espacio.nombre} ({conf.horario_catedra.espacio.plan_de_estudio.profesorado.nombre})",
            )

    detalle, _ = HorarioCatedraDetalle.objects.get_or_create(horario_catedra=hc, bloque=bloque)
    return detalle


@router.delete("/horarios_catedra_detalles/{detalle_id}", response={204: None}, auth=JWTAuth())
def delete_horario_detalle(request, detalle_id: int):
    detalle = get_object_or_404(HorarioCatedraDetalle, id=detalle_id)
    _ensure_structure_edit(request.user, detalle.horario_catedra.espacio.plan_de_estudio.profesorado_id)
    detalle.delete()
    return 204, None


@router.get("/horarios/ocupacion", response=list[BloqueOut], auth=JWTAuth())
def get_occupied_blocks(
    request, anio_cursada: int, turno_id: int, anio_academico: int | None = None, cuatrimestre: str | None = None
):
    _ensure_structure_view(request.user)

    # Resolver año académico por defecto si no viene
    if not anio_academico:
        anio_academico = timezone.now().year

    schedules = HorarioCatedra.objects.filter(
        anio_academico=anio_academico, turno_id=turno_id, espacio__anio_cursada=anio_cursada
    ).exclude(espacio__fecha_fin__lt=timezone.now().date())
    if cuatrimestre:
        schedules = schedules.filter(Q(cuatrimestre=Materia.TipoCursada.ANUAL) | Q(cuatrimestre=cuatrimestre))

    occupied_bloque_ids = (
        HorarioCatedraDetalle.objects.filter(horario_catedra__in=schedules)
        .values_list("bloque_id", flat=True)
        .distinct()
    )
    occupied_bloques = Bloque.objects.filter(id__in=occupied_bloque_ids).annotate(turno_nombre=F("turno__nombre"))
    return occupied_bloques
