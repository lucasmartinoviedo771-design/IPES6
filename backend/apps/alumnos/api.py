from ninja import Router
from core.auth_ninja import JWTAuth
from .schemas import (
    InscripcionCarreraIn, InscripcionCarreraOut,
    InscripcionMateriaIn, InscripcionMateriaOut,
    CancelarInscripcionIn,
    CambioComisionIn, CambioComisionOut,
    PedidoAnaliticoOut, PedidoAnaliticoIn, PedidoAnaliticoItem,
    MateriaPlan, HistorialAlumno, Horario, EquivalenciaItem,
    MateriaInscriptaItem, ComisionResumen,
    InscripcionMesaIn, InscripcionMesaOut, MesaExamenIn, MesaExamenOut,
    RegularidadImportIn, RegularidadItemOut,
)
from core.models import (
    Estudiante, PlanDeEstudio, Materia, Comision, Correlatividad, HorarioCatedra,
    HorarioCatedraDetalle, Bloque, EquivalenciaCurricular, VentanaHabilitacion,
    PedidoAnalitico, MesaExamen, InscripcionMesa, Regularidad,
    Preinscripcion, PreinscripcionChecklist, Profesorado, InscripcionMateriaAlumno,
)
from core.permissions import ensure_roles
from django.db.models import Max
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.utils import timezone

from apps.common.api_schemas import ApiResponse

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

alumnos_router = Router(tags=["alumnos"], auth=JWTAuth())

def _resolve_estudiante(request, dni: str | None = None) -> Estudiante | None:
    """Intenta resolver el estudiante a partir del DNI o del usuario autenticado."""
    if dni:
        return Estudiante.objects.filter(dni=dni).first()
    if isinstance(request.user, AnonymousUser):
        return None
    return getattr(request.user, "estudiante", None)

def _comision_to_resumen(comision: Comision | None) -> ComisionResumen | None:
    if not comision:
        return None
    materia = comision.materia
    plan = materia.plan_de_estudio
    profesorado = plan.profesorado if plan else None
    horarios: list[Horario] = []
    if comision.horario_id:
        detalles = (
            HorarioCatedraDetalle.objects
            .filter(horario_catedra_id=comision.horario_id)
            .select_related('bloque')
            .order_by('bloque__dia', 'bloque__hora_desde')
        )
        horarios = [
            Horario(
                dia=det.bloque.get_dia_display(),
                desde=str(det.bloque.hora_desde)[:5],
                hasta=str(det.bloque.hora_hasta)[:5],
            )
            for det in detalles
        ]
    docente_nombre = None
    if comision.docente_id:
        docente_nombre = comision.docente.get_full_name()
    return ComisionResumen(
        id=comision.id,
        codigo=comision.codigo,
        anio_lectivo=comision.anio_lectivo,
        turno_id=comision.turno_id,
        turno=comision.turno.nombre,
        materia_id=materia.id,
        materia_nombre=materia.nombre,
        plan_id=plan.id if plan else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado_nombre=profesorado.nombre if profesorado else None,
        docente=docente_nombre,
        cupo_maximo=comision.cupo_maximo,
        estado=comision.estado,
        horarios=horarios,
    )


def _horarios_de_materia(materia: Materia) -> list[Horario]:
    detalles = (
        HorarioCatedraDetalle.objects
        .filter(horario_catedra__espacio=materia)
        .select_related('bloque')
        .order_by('bloque__dia', 'bloque__hora_desde')
    )
    return [
        Horario(
            dia=det.bloque.get_dia_display(),
            desde=str(det.bloque.hora_desde)[:5],
            hasta=str(det.bloque.hora_hasta)[:5],
        )
        for det in detalles
    ]

