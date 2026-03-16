from datetime import date
from typing import Optional
from ninja import Router, Schema
from django.db.models import Count, Prefetch
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from core.models import (
    Docente, Comision, Profesorado, Preinscripcion, 
    HorarioCatedra, Materia, InscripcionMateriaEstudiante,
    Regularidad, MesaExamen, PedidoAnalitico, InscripcionMesa,
    VentanaHabilitacion
)
from core.auth_ninja import JWTAuth
from core.permissions import ensure_roles, GLOBAL_OVERVIEW_ROLES

router = Router(tags=["Dashboard"])

class DashboardCatedra(Schema):
    id: int
    materia: str
    profesorado: str
    anio_lectivo: int
    turno: Optional[str] = None

class DashboardDocente(Schema):
    id: int
    nombre: str
    documento: str
    total_catedras: int
    catedras: list[DashboardCatedra]

class DashboardProfesorado(Schema):
    id: int
    nombre: str
    planes: int
    materias: int
    correlativas: int

class DashboardPreinsEstado(Schema):
    estado: str
    total: int

class DashboardPreinsDetalle(Schema):
    id: int
    codigo: str
    estudiante: str
    carrera: Optional[str] = None
    fecha: Optional[str] = None

class DashboardPreinscripciones(Schema):
    total: int
    por_estado: list[DashboardPreinsEstado]
    recientes: list[DashboardPreinsDetalle]

class DashboardHorario(Schema):
    profesorado_id: int
    profesorado: str
    anio_cursada: int
    cantidad: int

class DashboardCambioComision(Schema):
    id: int
    estudiante: str
    dni: str
    materia: str
    profesorado: Optional[str] = None
    comision_actual: Optional[str] = None
    comision_solicitada: Optional[str] = None
    estado: str
    actualizado: str

class DashboardPedidoAnalitico(Schema):
    id: int
    estudiante: str
    dni: str
    fecha: str
    motivo: str
    profesorado: Optional[str] = None

class DashboardMesaTipo(Schema):
    tipo: str
    total: int

class DashboardMesas(Schema):
    total: int
    por_tipo: list[DashboardMesaTipo]

class DashboardRegularidad(Schema):
    id: int
    estudiante: str
    dni: str
    materia: str
    profesorado: Optional[str] = None
    situacion: str
    nota: Optional[str] = None
    fecha: str

class DashboardVentana(Schema):
    id: int
    tipo: str
    desde: str
    hasta: str
    activo: bool
    estado: str

class GlobalOverviewOut(Schema):
    docentes: list[DashboardDocente]
    profesorados: list[DashboardProfesorado]
    preinscripciones: DashboardPreinscripciones
    horarios: list[DashboardHorario]
    pedidos_comision: list[DashboardCambioComision]
    pedidos_analiticos: list[DashboardPedidoAnalitico]
    mesas: DashboardMesas
    regularidades: list[DashboardRegularidad]
    ventanas: list[DashboardVentana]

