"""
API de Administración Centralizada de Estudiantes y Legajos.
Gestiona el ciclo de vida administrativo del alumno: desde la supervisión de
documentación física (DNI, Títulos) hasta la auditoría de legajos y
la baja administrativa bajo estrictas reglas de integridad académica.
"""

from __future__ import annotations

from apps.common.api_schemas import ApiResponse
from core.models import (
    EquivalenciaDisposicionDetalle,
    ProrrogaTituloSecundario,
    Regularidad,
    ResidenciaCondicional,
)
from core.permissions import ensure_roles

from .router import estudiantes_router as router


@router.get(
    "/admin/prorrogas-titulo/alertas",
    response={200: list[dict], 403: ApiResponse},
)
def admin_alertas_prorrogas_titulo(
    request,
    dias_aviso: int = 30,
    carrera_id: int | None = None,
):
    """
    Lista prórrogas vencidas o próximas a vencer (dentro de `dias_aviso` días).
    Usar desde el dashboard de secretaría para anticipar cierres masivos erróneos.
    """
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    from datetime import timedelta

    from django.utils import timezone as tz

    hoy = tz.localdate()
    limite = hoy + timedelta(days=dias_aviso)

    qs = ProrrogaTituloSecundario.objects.filter(
        fecha_vencimiento__lte=limite,
    ).select_related("estudiante__persona", "autorizado_por")

    if carrera_id:
        qs = qs.filter(estudiante__carreras__id=carrera_id)

    resultado = []
    for p in qs.order_by("fecha_vencimiento"):
        dias = (p.fecha_vencimiento - hoy).days
        resultado.append(
            {
                "prorroga_id": p.id,
                "dni": p.estudiante.persona.dni if p.estudiante.persona else None,
                "nombre": p.estudiante.persona.apellido_nombre if p.estudiante.persona else str(p.estudiante),
                "fecha_vencimiento": str(p.fecha_vencimiento),
                "dias_restantes": dias,
                "vencida": dias < 0,
                "autorizado_por": p.autorizado_por.get_full_name() if p.autorizado_por else None,
            }
        )
    return 200, resultado


@router.get(
    "/admin/resguardo-correlativas",
    response={200: list[dict], 403: ApiResponse},
)
def admin_resguardo_correlativas(
    request,
    carrera_id: int | None = None,
    solo_activos: bool = True,
):
    """
    Lista estudiantes que tienen materias en resguardo por correlativas faltantes.
    Incluye tanto Regularidades como Equivalencias con en_resguardo=True.
    Usar desde el dashboard de secretaría/bedelía para seguimiento.
    """
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    resultado_map: dict[int, dict] = {}

    # --- Regularidades en resguardo ---
    regs_qs = Regularidad.objects.filter(
        en_resguardo=True,
        situacion__in=[
            Regularidad.Situacion.REGULAR,
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ],
    ).select_related("estudiante__persona", "materia")

    if carrera_id:
        regs_qs = regs_qs.filter(estudiante__carreras__id=carrera_id)

    for reg in regs_qs:
        est = reg.estudiante
        est_id = est.id
        if est_id not in resultado_map:
            resultado_map[est_id] = {
                "estudiante_id": est_id,
                "dni": est.persona.dni if est.persona else None,
                "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona else str(est_id),
                "estado_legajo": est.estado_legajo,
                "materias_en_resguardo": [],
            }
        resultado_map[est_id]["materias_en_resguardo"].append(
            {
                "materia_id": reg.materia_id,
                "materia_nombre": reg.materia.nombre,
                "situacion": reg.situacion,
                "situacion_display": reg.get_situacion_display(),
                "fuente": "cursada",
                "fecha": str(reg.fecha_cierre) if reg.fecha_cierre else None,
            }
        )

    # --- Equivalencias en resguardo ---
    equis_qs = EquivalenciaDisposicionDetalle.objects.filter(
        en_resguardo=True,
    ).select_related("disposicion__estudiante__persona", "materia", "disposicion")

    if carrera_id:
        equis_qs = equis_qs.filter(disposicion__estudiante__carreras__id=carrera_id)

    for eq in equis_qs:
        est = eq.disposicion.estudiante
        est_id = est.id
        if est_id not in resultado_map:
            resultado_map[est_id] = {
                "estudiante_id": est_id,
                "dni": est.persona.dni if est.persona else None,
                "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona else str(est_id),
                "estado_legajo": est.estado_legajo,
                "materias_en_resguardo": [],
            }
        resultado_map[est_id]["materias_en_resguardo"].append(
            {
                "materia_id": eq.materia_id,
                "materia_nombre": eq.materia.nombre,
                "situacion": "EQUIV",
                "situacion_display": "Equivalencia",
                "fuente": "equivalencia",
                "fecha": str(eq.disposicion.fecha_disposicion),
            }
        )

    resultado = sorted(resultado_map.values(), key=lambda x: x["nombre"])
    return 200, resultado


@router.get("/admin/residencias-condicionales")
def admin_residencias_condicionales(
    request,
    ciclo: int | None = None,
    carrera_id: int | None = None,
    solo_pendientes: bool = True,
):
    """
    Alerta administrativa: lista de estudiantes con inscripción condicional a Residencia.
    Permite a secretaría/bedelía hacer seguimiento de quiénes deben aprobar en mayo.

    Filtros:
    - ciclo: año lectivo (por defecto: año actual)
    - carrera_id: filtrar por profesorado
    - solo_pendientes: True = solo las no resueltas ni caídas (default)
    """
    from datetime import date

    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    ciclo = ciclo or date.today().year
    qs = (
        ResidenciaCondicional.objects.filter(
            ciclo_lectivo=ciclo,
        )
        .select_related(
            "estudiante__persona",
            "materia_residencia__plan_de_estudio__profesorado",
            "materia_pendiente",
        )
        .order_by("estudiante__persona__apellido")
    )

    if solo_pendientes:
        qs = qs.filter(resuelta=False, caida=False)

    if carrera_id:
        qs = qs.filter(materia_residencia__plan_de_estudio__profesorado_id=carrera_id)

    resultado = []
    for rc in qs:
        est = rc.estudiante
        profesorado = (
            getattr(getattr(rc.materia_residencia.plan_de_estudio, "profesorado", None), "nombre", None)
            if rc.materia_residencia.plan_de_estudio_id
            else None
        )

        if rc.resuelta:
            estado = "RESUELTA"
        elif rc.caida:
            estado = "CAÍDA"
        else:
            estado = "PENDIENTE"

        resultado.append(
            {
                "id": rc.id,
                "ciclo_lectivo": rc.ciclo_lectivo,
                "dni": est.persona.dni if est.persona_id else None,
                "nombre": f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est),
                "profesorado": profesorado,
                "materia_residencia": rc.materia_residencia.nombre,
                "materia_pendiente": rc.materia_pendiente.nombre,
                "fecha_limite": str(rc.fecha_limite),
                "aceptada_en": rc.aceptada_en.strftime("%d/%m/%Y %H:%M"),
                "estado": estado,
            }
        )

    return 200, resultado