@alumnos_router.post(
    "/inscripcion-materia",
    response={200: InscripcionMateriaOut, 400: ApiResponse, 404: ApiResponse},
)
def inscripcion_materia(request, payload: InscripcionMateriaIn):
    from datetime import datetime
    est = _resolve_estudiante(request, getattr(payload, "dni", None))
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante (inicie sesión)")
    if getattr(payload, "dni", None):
        user_est = getattr(getattr(request, "user", None), "estudiante", None) if getattr(request, "user", None) and request.user.is_authenticated else None
        if not user_est or user_est.id != est.id:
            ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    mat = Materia.objects.filter(id=payload.materia_id).first()
    if not mat:
        return 404, ApiResponse(ok=False, message="Materia no encontrada")

    anio_actual = datetime.now().year

    # Correlatividades para cursar
    req_reg = list(Correlatividad.objects.filter(materia_origen=mat, tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR).values_list('materia_correlativa_id', flat=True))
    req_apr = list(Correlatividad.objects.filter(materia_origen=mat, tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR).values_list('materia_correlativa_id', flat=True))

    def ultima_situacion(mid: int):
        r = Regularidad.objects.filter(estudiante=est, materia_id=mid).order_by('-fecha_cierre').first()
        return r.situacion if r else None

    faltan = []
    for mid in req_reg:
        s = ultima_situacion(mid)
        if s not in (Regularidad.Situacion.REGULAR, Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Regular en {m.nombre if m else mid}")
    for mid in req_apr:
        s = ultima_situacion(mid)
        if s not in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            m = Materia.objects.filter(id=mid).first()
            faltan.append(f"Aprobada {m.nombre if m else mid}")
    if faltan:
        return 400, ApiResponse(ok=False, message="Correlatividades no cumplidas para cursar", data={"faltantes": faltan})

    # Superposición horaria
    detalles_cand = (HorarioCatedraDetalle.objects
                     .select_related('horario_catedra__turno','bloque')
                     .filter(horario_catedra__espacio=mat))
    cand = [(d.horario_catedra.turno_id, d.bloque.dia, d.bloque.hora_desde, d.bloque.hora_hasta) for d in detalles_cand]
    if cand:
        actuales = InscripcionMateriaAlumno.objects.filter(estudiante=est, anio=anio_actual)
        if actuales.exists():
            det_act = (HorarioCatedraDetalle.objects
                       .select_related('horario_catedra__turno','bloque')
                       .filter(horario_catedra__espacio_id__in=list(actuales.values_list('materia_id', flat=True))))
            for d in det_act:
                for (t, dia, desde, hasta) in cand:
                    if t == d.horario_catedra.turno_id and dia == d.bloque.dia:
                        if not (hasta <= d.bloque.hora_desde or desde >= d.bloque.hora_hasta):
                            return 400, ApiResponse(ok=False, message="Superposición horaria con otra materia inscripta")

    InscripcionMateriaAlumno.objects.get_or_create(estudiante=est, materia=mat, anio=anio_actual)
    return {"message": "Inscripción a materia registrada"}
@alumnos_router.get(
    "/materias-inscriptas",
    response={200: list[MateriaInscriptaItem], 400: ApiResponse},
)
def materias_inscriptas(request, anio: int | None = None, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    qs = (
        InscripcionMateriaAlumno.objects
        .filter(estudiante=est)
        .select_related(
            'materia__plan_de_estudio__profesorado',
            'comision__turno', 'comision__docente', 'comision__horario',
            'comision_solicitada__turno', 'comision_solicitada__docente', 'comision_solicitada__horario',
        )
        .order_by('-anio', '-created_at')
    )
    if anio:
        qs = qs.filter(anio=anio)

    items: list[MateriaInscriptaItem] = []
    for ins in qs:
        materia = ins.materia
        plan = materia.plan_de_estudio
        profesorado = plan.profesorado if plan else None
        # Si la inscripción todavía no fue asignada a una comisión definitiva,
        # reutilizamos la comisión solicitada para exponer los horarios y así
        # poder detectar superposiciones desde el frontend.
        comision_visible = ins.comision or ins.comision_solicitada
        items.append(
            MateriaInscriptaItem(
                inscripcion_id=ins.id,
                materia_id=materia.id,
                materia_nombre=materia.nombre,
                plan_id=plan.id if plan else None,
                profesorado_id=profesorado.id if profesorado else None,
                profesorado_nombre=profesorado.nombre if profesorado else None,
                anio_plan=materia.anio_cursada,
                anio_academico=ins.anio,
                estado=ins.estado,
                estado_display=ins.get_estado_display(),
                comision_actual=_comision_to_resumen(comision_visible),
                comision_solicitada=_comision_to_resumen(ins.comision_solicitada),
                fecha_creacion=(ins.created_at or timezone.now()).isoformat(),
                fecha_actualizacion=(ins.updated_at or ins.created_at or timezone.now()).isoformat(),
            )
        )
    return items


@alumnos_router.post(
    "/inscripcion-materia/{inscripcion_id}/cancelar",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def cancelar_inscripcion_materia(request, inscripcion_id: int, payload: CancelarInscripcionIn):
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, ApiResponse(ok=False, message="No se encontró el estudiante.")

    inscripcion = (
        InscripcionMateriaAlumno.objects
        .filter(id=inscripcion_id, estudiante=est)
        .select_related('materia', 'comision')
        .first()
    )
    if not inscripcion:
        return 404, ApiResponse(ok=False, message="Inscripción no encontrada.")

    if inscripcion.estado not in (
        InscripcionMateriaAlumno.Estado.CONFIRMADA,
        InscripcionMateriaAlumno.Estado.PENDIENTE,
    ):
        return 400, ApiResponse(ok=False, message="Solo se pueden cancelar inscripciones confirmadas o pendientes.")

    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    inscripcion.estado = InscripcionMateriaAlumno.Estado.ANULADA
    inscripcion.comision = None
    inscripcion.comision_solicitada = None
    inscripcion.save(update_fields=['estado', 'comision', 'comision_solicitada', 'updated_at'])

    return ApiResponse(ok=True, message="Inscripción cancelada exitosamente.")


@alumnos_router.post("/cambio-comision", response=CambioComisionOut)
def cambio_comision(request, payload: CambioComisionIn):
    # Placeholder logic
    return {"message": "Solicitud de cambio de comisión recibida."}

@alumnos_router.get("/pedido_analitico", response=PedidoAnaliticoOut)
def pedido_analitico(request):
    # Placeholder logic
    return {"message": "Solicitud de pedido de analítico recibida."}

@alumnos_router.post("/mesa-examen", response=MesaExamenOut)
def mesa_examen(request, payload: MesaExamenIn):
    # Placeholder logic
    return {"message": "Solicitud de mesa de examen recibida."}

# Listar mesas disponibles para alumno (por ventana/tipo)
@alumnos_router.get('/mesas', response=list[dict])
def listar_mesas_alumno(request, tipo: str | None = None, ventana_id: int | None = None, dni: str | None = None, solo_rendibles: bool = False):
    qs = MesaExamen.objects.select_related('materia').all()
    if tipo:
        qs = qs.filter(tipo=tipo)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    out = []
    est = None
    if solo_rendibles:
        if dni:
            est = Estudiante.objects.filter(dni=dni).first()
        elif not isinstance(request.user, AnonymousUser):
            est = getattr(request.user, 'estudiante', None)
    for m in qs.order_by('fecha','hora_desde'):
        # correlativas que requieren estar APROBADAS PARA RENDIR FINAL
        req_aprob = list(Correlatividad.objects.filter(
            materia_origen=m.materia,
            tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR
        ).values_list('materia_correlativa_id', flat=True))
        row = {
            'id': m.id,
            'materia': {'id': m.materia_id, 'nombre': m.materia.nombre, 'anio': m.materia.anio_cursada},
            'tipo': m.tipo,
            'fecha': m.fecha.isoformat(),
            'hora_desde': str(m.hora_desde) if m.hora_desde else None,
            'hora_hasta': str(m.hora_hasta) if m.hora_hasta else None,
            'aula': m.aula,
            'cupo': m.cupo,
            'correlativas_aprob': req_aprob,
        }
        if not solo_rendibles or not est:
            out.append(row)
            continue
        if m.tipo == MesaExamen.Tipo.FINAL:
            legajo_ok = (est.estado_legajo == Estudiante.EstadoLegajo.COMPLETO)
            if not legajo_ok:
                prof = m.materia.plan_de_estudio.profesorado if m.materia and m.materia.plan_de_estudio else None
                pre = (Preinscripcion.objects.filter(alumno=est, carrera=prof).order_by('-anio', '-id').first()) if prof else None
                cl = getattr(pre, 'checklist', None) if pre else None
                if not (cl and cl.certificado_titulo_en_tramite):
                    continue
            reg = (Regularidad.objects.filter(estudiante=est, materia=m.materia).order_by('-fecha_cierre').first())
            if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                continue
            from datetime import date
            def _add_years(d: date, years: int) -> date:
                try:
                    return d.replace(year=d.year + years)
                except ValueError:
                    return d.replace(month=2, day=28, year=d.year + years)
            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = (MesaExamen.objects.filter(materia=m.materia, tipo=MesaExamen.Tipo.FINAL, fecha__gte=two_years).order_by('fecha').values_list('fecha', flat=True).first())
            allowed_until = next_call or two_years
            if m.fecha > allowed_until:
                continue
            if req_aprob:
                regs = (Regularidad.objects.filter(estudiante=est, materia_id__in=req_aprob).order_by('materia_id', '-fecha_cierre'))
                latest = {}
                for r in regs:
                    latest.setdefault(r.materia_id, r)
                ok = True
                for mid in req_aprob:
                    r = latest.get(mid)
                    if not r or r.situacion not in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                        ok = False; break
                if not ok:
                    continue
        out.append(row)
    return out

# Inscripción a mesa (alumno o por DNI para roles)
@alumnos_router.post('/inscribir_mesa', response=InscripcionMesaOut)
def inscribir_mesa(request, payload: InscripcionMesaIn):
    mesa = (
        MesaExamen.objects
        .filter(id=payload.mesa_id)
        .select_related('materia__plan_de_estudio__profesorado')
        .first()
    )
    if not mesa:
        return 404, {"message": "Mesa no encontrada"}
    # Resolver estudiante
    est = None
    if payload.dni:
        est = Estudiante.objects.filter(dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, 'estudiante', None)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}
    # Cupo
    if mesa.cupo and mesa.inscripciones.filter(estado=InscripcionMesa.Estado.INSCRIPTO).count() >= mesa.cupo:
        return 400, {"message": "Cupo completo"}

    # Validaciones para Finales
    if mesa.tipo == MesaExamen.Tipo.FINAL:
        # 1) Legajo completo o excepción por 'Título en trámite'
        if est.estado_legajo != Estudiante.EstadoLegajo.COMPLETO:
            prof = mesa.materia.plan_de_estudio.profesorado if mesa.materia and mesa.materia.plan_de_estudio else None
            pre = None
            if prof:
                pre = (Preinscripcion.objects
                       .filter(alumno=est, carrera=prof)
                       .order_by('-anio', '-id').first())
            cl = getattr(pre, 'checklist', None) if pre else None
            if not (cl and cl.certificado_titulo_en_tramite):
                return 400, {"message": "Legajo condicional/pending: no puede rendir Final (salvo 'Título en trámite')."}

        # 2) Regularidad vigente en la materia
        reg = (Regularidad.objects
               .filter(estudiante=est, materia=mesa.materia)
               .order_by('-fecha_cierre')
               .first())
        if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
            if reg and reg.situacion == Regularidad.Situacion.PROMOCIONADO:
                return 400, {"message": "Materia promocionada: no requiere final."}
            return 400, {"message": "No posee regularidad vigente en la materia."}

        # 2.b) Vigencia: 2 años y el siguiente llamado posterior
        from datetime import date
        def _add_years(d: date, years: int) -> date:
            try:
                return d.replace(year=d.year + years)
            except ValueError:
                # Ajuste para 29/02 → 28/02 en años no bisiestos
                return d.replace(month=2, day=28, year=d.year + years)

        two_years = _add_years(reg.fecha_cierre, 2)
        next_call = (MesaExamen.objects
                     .filter(materia=mesa.materia,
                             tipo=MesaExamen.Tipo.FINAL,
                             fecha__gte=two_years)
                     .order_by('fecha')
                     .values_list('fecha', flat=True)
                     .first())
        allowed_until = next_call or two_years
        if mesa.fecha > allowed_until:
            return 400, {"message": "Venció la vigencia de regularidad (2 años y un llamado). Debe recursar."}

        intentos = (InscripcionMesa.objects
                    .filter(
                        estudiante=est,
                        estado=InscripcionMesa.Estado.INSCRIPTO,
                        mesa__materia=mesa.materia,
                        mesa__tipo=MesaExamen.Tipo.FINAL,
                        mesa__fecha__gte=reg.fecha_cierre,
                        mesa__fecha__lte=allowed_until,
                    )
                    .count())
        if intentos >= 3:
            return 400, {"message": "Ya usaste 3 llamados de final dentro de la vigencia. Debe recursar."}

        # 3) Correlatividades APR (aprobadas o promocionadas)
        req_ids = list(
            Correlatividad.objects
            .filter(materia_origen=mesa.materia, tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR)
            .values_list('materia_correlativa_id', flat=True)
        )
        if req_ids:
            faltan = []
            regs = (
                Regularidad.objects
                .filter(estudiante=est, materia_id__in=req_ids)
                .order_by('materia_id', '-fecha_cierre')
            )
            latest: dict[int, Regularidad] = {}
            for r in regs:
                latest.setdefault(r.materia_id, r)
            for mid in req_ids:
                r = latest.get(mid)
                if not r or r.situacion not in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                    m = Materia.objects.filter(id=mid).first()
                    faltan.append(m.nombre if m else f"Materia {mid}")
            if faltan:
                return 400, {"message": "Correlativas sin aprobar para rendir final", "faltantes": faltan}
    ins, created = InscripcionMesa.objects.get_or_create(mesa=mesa, estudiante=est)
    if not created and ins.estado == InscripcionMesa.Estado.INSCRIPTO:
        return 400, {"message": "Ya estabas inscripto"}
    ins.estado = InscripcionMesa.Estado.INSCRIPTO
    ins.save()
    return {"message": "Inscripción registrada"}

# Nuevos endpoints
@alumnos_router.get("/materias-plan", response=list[MateriaPlan])
def materias_plan(request, profesorado_id: int | None = None, plan_id: int | None = None, dni: str | None = None):
    """Devuelve las materias del plan vigente del alumno (o del profesorado/plan indicado).

    Estrategia:
      - Si se pasa plan_id: usa ese plan.
      - Sino, si se pasa profesorado_id: busca el plan vigente de ese profesorado.
      - Sino, intenta inferir el profesorado a partir del Estudiante (request.user.estudiante) y toma su plan vigente.
    """
    # Resolver plan
    plan: PlanDeEstudio | None = None
    if plan_id:
        try:
            plan = PlanDeEstudio.objects.get(id=plan_id)
        except PlanDeEstudio.DoesNotExist:
            plan = None
    elif profesorado_id:
        plan = PlanDeEstudio.objects.filter(profesorado_id=profesorado_id, vigente=True).order_by('-anio_inicio').first()
    else:
        # Por DNI explícito o inferir desde el usuario
        prof = None
        if dni:
            try:
                est = Estudiante.objects.get(dni=dni)
                prof = est.carreras.order_by('nombre').first()
            except Estudiante.DoesNotExist:
                prof = None
        elif not isinstance(request.user, AnonymousUser):
            try:
                est: Estudiante = request.user.estudiante  # type: ignore
                prof = est.carreras.order_by('nombre').first()
            except Exception:
                prof = None
        if prof:
            plan = PlanDeEstudio.objects.filter(profesorado=prof, vigente=True).order_by('-anio_inicio').first()
    if not plan:
        # Fallback: tomar cualquier plan vigente para demo/admin
        plan = PlanDeEstudio.objects.filter(vigente=True).order_by('-anio_inicio').first()
        if not plan:
            return []

    # Helper: map regimen -> cuatrimestre label
    def map_cuat(regimen: str) -> str:
        return 'ANUAL' if regimen == Materia.TipoCursada.ANUAL else ('1C' if regimen == Materia.TipoCursada.PRIMER_CUATRIMESTRE else '2C')

    # Horarios por materia (último año disponible, consolidado por bloque)
    def horarios_para(m: Materia) -> list[Horario]:
        hcs = (HorarioCatedra.objects
               .filter(espacio=m)
               .annotate(max_anio=Max('anio_cursada'))
               .order_by('-anio_cursada'))
        if not hcs:
            return []
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__in=hcs[:1]).select_related('bloque', 'horario_catedra')
        hs: list[Horario] = []
        for d in detalles:
            b: Bloque = d.bloque
            hs.append(Horario(dia=b.get_dia_display(), desde=str(b.hora_desde)[:5], hasta=str(b.hora_hasta)[:5]))
        # Ordenar por día/hora
        return sorted(hs, key=lambda x: (x.dia, x.desde))

    # Correlatividades por tipo
    def correlativas_ids(m: Materia, tipo: str) -> list[int]:
        return list(Correlatividad.objects.filter(materia_origen=m, tipo=tipo).values_list('materia_correlativa_id', flat=True))

    materias = []
    for m in plan.materias.all().order_by('anio_cursada', 'nombre'):
        materias.append(MateriaPlan(
            id=m.id,
            nombre=m.nombre,
            anio=m.anio_cursada,
            cuatrimestre=map_cuat(m.regimen),
            horarios=horarios_para(m),
            correlativas_regular=correlativas_ids(m, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR),
            correlativas_aprob=correlativas_ids(m, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR),
            profesorado=plan.profesorado.nombre,
        ))
    return materias

@alumnos_router.get("/historial", response=HistorialAlumno)
def historial_alumno(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return HistorialAlumno(aprobadas=[], regularizadas=[], inscriptas_actuales=[])

    aprobadas = list(
        Regularidad.objects
        .filter(estudiante=est, situacion__in=[Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO])
        .values_list('materia_id', flat=True)
    )
    regularizadas = list(
        Regularidad.objects
        .filter(estudiante=est, situacion=Regularidad.Situacion.REGULAR)
        .values_list('materia_id', flat=True)
    )
    inscriptas_actuales = list(
        InscripcionMateriaAlumno.objects
        .filter(
            estudiante=est,
            estado__in=[InscripcionMateriaAlumno.Estado.CONFIRMADA, InscripcionMateriaAlumno.Estado.PENDIENTE]
        )
        .values_list('materia_id', flat=True)
    )

    return HistorialAlumno(
        aprobadas=aprobadas,
        regularizadas=regularizadas,
        inscriptas_actuales=inscriptas_actuales,
    )



@alumnos_router.get("/equivalencias", response=list[EquivalenciaItem])
def equivalencias_para_materia(request, materia_id: int):
    """Devuelve materias equivalentes (otros profesorados) para la materia indicada.

    Requiere que exista un registro de EquivalenciaCurricular que relacione la materia con sus equivalentes.
    """
    try:
        m = Materia.objects.get(id=materia_id)
    except Materia.DoesNotExist:
        return []
    grupos = EquivalenciaCurricular.objects.filter(materias=m)
    if not grupos.exists():
        # fallback por nombre exacto (no recomendado, pero útil mientras se cargan equivalencias)
        candidates = Materia.objects.filter(nombre__iexact=m.nombre).exclude(id=m.id)
        items: list[EquivalenciaItem] = []
        for mm in candidates:
            # Horarios simplificados
            detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mm).select_related('bloque', 'horario_catedra')
            hs = [Horario(dia=d.bloque.get_dia_display(), desde=str(d.bloque.hora_desde)[:5], hasta=str(d.bloque.hora_hasta)[:5]) for d in detalles]
            items.append(EquivalenciaItem(materia_id=mm.id, materia_nombre=mm.nombre, profesorado=mm.plan_de_estudio.profesorado.nombre, horarios=hs))
        return items
    # Usar equivalencias cargadas
    eq = grupos.first()
    items: list[EquivalenciaItem] = []
    for mm in eq.materias.exclude(id=m.id):
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mm).select_related('bloque', 'horario_catedra')
        hs = [Horario(dia=d.bloque.get_dia_display(), desde=str(d.bloque.hora_desde)[:5], hasta=str(d.bloque.hora_hasta)[:5]) for d in detalles]
        items.append(EquivalenciaItem(materia_id=mm.id, materia_nombre=mm.nombre, profesorado=mm.plan_de_estudio.profesorado.nombre, horarios=hs))
    return items


