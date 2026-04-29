"""
API de Planillas de Regularidad — carga por docentes durante el cuatrimestre.

Flujo principal:
1. El docente (o bedel/secretaría) llama a POST /planillas-cursada/generar
   pasando comision_id + cuatrimestre + anio_lectivo.
2. El sistema agrupa los inscriptos activos por profesorado_destino y genera
   una PlanillaCursada por cada grupo (inter-profesorado incluido).
3. El docente puede guardar borradores progresivamente.
4. Al vencimiento de la ventana, cierra la planilla → se generan Regularidad.
"""

from datetime import date
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from ninja import Router, Schema
from ninja.errors import HttpError

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    Comision,
    Estudiante,
    InscripcionMateriaEstudiante,
    Materia,
    PlanillaCursada,
    PlanillaCursadaFila,
    Profesorado,
    Regularidad,
    RegularidadPlantilla,
    VentanaHabilitacion,
)
from core.permissions import allowed_profesorados
from .notas_utils import docente_from_user, normalized_user_roles

router = Router(tags=["planillas_cursada"], auth=JWTAuth())


# ==============================================================================
# SCHEMAS
# ==============================================================================

class GenerarPlanillasIn(Schema):
    comision_id: int
    anio_lectivo: int
    cuatrimestre: str          # "1C" / "2C" / "ANUAL"
    plantilla_id: int | None = None


class FilaOut(Schema):
    fila_id: int
    inscripcion_id: int
    estudiante_id: int
    orden: int
    apellido_nombre: str
    dni: str
    asistencia_porcentaje: int | None
    excepcion: bool
    columnas_datos: dict
    situacion: str
    en_resguardo: bool


class PlanillaCursadaOut(Schema):
    id: int
    numero: str
    estado: str
    materia_id: int
    materia_nombre: str
    profesorado_id: int
    profesorado_nombre: str
    profesorado_destino_id: int
    profesorado_destino_nombre: str
    anio_lectivo: int
    cuatrimestre: str
    fecha_entrega: date | None
    filas: list[FilaOut]


class GuardarFilasIn(Schema):
    class FilaIn(Schema):
        fila_id: int
        asistencia_porcentaje: int | None = None
        excepcion: bool = False
        columnas_datos: dict = {}
        situacion: str = ""

    filas: list[FilaIn]


class SincronizarPlanillaIn(Schema):
    comision_id: int


# ==============================================================================
# HELPERS
# ==============================================================================

def _profesorado_destino(inscripcion: InscripcionMateriaEstudiante) -> Profesorado:
    """Devuelve el profesorado al que pertenece la nota del estudiante.

    - Inter-profesorado: materia_origen.plan_de_estudio.profesorado
    - Normal:            materia.plan_de_estudio.profesorado
    """
    if inscripcion.materia_origen_id:
        return inscripcion.materia_origen.plan_de_estudio.profesorado
    return inscripcion.materia.plan_de_estudio.profesorado


def _porcentaje_asistencia(estudiante_id: int, comision_id: int) -> int | None:
    """Calcula el porcentaje de asistencia desde el módulo de asistencia.
    Devuelve None si no hay clases registradas (el docente lo carga a mano).
    """
    try:
        from apps.asistencia.models import AsistenciaEstudiante
        stats = (
            AsistenciaEstudiante.objects.filter(
                clase__comision_id=comision_id,
                estudiante_id=estudiante_id,
            )
            .aggregate(
                total=Count("id"),
                presentes=Count(
                    "id",
                    filter=Q(estado__in=["PRESENTE", "TARDE"]),
                ),
            )
        )
        total = stats["total"] or 0
        if total == 0:
            return None
        return round(stats["presentes"] / total * 100)
    except Exception:
        return None


def _next_numero_cursada(anio_lectivo: int) -> str:
    """Genera el próximo número de planilla cursada: PRP-YYYY-NNN."""
    from django.db.models import Max
    ultimo = (
        PlanillaCursada.objects.filter(anio_lectivo=anio_lectivo)
        .aggregate(Max("id"))
        .get("id__max")
    ) or 0
    return f"PRP-{anio_lectivo}-{ultimo + 1:03d}"


