from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from ninja.errors import HttpError

from core.auth_ninja import JWTAuth
from core.models import Materia, MesaExamen, SolicitudMesa
from core.permissions import allowed_profesorados, ensure_profesorado_access, ensure_roles

from ..router import management_router
from ..schemas import CrearMesaDesdeSolicitudIn, MesaDocenteOut, MesaIn, MesaOut, SolicitudMesaOut


def _serialize_mesa(mesa: MesaExamen) -> MesaOut:
    m = mesa.materia
    p = m.plan_de_estudio
    docentes = []
    if mesa.docente_presidente:
        docentes.append(
            MesaDocenteOut(
                rol="Presidente",
                docente_id=mesa.docente_presidente_id,
                nombre=f"{mesa.docente_presidente.persona.apellido}, {mesa.docente_presidente.persona.nombre}",
                dni=mesa.docente_presidente.persona.dni,
            )
        )
    if mesa.docente_vocal1:
        docentes.append(
            MesaDocenteOut(
                rol="Vocal 1",
                docente_id=mesa.docente_vocal1_id,
                nombre=f"{mesa.docente_vocal1.persona.apellido}, {mesa.docente_vocal1.persona.nombre}",
                dni=mesa.docente_vocal1.persona.dni,
            )
        )
    if mesa.docente_vocal2:
        docentes.append(
            MesaDocenteOut(
                rol="Vocal 2",
                docente_id=mesa.docente_vocal2_id,
                nombre=f"{mesa.docente_vocal2.persona.apellido}, {mesa.docente_vocal2.persona.nombre}",
                dni=mesa.docente_vocal2.persona.dni,
            )
        )

    est_exc = mesa.estudiante_exclusivo
    est_exc_persona = est_exc.persona if est_exc else None
    return MesaOut(
        id=mesa.id,
        materia_id=mesa.materia_id,
        materia_nombre=m.nombre,
        profesorado_id=p.profesorado_id if p else None,
        profesorado_nombre=p.profesorado.nombre if p and p.profesorado else None,
        plan_id=m.plan_de_estudio_id,
        plan_resolucion=p.resolucion if p else None,
        anio_cursada=m.anio_cursada,
        regimen=m.regimen,
        tipo=mesa.tipo,
        modalidad=mesa.modalidad,
        fecha=mesa.fecha,
        hora_desde=str(mesa.hora_desde) if mesa.hora_desde else None,
        hora_hasta=str(mesa.hora_hasta) if mesa.hora_hasta else None,
        aula=mesa.aula,
        cupo=mesa.cupo or 0,
        codigo=mesa.codigo,
        numero_mesa=mesa.numero_mesa,
        docentes=docentes,
        esta_cerrada=mesa.planilla_cerrada_en is not None,
        inscriptos_count=getattr(mesa, "num_inscriptos", 0),
        estudiante_exclusivo_dni=est_exc_persona.dni if est_exc_persona else None,
        estudiante_exclusivo_nombre=f"{est_exc_persona.apellido}, {est_exc_persona.nombre}"
        if est_exc_persona
        else None,
    )


def _auto_cleanup_deserted_mesas(dias_gracia: int = 5):
    """Delega al método del modelo para mantener la lógica centralizada."""
    return MesaExamen.auto_cleanup_deserted_mesas(dias_gracia=dias_gracia)


@management_router.get("/mesas", response=list[MesaOut], auth=JWTAuth())
def list_mesas(
    request,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
    materia_id: int | None = None,
    desde: str | None = None,
    hasta: str | None = None,
    tipo: str | None = None,
):
    ensure_roles(
        request.user, {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee", "consulta"}
    )

    # Barrido automático antes de listar
    # _auto_cleanup_deserted_mesas()  # R2: Removido de GET

    qs = MesaExamen.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "docente_presidente__persona",
        "docente_vocal1__persona",
        "docente_vocal2__persona",
    ).annotate(num_inscriptos=Count("inscripciones", filter=Q(inscripciones__estado="INS")))

    allowed = allowed_profesorados(request.user)
    if allowed is not None:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id__in=allowed)

    if profesorado_id:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
    if plan_id:
        qs = qs.filter(materia__plan_de_estudio_id=plan_id)
    if materia_id:
        qs = qs.filter(materia_id=materia_id)
    if desde:
        qs = qs.filter(fecha__gte=desde)
    if hasta:
        qs = qs.filter(fecha__lte=hasta)
    if tipo:
        qs = qs.filter(tipo=tipo.upper())

    qs = qs.order_by("fecha", "hora_desde")
    return [_serialize_mesa(m) for m in qs]