def _formatear_rango_ventana(ventana, ventana_id: int) -> str:
    if not ventana:
        return f'Ventana ID: {ventana_id}'
    rango = f"{ventana.desde.strftime('%d/%m/%Y')} - {ventana.hasta.strftime('%d/%m/%Y')}"
    etiqueta = " (Activo)" if ventana.activo else ""
    return f"Ventana: {rango}{etiqueta}"

@alumnos_router.get("/analiticos/pdf")
def analiticos_pdf(request, ventana_id: int):
    qs = PedidoAnalitico.objects.select_related('estudiante__user','profesorado','ventana').filter(ventana_id=ventana_id).order_by('-created_at')
    ventana = VentanaHabilitacion.objects.filter(id=ventana_id).first()
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="analiticos_{ventana_id}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=24, leftMargin=24, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph('Pedidos de Analitico', styles['Title']))
    story.append(Paragraph(_formatear_rango_ventana(ventana, ventana_id), styles['Normal']))
    story.append(Spacer(1, 12))

    data = [[
        'DNI', 'Apellido y Nombre', 'Profesorado', 'Cohorte', 'Fecha solicitud'
    ]]
    for p in qs:
        est = p.estudiante
        data.append([
            est.dni,
            est.user.get_full_name() if est.user_id else '',
            p.profesorado.nombre if p.profesorado_id else '',
            str(p.cohorte or ''),
            p.created_at.strftime('%d/%m/%Y %H:%M')
        ])

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.black),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
        ('FONTSIZE', (0,1), (-1,-1), 9),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(table)
    doc.build(story)
    return response