def _serializar_planilla(planilla: PlanillaCursada) -> PlanillaCursadaOut:
    filas = []
    for fila in planilla.filas.select_related("estudiante__persona").order_by("orden"):
        est = fila.estudiante
        if est and est.persona:
            apellido_nombre = f"{est.persona.apellido}, {est.persona.nombre}"
            dni = est.persona.dni
        else:
            apellido_nombre = "—"
            dni = "—"
        filas.append(FilaOut(
            fila_id=fila.id,
            inscripcion_id=fila.inscripcion_id if hasattr(fila, "inscripcion_id") else 0,
            estudiante_id=est.id if est else 0,
            orden=fila.orden,
            apellido_nombre=apellido_nombre,
            dni=dni,
            asistencia_porcentaje=fila.asistencia_porcentaje,
            excepcion=fila.excepcion,
            columnas_datos=fila.columnas_datos,
            situacion=fila.situacion,
            en_resguardo=fila.en_resguardo,
        ))
    return PlanillaCursadaOut(
        id=planilla.id,
        numero=planilla.numero,
        estado=planilla.estado,
        materia_id=planilla.materia_id,
        materia_nombre=planilla.materia.nombre,
        profesorado_id=planilla.profesorado_id,
        profesorado_nombre=planilla.profesorado.nombre,
        profesorado_destino_id=planilla.profesorado_destino_id,
        profesorado_destino_nombre=planilla.profesorado_destino.nombre,
        anio_lectivo=planilla.anio_lectivo,
        cuatrimestre=planilla.cuatrimestre,
        fecha_entrega=planilla.fecha_entrega,
        filas=filas,
    )


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@router.post(
    "/generar",
    response={200: list[PlanillaCursadaOut], 400: ApiResponse, 404: ApiResponse},
)
def generar_planillas_cursada(request, payload: GenerarPlanillasIn):
    """
    Genera (o retorna las existentes) planillas de cursada para una comisión.

    - Una planilla por profesorado_destino (inter-profesorado separado).
    - Si ya existen planillas para esta comisión+año+cuatrimestre, las retorna sin duplicar.
    - Solo accesible para docentes de la comisión, bedel y secretaría.
    """
    roles = normalized_user_roles(request.user)
    es_privilegiado = bool(roles & {"admin", "secretaria", "bedel"})

    comision = (
        Comision.objects.select_related("materia__plan_de_estudio__profesorado", "docente")
        .filter(id=payload.comision_id)
        .first()
    )
    if not comision:
        return 404, ApiResponse(ok=False, message="Comisión no encontrada.")

    # Verificar acceso territorial para bedeles
    allowed_ids = allowed_profesorados(request.user)
    prof_comision = comision.materia.plan_de_estudio.profesorado
    if allowed_ids is not None and prof_comision.id not in allowed_ids:
        raise HttpError(403, "No tenés acceso a esta comisión.")

    # Si no es privilegiado, verificar que sea docente de la comisión
    if not es_privilegiado:
        docente = docente_from_user(request.user)
        if not docente or comision.docente_id != docente.id:
            raise HttpError(403, "Solo podés acceder a tus propias planillas.")

    # Buscar planillas ya existentes para esta comisión en el período
    existentes = PlanillaCursada.objects.filter(
        materia=comision.materia,
        profesorado=prof_comision,
        anio_lectivo=payload.anio_lectivo,
        cuatrimestre=payload.cuatrimestre,
    ).prefetch_related("filas__estudiante__persona")

    if existentes.exists():
        return 200, [_serializar_planilla(p) for p in existentes]

    # Pre-poblar desde inscripciones activas
    inscripciones = (
        InscripcionMateriaEstudiante.objects.filter(
            comision=comision,
            anio=payload.anio_lectivo,
            estado__in=[
                InscripcionMateriaEstudiante.Estado.CONFIRMADA,
                InscripcionMateriaEstudiante.Estado.CONDICIONAL,
            ],
        )
        .select_related(
            "estudiante__persona",
            "materia__plan_de_estudio__profesorado",
            "materia_origen__plan_de_estudio__profesorado",
        )
        .order_by(
            "estudiante__persona__apellido",
            "estudiante__persona__nombre",
        )
    )

    if not inscripciones.exists():
        return 400, ApiResponse(ok=False, message="No hay estudiantes inscriptos activos en esta comisión.")

    # Agrupar por profesorado_destino
    grupos: dict[int, list[InscripcionMateriaEstudiante]] = {}
    for insc in inscripciones:
        prof_dest = _profesorado_destino(insc)
        grupos.setdefault(prof_dest.id, []).append(insc)

    plantilla = None
    if payload.plantilla_id:
        plantilla = RegularidadPlantilla.objects.filter(id=payload.plantilla_id).first()

    docente = comision.docente

    planillas_generadas = []
    with transaction.atomic():
        for prof_dest_id, inscripciones_grupo in grupos.items():
            prof_dest = inscripciones_grupo[0].materia_origen.plan_de_estudio.profesorado \
                if inscripciones_grupo[0].materia_origen_id \
                else prof_comision

            numero = _next_numero_cursada(payload.anio_lectivo)

            planilla_obj = PlanillaCursada.objects.create(
                numero=numero,
                docente=docente,
                materia=comision.materia,
                profesorado=prof_comision,
                profesorado_destino=prof_dest,
                anio_lectivo=payload.anio_lectivo,
                cuatrimestre=payload.cuatrimestre,
                plantilla=plantilla,
                estado=PlanillaCursada.Estado.BORRADOR,
            )

            filas = []
            for orden, insc in enumerate(inscripciones_grupo, start=1):
                asistencia = _porcentaje_asistencia(insc.estudiante_id, comision.id)
                filas.append(PlanillaCursadaFila(
                    planilla=planilla_obj,
                    estudiante=insc.estudiante,
                    inscripcion=insc,
                    orden=orden,
                    asistencia_porcentaje=asistencia,
                    excepcion=False,
                    columnas_datos={},
                    situacion="",
                    en_resguardo=False,
                ))
            PlanillaCursadaFila.objects.bulk_create(filas)
            planillas_generadas.append(planilla_obj)

    resultado = PlanillaCursada.objects.filter(
        id__in=[p.id for p in planillas_generadas]
    ).prefetch_related("filas__estudiante__persona")
    return 200, [_serializar_planilla(p) for p in resultado]


