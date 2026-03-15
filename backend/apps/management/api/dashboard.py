from datetime import date
from django.db.models import Count, Prefetch
from core.auth_ninja import JWTAuth
from core.models import (
    Docente, Comision, Profesorado, Preinscripcion, 
    HorarioCatedra, InscripcionMesa, MesaExamen, 
    Regularidad, VentanaHabilitacion, PedidoAnalitico,
    InscripcionMateriaEstudiante
)
from core.permissions import ensure_roles
from ..router import management_router
from ..schemas import (
    GlobalOverviewOut, DashboardDocente, DashboardCatedra, 
    DashboardProfesorado, DashboardPreinsEstado, DashboardPreinsDetalle,
    DashboardPreinscripciones, DashboardHorario, DashboardCambioComision,
    DashboardPedidoAnalitico, DashboardMesas, DashboardMesaTipo,
    DashboardRegularidad, DashboardVentana, VentanaOut, VentanaIn
)

GLOBAL_OVERVIEW_ROLES = {
    "admin", "secretaria", "bedel", "jefa_aaee", "jefes", 
    "tutor", "coordinador", "consulta",
}

@management_router.get("/overview", response=GlobalOverviewOut, auth=JWTAuth())
def global_overview(request):
    ensure_roles(request.user, GLOBAL_OVERVIEW_ROLES)

    # 1. Docentes
    docentes_qs = (
        Docente.objects.annotate(total_catedras=Count("comisiones", distinct=True))
        .filter(total_catedras__gt=0)
        .prefetch_related(
            Prefetch(
                "comisiones",
                queryset=Comision.objects.select_related(
                    "materia__plan_de_estudio__profesorado",
                    "turno",
                ).order_by("-anio_lectivo", "materia__nombre")[:5],
                to_attr="dashboard_comisiones",
            )
        )
        .order_by("-total_catedras", "apellido", "nombre")[:6]
    )

    docentes = []
    for d in docentes_qs:
        catedras = [
            DashboardCatedra(
                id=com.id,
                materia=com.materia.nombre,
                profesorado=com.materia.plan_de_estudio.profesorado.nombre if com.materia.plan_de_estudio_id else "",
                anio_lectivo=com.anio_lectivo,
                turno=com.turno.nombre if com.turno_id else None,
            )
            for com in getattr(d, "dashboard_comisiones", []) if com.materia
        ]
        docentes.append(DashboardDocente(
            id=d.id,
            nombre=f"{d.apellido}, {d.nombre}".strip(", "),
            documento=d.dni,
            total_catedras=d.total_catedras,
            catedras=catedras
        ))

    # 2. Profesorados
    prof_qs = Profesorado.objects.annotate(
        planes_total=Count("planes", distinct=True),
        materias_total=Count("planes__materias", distinct=True),
        correlativas_total=Count("planes__materias__correlativas_requeridas", distinct=True),
    ).order_by("nombre")
    profesorados = [DashboardProfesorado(id=p.id, nombre=p.nombre, planes=p.planes_total, materias=p.materias_total, correlativas=p.correlativas_total) for p in prof_qs]

    # 3. Preinscripciones
    pre_total = Preinscripcion.objects.count()
    estado_counts = [DashboardPreinsEstado(estado=r["estado"] or "Sin estado", total=r["total"]) for r in Preinscripcion.objects.values("estado").annotate(total=Count("id")).order_by("estado")]
    recientes_pre = [
        DashboardPreinsDetalle(
            id=pre.id, codigo=pre.codigo,
            estudiante=(pre.estudiante.user.get_full_name() if pre.estudiante.user_id else str(pre.estudiante.dni)),
            carrera=pre.carrera.nombre if pre.carrera_id else None,
            fecha=(pre.updated_at or pre.created_at).isoformat() if (pre.updated_at or pre.created_at) else None
        )
        for pre in Preinscripcion.objects.filter(estado="Confirmada").select_related("estudiante__user", "carrera").order_by("-updated_at")[:6]
    ]
    preinscripciones = DashboardPreinscripciones(total=pre_total, por_estado=estado_counts, recientes=recientes_pre)

    # 4. Horarios
    horarios = [
        DashboardHorario(
            profesorado_id=r["espacio__plan_de_estudio__profesorado__id"],
            profesorado=r["espacio__plan_de_estudio__profesorado__nombre"],
            anio_cursada=r["anio_cursada"],
            cantidad=r["total"]
        )
        for r in HorarioCatedra.objects.values("espacio__plan_de_estudio__profesorado__id", "espacio__plan_de_estudio__profesorado__nombre", "anio_cursada").annotate(total=Count("id")).order_by("espacio__plan_de_estudio__profesorado__nombre", "anio_cursada")
    ]

    # 5. Cambios Comision
    cambios = [
        DashboardCambioComision(
            id=c.id, estudiante=(c.estudiante.user.get_full_name() if c.estudiante.user_id else c.estudiante.dni),
            dni=c.estudiante.dni, materia=c.materia.nombre if c.materia else "",
            profesorado=c.materia.plan_de_estudio.profesorado.nombre if c.materia and c.materia.plan_de_estudio_id else None,
            comision_actual=f"{c.comision.codigo} ({c.comision.turno.nombre})" if c.comision_id and c.comision.turno_id else (c.comision.codigo if c.comision_id else None),
            comision_solicitada=f"{c.comision_solicitada.codigo} ({c.comision_solicitada.turno.nombre})" if c.comision_solicitada_id and c.comision_solicitada.turno_id else (c.comision_solicitada.codigo if c.comision_solicitada_id else None),
            estado=c.get_estado_display(),
            actualizado=(c.updated_at or c.created_at).isoformat() if (c.updated_at or c.created_at) else ""
        )
        for c in InscripcionMateriaEstudiante.objects.filter(comision_solicitada__isnull=False).select_related("estudiante__user", "materia__plan_de_estudio__profesorado", "comision__turno", "comision_solicitada__turno").order_by("-updated_at")[:10]
    ]

    # 6. Analiticos
    pedidos_analiticos = [
        DashboardPedidoAnalitico(
            id=p.id, estudiante=(p.estudiante.user.get_full_name() if p.estudiante.user_id else p.estudiante.dni),
            dni=p.estudiante.dni, fecha=p.created_at.isoformat(),
            motivo=p.get_motivo_display(), profesorado=p.profesorado.nombre if p.profesorado_id else None
        )
        for p in PedidoAnalitico.objects.select_related("estudiante__user", "profesorado").order_by("-created_at")[:10]
    ]

    # 7. Mesas
    insc_qs = InscripcionMesa.objects.filter(estado=InscripcionMesa.Estado.INSCRIPTO).values("mesa__tipo").annotate(total=Count("id"))
    mesas = DashboardMesas(
        total=sum(r["total"] for r in insc_qs),
        por_tipo=[DashboardMesaTipo(tipo=MesaExamen.Tipo(r["mesa__tipo"]).label, total=r["total"]) for r in insc_qs]
    )

    # 8. Regularidades
    regularidades = [
        DashboardRegularidad(
            id=reg.id, estudiante=(reg.estudiante.user.get_full_name() if reg.estudiante.user_id else reg.estudiante.dni),
            dni=reg.estudiante.dni, materia=reg.materia.nombre if reg.materia else "",
            profesorado=reg.materia.plan_de_estudio.profesorado.nombre if reg.materia and reg.materia.plan_de_estudio_id else None,
            situacion=reg.get_situacion_display(),
            nota=str(reg.nota_final_cursada or reg.nota_trabajos_practicos or ""),
            fecha=reg.fecha_cierre.isoformat()
        )
        for reg in Regularidad.objects.select_related("estudiante__user", "materia__plan_de_estudio__profesorado").order_by("-fecha_cierre")[:10]
    ]

    # 9. Ventanas
    today = date.today()
    ventanas = []
    for v in VentanaHabilitacion.objects.order_by("-desde")[:12]:
        estado = "Activa" if v.activo and v.desde <= today <= v.hasta else ("Pendiente" if v.desde > today else "Pasada")
        ventanas.append(DashboardVentana(
            id=v.id, tipo=v.get_tipo_display() if hasattr(v, "get_tipo_display") else v.tipo,
            desde=v.desde.isoformat(), hasta=v.hasta.isoformat(),
            activo=v.activo, estado=estado
        ))

    return GlobalOverviewOut(
        docentes=docentes, profesorados=profesorados, preinscripciones=preinscripciones,
        horarios=horarios, pedidos_comision=cambios, pedidos_analiticos=pedidos_analiticos,
        mesas=mesas, regularidades=regularidades, ventanas=ventanas
    )