@alumnos_router.get("/analiticos_ext", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico_ext(request, ventana_id: int, dni: str | None = None):
    qs = PedidoAnalitico.objects.select_related('estudiante__user','profesorado','ventana').filter(ventana_id=ventana_id)
    if dni:
        qs = qs.filter(estudiante__dni=dni)
    qs = qs.order_by('-created_at')
    out: list[PedidoAnaliticoItem] = []
    for p in qs:
        est = p.estudiante
        out.append(PedidoAnaliticoItem(
            dni=est.dni,
            apellido_nombre=est.user.get_full_name() if est.user_id else '',
            profesorado=p.profesorado.nombre if p.profesorado_id else None,
            anio_cursada=None,
            cohorte=p.cohorte,
            fecha_solicitud=p.created_at.isoformat(),
            motivo=p.motivo,
            motivo_otro=p.motivo_otro,
        ))
    return out

@alumnos_router.get("/analiticos_ext/pdf")
def analiticos_ext_pdf(request, ventana_id: int, dni: str | None = None):
    qs = PedidoAnalitico.objects.select_related('estudiante__user','profesorado','ventana').filter(ventana_id=ventana_id)
    if dni:
        qs = qs.filter(estudiante__dni=dni)
    qs = qs.order_by('-created_at')
    ventana = VentanaHabilitacion.objects.filter(id=ventana_id).first()

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="analiticos_{ventana_id}.pdf"'

    doc = SimpleDocTemplate(response, pagesize=A4, rightMargin=24, leftMargin=24, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph('Pedidos de Analitico', styles['Title']))
    story.append(Paragraph(_formatear_rango_ventana(ventana, ventana_id), styles['Normal']))
    story.append(Spacer(1, 12))

    data = [[
        'DNI', 'Apellido y Nombre', 'Profesorado', 'Cohorte', 'Fecha solicitud', 'Motivo'
    ]]
    for p in qs:
        est = p.estudiante
        motivo_txt = (p.get_motivo_display() if hasattr(p, 'get_motivo_display') else str(p.motivo))
        if p.motivo == 'otro' and p.motivo_otro:
            motivo_txt += f" - {p.motivo_otro}"
        data.append([
            est.dni,
            est.user.get_full_name() if est.user_id else '',
            p.profesorado.nombre if p.profesorado_id else '',
            str(p.cohorte or ''),
            p.created_at.strftime('%d/%m/%Y %H:%M'),
            motivo_txt,
        ])

    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.black),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.25, colors.grey),
        ('FONTSIZE', (0,1), (-1,-1), 9),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(table)
    doc.build(story)
    return response