@management_router.post("/mesas", response=MesaOut, auth=JWTAuth())
def create_mesa(request, payload: MesaIn):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    materia = get_object_or_404(Materia, id=payload.materia_id)
    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)

    if payload.modalidad and payload.modalidad.upper() == "LIB" and not materia.permite_mesa_libre:
        raise HttpError(422, "Esta materia no está habilitada para exámenes en condición libre.")

    est_exclusivo = None
    if payload.tipo.upper() == "ESP" and payload.estudiante_exclusivo_dni:
        from core.models import Estudiante

        est_exclusivo = Estudiante.objects.filter(persona__dni=payload.estudiante_exclusivo_dni).first()
        if not est_exclusivo:
            raise HttpError(404, f"Estudiante con DNI {payload.estudiante_exclusivo_dni} no encontrado.")

    mesa = MesaExamen.objects.create(
        materia=materia,
        tipo=payload.tipo.upper(),
        modalidad=payload.modalidad.upper(),
        fecha=payload.fecha,
        hora_desde=payload.hora_desde,
        hora_hasta=payload.hora_hasta,
        aula=payload.aula,
        cupo=payload.cupo,
        ventana_id=payload.ventana_id,
        docente_presidente_id=payload.docente_presidente_id,
        docente_vocal1_id=payload.docente_vocal1_id,
        docente_vocal2_id=payload.docente_vocal2_id,
        numero_mesa=payload.numero_mesa,
        estudiante_exclusivo=est_exclusivo,
    )
    return _serialize_mesa(mesa)


@management_router.put("/mesas/{mesa_id}", response=MesaOut, auth=JWTAuth())
def update_mesa(request, mesa_id: int, payload: MesaIn):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    ensure_profesorado_access(request.user, mesa.materia.plan_de_estudio.profesorado_id)

    if payload.modalidad and payload.modalidad.upper() == "LIB" and not mesa.materia.permite_mesa_libre:
        raise HttpError(422, "Esta materia no está habilitada para exámenes en condición libre.")

    for attr, value in payload.dict().items():
        if attr in ("materia_id", "estudiante_exclusivo_dni"):
            continue
        if value is not None:
            setattr(mesa, attr, value)

    if mesa.tipo == "ESP" and payload.estudiante_exclusivo_dni is not None:
        from core.models import Estudiante

        est_exc = Estudiante.objects.filter(persona__dni=payload.estudiante_exclusivo_dni).first()
        mesa.estudiante_exclusivo = est_exc
    elif payload.estudiante_exclusivo_dni is None and mesa.tipo == "ESP":
        mesa.estudiante_exclusivo = None

    mesa.save()
    return _serialize_mesa(mesa)


@management_router.delete("/mesas/{mesa_id}", response={204: None}, auth=JWTAuth())
def delete_mesa(request, mesa_id: int):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    mesa = get_object_or_404(MesaExamen, id=mesa_id)
    ensure_profesorado_access(request.user, mesa.materia.plan_de_estudio.profesorado_id)
    mesa.delete()
    return 204, None