@router.get(
    "/{planilla_id}",
    response={200: PlanillaCursadaOut, 404: ApiResponse},
)
def obtener_planilla_cursada(request, planilla_id: int):
    """Retorna una planilla de cursada con todas sus filas."""
    roles = normalized_user_roles(request.user)
    es_privilegiado = bool(roles & {"admin", "secretaria", "bedel"})

    planilla = (
        PlanillaCursada.objects.select_related(
            "materia", "profesorado", "profesorado_destino", "docente"
        )
        .filter(id=planilla_id)
        .first()
    )
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")

    if not es_privilegiado:
        docente = docente_from_user(request.user)
        if not docente or planilla.docente_id != docente.id:
            raise HttpError(403, "No tenés acceso a esta planilla.")

    planilla_con_filas = PlanillaCursada.objects.prefetch_related(
        "filas__estudiante__persona"
    ).get(id=planilla_id)
    return 200, _serializar_planilla(planilla_con_filas)


@router.patch(
    "/{planilla_id}/guardar",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def guardar_borrador(request, planilla_id: int, payload: GuardarFilasIn):
    """Guarda notas y asistencia en borrador sin cerrar la planilla."""
    roles = normalized_user_roles(request.user)
    es_privilegiado = bool(roles & {"admin", "secretaria", "bedel"})

    planilla = PlanillaCursada.objects.filter(id=planilla_id).first()
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")

    if planilla.estado == PlanillaCursada.Estado.CERRADA:
        return 400, ApiResponse(ok=False, message="La planilla está cerrada. Solo Secretaría puede reabrirla.")

    if not es_privilegiado:
        docente = docente_from_user(request.user)
        if not docente or planilla.docente_id != docente.id:
            return 403, ApiResponse(ok=False, message="No tenés acceso a esta planilla.")

    fila_map = {f.fila_id: f for f in payload.filas}
    filas_qs = PlanillaCursadaFila.objects.filter(planilla=planilla, id__in=fila_map.keys())

    with transaction.atomic():
        for fila in filas_qs:
            datos = fila_map[fila.id]
            fila.asistencia_porcentaje = datos.asistencia_porcentaje
            fila.excepcion = datos.excepcion
            fila.columnas_datos = datos.columnas_datos
            fila.situacion = datos.situacion
        PlanillaCursadaFila.objects.bulk_update(
            filas_qs,
            ["asistencia_porcentaje", "excepcion", "columnas_datos", "situacion"],
        )

    return ApiResponse(ok=True, message="Borrador guardado correctamente.")


# ==============================================================================
# SITUACIONES QUE GENERAN REGULARIDAD AL CERRAR
# ==============================================================================

SITUACIONES_POSITIVAS = {
    Regularidad.Situacion.REGULAR,
    Regularidad.Situacion.APROBADO,
    Regularidad.Situacion.PROMOCIONADO,
}


def _ventana_activa(cuatrimestre: str) -> bool:
    """Verifica si la ventana de entrega de planillas de regularidad está activa hoy."""
    hoy = date.today()
    # ANUAL va con la ventana del 2C
    periodo = "1C" if cuatrimestre == "1C" else "2C"
    return VentanaHabilitacion.objects.filter(
        tipo=VentanaHabilitacion.Tipo.PLANILLA_REGULARIDAD,
        periodo=periodo,
        activo=True,
        desde__lte=hoy,
        hasta__gte=hoy,
    ).exists()


@router.post(
    "/{planilla_id}/cerrar",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def cerrar_planilla_cursada(request, planilla_id: int):
    """
    Cierra definitivamente la planilla y genera los registros de Regularidad.

    - Solo disponible si la ventana de entrega está activa, o para secretaría/bedel.
    - Para cada fila con situación positiva (REGULAR/APROBADO/PROMOCIONADO):
        * Usa materia_origen (inter-profesorado) si existe, si no materia normal.
        * Si el legajo no está COMPLETO → crea Regularidad con en_resguardo=True.
    - Marca la planilla como CERRADA y registra fecha_entrega.
    """
    roles = normalized_user_roles(request.user)
    es_privilegiado = bool(roles & {"admin", "secretaria", "bedel"})

    planilla = (
        PlanillaCursada.objects.select_related("materia", "profesorado", "docente")
        .filter(id=planilla_id)
        .first()
    )
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")

    if planilla.estado == PlanillaCursada.Estado.CERRADA:
        return 400, ApiResponse(ok=False, message="La planilla ya está cerrada.")

    # Docentes solo pueden cerrar si la ventana está activa
    if not es_privilegiado:
        docente = docente_from_user(request.user)
        if not docente or planilla.docente_id != docente.id:
            return 403, ApiResponse(ok=False, message="No tenés acceso a esta planilla.")
        if not _ventana_activa(planilla.cuatrimestre):
            return 400, ApiResponse(
                ok=False,
                message="La ventana de entrega de planillas no está habilitada. "
                        "Consultá a Secretaría.",
            )

    filas = (
        PlanillaCursadaFila.objects.filter(planilla=planilla)
        .select_related(
            "estudiante",
            "inscripcion__materia_origen",
            "inscripcion__materia",
        )
        .order_by("orden")
    )

    regularidades_creadas = 0
    en_resguardo_count = 0
    warnings: list[str] = []

    with transaction.atomic():
        for fila in filas:
            if not fila.estudiante:
                continue

            situacion = fila.situacion
            if situacion not in SITUACIONES_POSITIVAS:
                # Actualizar situación en la fila antes de cerrar
                fila.situacion = situacion
                fila.save(update_fields=["situacion"])
                continue

            # Resolver la materia correcta (inter-profesorado o normal)
            if fila.inscripcion and fila.inscripcion.materia_origen_id:
                materia_regularidad = fila.inscripcion.materia_origen
            elif fila.inscripcion:
                materia_regularidad = fila.inscripcion.materia
            else:
                materia_regularidad = planilla.materia

            # Determinar resguardo
            est = fila.estudiante
            legajo_completo = est.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
            en_resguardo = not legajo_completo

            fecha_cierre = timezone.localdate()

            Regularidad.objects.update_or_create(
                estudiante=est,
                materia=materia_regularidad,
                fecha_cierre=fecha_cierre,
                defaults={
                    "inscripcion": fila.inscripcion,
                    "asistencia_porcentaje": fila.asistencia_porcentaje,
                    "excepcion": fila.excepcion,
                    "situacion": situacion,
                    "en_resguardo": en_resguardo,
                    "observaciones": "",
                },
            )

            # Marcar la fila con el estado de resguardo
            fila.en_resguardo = en_resguardo
            fila.save(update_fields=["en_resguardo"])

            regularidades_creadas += 1
            if en_resguardo:
                en_resguardo_count += 1
                warnings.append(
                    f"{est.persona.apellido if est.persona else est.id}: "
                    f"nota en resguardo (legajo incompleto)."
                )

        planilla.estado = PlanillaCursada.Estado.CERRADA
        planilla.fecha_entrega = timezone.localdate()
        planilla.save(update_fields=["estado", "fecha_entrega"])

    msg = (
        f"Planilla cerrada. {regularidades_creadas} regularidades generadas"
        + (f", {en_resguardo_count} en resguardo." if en_resguardo_count else ".")
    )
    return ApiResponse(ok=True, message=msg)


@router.post(
    "/{planilla_id}/sincronizar",
    response={200: PlanillaCursadaOut, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def sincronizar_planilla(request, planilla_id: int, payload: SincronizarPlanillaIn):
    """
    Agrega a la planilla los estudiantes inscriptos activos en la comisión
    que aún no figuran como filas. No modifica filas existentes.
    Solo accesible para secretaría y bedel.
    """
    roles = normalized_user_roles(request.user)
    if not bool(roles & {"admin", "secretaria", "bedel"}):
        return 403, ApiResponse(ok=False, message="Solo Secretaría o Bedel pueden sincronizar planillas.")

    planilla = (
        PlanillaCursada.objects.select_related("materia", "profesorado")
        .filter(id=planilla_id)
        .first()
    )
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")

    if planilla.estado == PlanillaCursada.Estado.CERRADA:
        return 400, ApiResponse(
            ok=False,
            message="La planilla está cerrada. Reabrila desde Secretaría antes de sincronizar.",
        )

    comision = (
        Comision.objects.select_related("materia__plan_de_estudio__profesorado")
        .filter(id=payload.comision_id)
        .first()
    )
    if not comision:
        return 404, ApiResponse(ok=False, message="Comisión no encontrada.")

    allowed_ids = allowed_profesorados(request.user)
    prof_comision = comision.materia.plan_de_estudio.profesorado
    if allowed_ids is not None and prof_comision.id not in allowed_ids:
        raise HttpError(403, "No tenés acceso a esta comisión.")

    estudiantes_en_planilla = set(
        PlanillaCursadaFila.objects.filter(planilla=planilla)
        .values_list("estudiante_id", flat=True)
    )

    inscripciones_nuevas = (
        InscripcionMateriaEstudiante.objects.filter(
            comision=comision,
            anio=planilla.anio_lectivo,
            estado__in=[
                InscripcionMateriaEstudiante.Estado.CONFIRMADA,
                InscripcionMateriaEstudiante.Estado.CONDICIONAL,
            ],
        )
        .exclude(estudiante_id__in=estudiantes_en_planilla)
        .select_related(
            "estudiante__persona",
            "materia__plan_de_estudio__profesorado",
            "materia_origen__plan_de_estudio__profesorado",
        )
        .order_by("estudiante__persona__apellido", "estudiante__persona__nombre")
    )

    if not inscripciones_nuevas.exists():
        return 400, ApiResponse(ok=False, message="No hay estudiantes inscriptos activos para agregar.")

    ultimo_orden = (
        PlanillaCursadaFila.objects.filter(planilla=planilla)
        .aggregate(Max("orden"))
        .get("orden__max") or 0
    )

    with transaction.atomic():
        filas = []
        for i, insc in enumerate(inscripciones_nuevas, start=ultimo_orden + 1):
            asistencia = _porcentaje_asistencia(insc.estudiante_id, comision.id)
            filas.append(PlanillaCursadaFila(
                planilla=planilla,
                estudiante=insc.estudiante,
                inscripcion=insc,
                orden=i,
                asistencia_porcentaje=asistencia,
                excepcion=False,
                columnas_datos={},
                situacion="",
                en_resguardo=False,
            ))
        PlanillaCursadaFila.objects.bulk_create(filas)

    planilla_actualizada = PlanillaCursada.objects.prefetch_related(
        "filas__estudiante__persona"
    ).get(id=planilla_id)
    return 200, _serializar_planilla(planilla_actualizada)


@router.post(
    "/{planilla_id}/reabrir",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
)
def reabrir_planilla_cursada(request, planilla_id: int):
    """
    Reabre una planilla cerrada. Solo Secretaría puede hacerlo.
    El docente que guarde de nuevo → se vuelve a cerrar automáticamente.
    """
    roles = normalized_user_roles(request.user)
    if not bool(roles & {"admin", "secretaria"}):
        return 403, ApiResponse(
            ok=False, message="Solo Secretaría puede reabrir planillas cerradas."
        )

    planilla = PlanillaCursada.objects.filter(id=planilla_id).first()
    if not planilla:
        return 404, ApiResponse(ok=False, message="Planilla no encontrada.")

    if planilla.estado != PlanillaCursada.Estado.CERRADA:
        return 400, ApiResponse(ok=False, message="La planilla no está cerrada.")

    planilla.estado = PlanillaCursada.Estado.REABIERTA
    planilla.save(update_fields=["estado"])

    return ApiResponse(ok=True, message="Planilla reabierta. El docente puede volver a editarla.")