@alumnos_router.post("/pedido_analitico", response=PedidoAnaliticoOut)
def crear_pedido_analitico(request, payload: PedidoAnaliticoIn):
    v = VentanaHabilitacion.objects.filter(tipo=VentanaHabilitacion.Tipo.ANALITICOS, activo=True).order_by('-desde').first()
    if not v:
        return 400, {"message": "No hay periodo activo para pedido de analítico."}
    est = None
    if payload.dni:
        est = Estudiante.objects.filter(dni=payload.dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, 'estudiante', None)
    if not est:
        return 400, {"message": "No se encontró el estudiante."}
    PedidoAnalitico.objects.create(
        estudiante=est,
        ventana=v,
        motivo=payload.motivo,
        motivo_otro=payload.motivo_otro,
        profesorado=est.carreras.first() if est else None,
        cohorte=payload.cohorte,
    )
    return {"message": "Solicitud registrada."}

# Listar pedidos de analítico por ventana (para tutor/bedel/secretaría/admin)
@alumnos_router.get("/analiticos", response=list[PedidoAnaliticoItem])
def listar_pedidos_analitico(request, ventana_id: int):
    qs = PedidoAnalitico.objects.select_related('estudiante__user','profesorado','ventana').filter(ventana_id=ventana_id).order_by('-created_at')
    out: list[PedidoAnaliticoItem] = []
    for p in qs:
        est = p.estudiante
        out.append(PedidoAnaliticoItem(
            dni=est.dni,
            apellido_nombre=est.user.get_full_name() if est.user_id else '',
            profesorado=p.profesorado.nombre if p.profesorado_id else None,
            anio_cursada=None,
            cohorte=p.cohorte,
            fecha_solicitud=p.created_at.isoformat(),
        ))
    return out