@management_router.post("/crear_mesa_desde_solicitud", response=MesaOut, auth=JWTAuth())
def crear_mesa_desde_solicitud(request, payload: CrearMesaDesdeSolicitudIn):
    """
    Crea una mesa de examen a partir de una solicitud 'semilla' y agrupa
    automáticamente a todos los demás alumnos con solicitudes idénticas
    (misma materia, modalidad y ventana) que estén pendientes.
    """
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    # 1. Obtener la solicitud semilla
    semilla = get_object_or_404(SolicitudMesa, id=payload.solicitud_id)
    materia = semilla.materia
    ensure_profesorado_access(request.user, materia.plan_de_estudio.profesorado_id)

    with transaction.atomic():
        # 2. Crear la Mesa de Examen
        mesa = MesaExamen.objects.create(
            materia=materia,
            tipo=MesaExamen.Tipo.EXTRAORDINARIA,
            modalidad=semilla.modalidad,
            fecha=payload.fecha,
            hora_desde=payload.hora_desde,
            hora_hasta=payload.hora_hasta,
            aula=payload.aula,
            cupo=payload.cupo,
            ventana=semilla.ventana,
            docente_presidente_id=payload.docente_presidente_id,
            docente_vocal1_id=payload.docente_vocal1_id,
            docente_vocal2_id=payload.docente_vocal2_id,
            numero_mesa=payload.numero_mesa,
        )

        # 3. Buscar todas las solicitudes coincidentes que estén PENDIENTES
        # Misma materia, misma modalidad y misma ventana de tiempo
        solicitudes_coincidentes = SolicitudMesa.objects.filter(
            materia=materia, modalidad=semilla.modalidad, ventana=semilla.ventana, estado="PEN"
        )

        from core.models import InscripcionMesa

        # 4. Procesar cada solicitud: Aprobar, Vincular e Inscribir
        for sol in solicitudes_coincidentes:
            sol.estado = "PRO"  # Mesa Aprobada
            sol.mesa_asignada = mesa
            sol.save()

            # Inscripción automática a la mesa
            InscripcionMesa.objects.get_or_create(
                mesa=mesa, estudiante_id=sol.estudiante_id, defaults={"estado": "INS"}
            )

    return _serialize_mesa(mesa)


@management_router.get("/solicitudes_mesas", response=list[SolicitudMesaOut], auth=JWTAuth())
def list_solicitudes(request, ventana_id: int | None = None, estado: str | None = None):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})

    qs = SolicitudMesa.objects.select_related("estudiante__persona", "materia__plan_de_estudio__profesorado").all()

    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if estado:
        qs = qs.filter(estado=estado.upper())

    # Filtro por profesorado si no es admin total
    allowed = allowed_profesorados(request.user)
    if allowed is not None:
        qs = qs.filter(materia__plan_de_estudio__profesorado_id__in=allowed)

    return [
        SolicitudMesaOut(
            id=s.id,
            estudiante_id=s.estudiante_id,
            estudiante_nombre=f"{s.estudiante.persona.apellido}, {s.estudiante.persona.nombre}",
            estudiante_dni=s.estudiante.persona.dni,
            materia_id=s.materia_id,
            materia_nombre=s.materia.nombre,
            profesorado_nombre=s.materia.plan_de_estudio.profesorado.nombre,
            ventana_id=s.ventana_id,
            estado=s.estado,
            estado_display=s.get_estado_display(),
            fecha_solicitud=s.fecha_solicitud,
            modalidad=s.modalidad,
            modalidad_display=s.get_modalidad_display(),
            observaciones=s.observaciones,
            mesa_asignada_id=s.mesa_asignada_id,
        )
        for s in qs.order_by("-fecha_solicitud")
    ]


@management_router.post("/solicitudes_mesas/{sol_id}/procesar", response=SolicitudMesaOut, auth=JWTAuth())
def procesar_solicitud(request, sol_id: int, estado: str, mesa_id: int | None = None):
    ensure_roles(request.user, {"admin", "secretaria", "bedel"})
    sol = get_object_or_404(SolicitudMesa, id=sol_id)

    with transaction.atomic():
        sol.estado = estado.upper()
        if mesa_id:
            sol.mesa_asignada_id = mesa_id
            if sol.estado == "PRO":
                from core.models import InscripcionMesa

                InscripcionMesa.objects.get_or_create(
                    mesa_id=mesa_id, estudiante_id=sol.estudiante_id, defaults={"estado": "INS"}
                )
        sol.save()

    return SolicitudMesaOut(
        id=sol.id,
        estudiante_id=sol.estudiante_id,
        estudiante_nombre=f"{sol.estudiante.persona.apellido}, {sol.estudiante.persona.nombre}",
        estudiante_dni=sol.estudiante.persona.dni,
        materia_id=sol.materia_id,
        materia_nombre=sol.materia.nombre,
        profesorado_nombre=sol.materia.plan_de_estudio.profesorado.nombre,
        ventana_id=sol.ventana_id,
        estado=sol.estado,
        estado_display=sol.get_estado_display(),
        fecha_solicitud=sol.fecha_solicitud,
        modalidad=sol.modalidad,
        modalidad_display=sol.get_modalidad_display(),
        observaciones=sol.observaciones,
        mesa_asignada_id=sol.mesa_asignada_id,
    )