@router.get("/overview/global", response=GlobalOverviewOut, auth=JWTAuth())
def global_overview(request):
    ensure_roles(request.user, GLOBAL_OVERVIEW_ROLES)

    # 1. DOCENTES
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
        .order_by("-total_catedras", "persona__apellido", "persona__nombre")[:6]
    )

    docentes = []
    for docente in docentes_qs:
        catedras = []
        for com in getattr(docente, "dashboard_comisiones", []):
            materia = com.materia
            if not materia: continue
            prof = materia.plan_de_estudio.profesorado if materia.plan_de_estudio_id else None
            catedras.append(DashboardCatedra(
                id=com.id, materia=materia.nombre,
                profesorado=prof.nombre if prof else "",
                anio_lectivo=com.anio_lectivo, turno=com.turno.nombre if com.turno_id else None
            ))
        docentes.append(DashboardDocente(
            id=docente.id, nombre=f"{docente.apellido}, {docente.nombre}".strip(", "),
            documento=docente.dni, total_catedras=docente.total_catedras, catedras=catedras
        ))

    # 2. PROFESORADOS
    prof_qs = Profesorado.objects.annotate(
        planes_total=Count("planes", distinct=True),
        materias_total=Count("planes__materias", distinct=True),
        correlativas_total=Count("planes__materias__correlativas_requeridas", distinct=True),
    ).order_by("nombre")
    profesorados = [DashboardProfesorado(
        id=p.id, nombre=p.nombre, planes=p.planes_total,
        materias=p.materias_total, correlativas=p.correlativas_total
    ) for p in prof_qs]

    # 3. PREINSCRIPCIONES
    pre_total = Preinscripcion.objects.count()
    estado_counts = [
        DashboardPreinsEstado(estado=row["estado"] or "Sin estado", total=row["total"])
        for row in Preinscripcion.objects.values("estado").annotate(total=Count("id")).order_by("estado")
    ]
    recientes_pre = []
    for pre in Preinscripcion.objects.filter(estado="Confirmada").select_related("estudiante__user", "carrera").order_by("-updated_at")[:6]:
        user = getattr(pre.estudiante, "user", None)
        recientes_pre.append(DashboardPreinsDetalle(
            id=pre.id, codigo=pre.codigo,
            estudiante=user.get_full_name() if user else str(pre.estudiante.dni),
            carrera=pre.carrera.nombre if pre.carrera_id else None,
            fecha=(pre.updated_at or pre.created_at).isoformat() if (pre.updated_at or pre.created_at) else None
        ))
    preinscripciones = DashboardPreinscripciones(total=pre_total, por_estado=estado_counts, recientes=recientes_pre)

    # 4. HORARIOS
    horarios_data = HorarioCatedra.objects.values(
        "espacio__plan_de_estudio__profesorado__id", "espacio__plan_de_estudio__profesorado__nombre", "anio_cursada"
    ).annotate(total=Count("id")).order_by("espacio__plan_de_estudio__profesorado__nombre", "anio_cursada")
    horarios = [DashboardHorario(
        profesorado_id=row["espacio__plan_de_estudio__profesorado__id"],
        profesorado=row["espacio__plan_de_estudio__profesorado__nombre"],
        anio_cursada=row["anio_cursada"], cantidad=row["total"]
    ) for row in horarios_data]

    # 5. CAMBIOS DE COMISION
    cambios_qs = InscripcionMateriaEstudiante.objects.filter(comision_solicitada__isnull=False).select_related(
        "estudiante__user", "materia__plan_de_estudio__profesorado", "comision__turno", "comision_solicitada__turno"
    ).order_by("-updated_at")[:10]
    cambios = []
    for c in cambios_qs:
        user = getattr(c.estudiante, "user", None)
        prof = c.materia.plan_de_estudio.profesorado if c.materia and c.materia.plan_de_estudio_id else None
        c_act = f"{c.comision.codigo} ({c.comision.turno.nombre})" if c.comision_id and c.comision.turno_id else (c.comision.codigo if c.comision_id else None)
        c_sol = f"{c.comision_solicitada.codigo} ({c.comision_solicitada.turno.nombre})" if c.comision_solicitada_id and c.comision_solicitada.turno_id else (c.comision_solicitada.codigo if c.comision_solicitada_id else None)
        cambios.append(DashboardCambioComision(
            id=c.id, estudiante=user.get_full_name() if user else c.estudiante.dni,
            dni=c.estudiante.dni, materia=c.materia.nombre if c.materia else "",
            profesorado=prof.nombre if prof else None,
            comision_actual=c_act, comision_solicitada=c_sol,
            estado=c.get_estado_display(),
            actualizado=(c.updated_at or c.created_at).isoformat() if (c.updated_at or c.created_at) else ""
        ))

    # 6. PEDIDOS ANALITICOS
    pedidos_qs = PedidoAnalitico.objects.select_related("estudiante__user", "profesorado").order_by("-created_at")[:10]
    pedidos_analiticos = [DashboardPedidoAnalitico(
        id=p.id, estudiante=p.estudiante.user.get_full_name() if p.estudiante.user_id else p.estudiante.dni,
        dni=p.estudiante.dni, fecha=p.created_at.isoformat(), motivo=p.get_motivo_display(),
        profesorado=p.profesorado.nombre if p.profesorado_id else None
    ) for p in pedidos_qs]

    # 7. MESAS
    mesas_data = InscripcionMesa.objects.filter(estado=InscripcionMesa.Estado.INSCRIPTO).values("mesa__tipo").annotate(total=Count("id"))
    mesas = DashboardMesas(
        total=sum(r["total"] for r in mesas_data),
        por_tipo=[DashboardMesaTipo(tipo=MesaExamen.Tipo(r["mesa__tipo"]).label, total=r["total"]) for r in mesas_data]
    )

    # 8. REGULARIDADES
    regs_qs = Regularidad.objects.select_related("estudiante__user", "materia__plan_de_estudio__profesorado").order_by("-fecha_cierre")[:10]
    regularidades = []
    for reg in regs_qs:
        user = getattr(reg.estudiante, "user", None)
        prof = reg.materia.plan_de_estudio.profesorado if reg.materia and reg.materia.plan_de_estudio_id else None
        nota = str(reg.nota_final_cursada) if reg.nota_final_cursada is not None else (str(reg.nota_trabajos_practicos) if reg.nota_trabajos_practicos is not None else None)
        regularidades.append(DashboardRegularidad(
            id=reg.id, estudiante=user.get_full_name() if user else reg.estudiante.dni,
            dni=reg.estudiante.dni, materia=reg.materia.nombre if reg.materia else "",
            profesorado=prof.nombre if prof else None, situacion=reg.get_situacion_display(),
            nota=nota, fecha=reg.fecha_cierre.isoformat()
        ))

    # 9. VENTANAS
    today = date.today()
    ventanas = []
    for v in VentanaHabilitacion.objects.order_by("-desde")[:12]:
        estado = "Activa" if (v.activo and v.desde <= today <= v.hasta) else ("Pendiente" if v.desde > today else "Pasada")
        ventanas.append(DashboardVentana(
            id=v.id, tipo=v.get_tipo_display() if hasattr(v, "get_tipo_display") else v.tipo,
            desde=v.desde.isoformat(), hasta=v.hasta.isoformat(), activo=v.activo, estado=estado
        ))

    return GlobalOverviewOut(
        docentes=docentes, profesorados=profesorados, preinscripciones=preinscripciones,
        horarios=horarios, pedidos_comision=cambios, pedidos_analiticos=pedidos_analiticos,
        mesas=mesas, regularidades=regularidades, ventanas=ventanas
    )