@alumnos_router.get('/vigencia-regularidad', response=dict)
def vigencia_regularidad(request, materia_id: int, dni: str | None = None):
    """Calcula hasta cuándo está vigente la regularidad del alumno en una materia.

    Regla: 2 años desde 'fecha_cierre' y el siguiente llamado FINAL posterior a esa fecha.
    Devuelve fechas y cantidad de intentos usados dentro de la vigencia (máx. 3).
    """
    from datetime import date
    est = None
    if dni:
        est = Estudiante.objects.filter(dni=dni).first()
    elif not isinstance(request.user, AnonymousUser):
        est = getattr(request.user, 'estudiante', None)
    if not est:
        return {"vigente": False, "motivo": "estudiante_no_encontrado"}

    materia = Materia.objects.filter(id=materia_id).first()
    if not materia:
        return {"vigente": False, "motivo": "materia_no_encontrada"}

    reg = (Regularidad.objects
           .filter(estudiante=est, materia=materia)
           .order_by('-fecha_cierre')
           .first())
    if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
        return {"vigente": False, "motivo": "sin_regularidad"}

    def _add_years(d: date, years: int) -> date:
        try:
            return d.replace(year=d.year + years)
        except ValueError:
            return d.replace(month=2, day=28, year=d.year + years)

    two_years = _add_years(reg.fecha_cierre, 2)
    next_call = (MesaExamen.objects
                 .filter(materia=materia, tipo=MesaExamen.Tipo.FINAL, fecha__gte=two_years)
                 .order_by('fecha').values_list('fecha', flat=True).first())
    allowed_until = next_call or two_years

    intentos = (InscripcionMesa.objects
                .filter(estudiante=est,
                        estado=InscripcionMesa.Estado.INSCRIPTO,
                        mesa__materia=materia,
                        mesa__tipo=MesaExamen.Tipo.FINAL,
                        mesa__fecha__gte=reg.fecha_cierre,
                        mesa__fecha__lte=allowed_until)
                .count())

    return {
        "vigente": True,
        "fecha_cierre": reg.fecha_cierre.isoformat(),
        "hasta": allowed_until.isoformat(),
        "intentos_usados": intentos,
        "intentos_max": 3,
    }

