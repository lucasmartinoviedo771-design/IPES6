"""
API de Gestión de Actas de Examen.
Permite la carga, consulta y rectificación de actas de examen finales (Regulares y Libres).
Incluye lógica crítica para la sincronización de resultados con la Trayectoria Académica,
creación automatizada de legajos para carga de datos históricos y validación de consistencia
contra Mesas de Examen activas.
"""

import secrets
import uuid
from datetime import datetime
from decimal import Decimal

from django.db import models, transaction
from django.http import HttpResponse
from django.utils import timezone
from ninja import Body, Router

from apps.common.api_schemas import ApiResponse
from apps.common.audit import log_action_from_request, snapshot
from apps.common.date_utils import format_date, format_datetime
from apps.estudiantes.api.actas_helpers import (
    _acta_metadata,
    _clasificar_resultado,
    _compute_acta_codigo,
    _next_acta_numero,
    _nota_label,
)
from apps.estudiantes.api.actas_schemas import (
    ActaCreateLocal,
    ActaCreateOutLocal,
    ActaDetailLocal,
    ActaDocenteLocal,
    ActaEstudianteLocal,
    ActaListItem,
    ActaMetadataOut,
)
from apps.estudiantes.services.actas_pdf import generar_acta_examen_pdf
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada
from apps.primera_carga.audit_utils import verify_acta_consistency
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamen,
    ActaExamenDocente,
    ActaExamenEstudiante,
    Docente,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Profesorado,
)
from core.permissions import can, ensure_profesorado_access, requires

from .notas_utils import format_user_display

router = Router(tags=["actas"])


@router.get(
    "/actas/metadata",
    response={200: ApiResponse},
    auth=JWTAuth(),
)
@requires("ver_actas")
def obtener_acta_metadata(request):
    """Retorna metadatos auxiliares para la carga de actas (Carreras, Planes, Roles)."""
    data = _acta_metadata(user=request.user)
    return ApiResponse(
        ok=True,
        message="Metadata para actas de examen.",
        data=data.dict(),
    )


@router.get(
    "/actas",
    response={200: list[ActaListItem]},
    auth=JWTAuth(),
)
@requires("ver_actas")
def listar_actas(
    request,
    anio: int | None = None,  # type: ignore
    materia: str | None = None,  # type: ignore
    libro: str | None = None,  # type: ignore
    folio: str | None = None,  # type: ignore
    anio_cursada_materia: int | None = None,  # type: ignore
    incluir_equivalencias: bool = False,
    ordering: str = "-id",
    sin_tribunal: bool = False,
    profesorado_id: int | None = None,  # type: ignore
):
    """
    Lista actas de examen con filtros por Libro, Folio y Materia.
    Implementa control de acceso territorial (Bedeles solo ven sus carreras).
    """
    user = request.user
    if can(user, "cargar_equivalencias_titulos"):
        qs = ActaExamen.objects.all()
    else:
        from core.models import StaffAsignacion

        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        qs = ActaExamen.objects.filter(profesorado_id__in=carreras_ids)

    if not incluir_equivalencias:
        qs = qs.exclude(codigo__startswith="EQUIV-")

    if anio:
        qs = qs.filter(fecha__year=anio)
    if materia:
        qs = qs.filter(materia__nombre__icontains=materia)
    if libro:
        qs = qs.filter(libro__icontains=libro)
    if folio:
        qs = qs.filter(folio__icontains=folio)
    if anio_cursada_materia:
        qs = qs.filter(materia__anio_cursada=anio_cursada_materia)
    if profesorado_id:
        qs = qs.filter(profesorado_id=profesorado_id)
    if sin_tribunal:
        from django.db.models import Exists, OuterRef

        tiene_vocal = ActaExamenDocente.objects.filter(acta=OuterRef("pk"), rol__in=["VOC1", "VOC2"])
        qs = qs.filter(~Exists(tiene_vocal))

    # Limitar longitud de parámetros de búsqueda
    materia = (materia or "")[:100]
    libro = (libro or "")[:50]
    folio = (folio or "")[:20]

    has_filters = any([anio, materia, libro, folio, anio_cursada_materia, profesorado_id])
    limit = 200 if has_filters else 50

    allowed_ordering = [
        "id",
        "-id",
        "fecha",
        "-fecha",
        "materia__nombre",
        "-materia__nombre",
        "total_alumnos",
        "-total_alumnos",
    ]
    if ordering not in allowed_ordering:
        ordering = "-id"

    from django.db.models import Exists, OuterRef

    tiene_vocal_sub = ActaExamenDocente.objects.filter(acta=OuterRef("pk"), rol__in=["VOC1", "VOC2"])
    actas_list = list(
        qs.select_related("materia").annotate(tiene_vocales=Exists(tiene_vocal_sub)).order_by(ordering)[:limit]
    )

    # Prefetch de estados de cierre de mesas correspondientes
    materia_ids = {a.materia_id for a in actas_list}  # type: ignore
    fechas = {a.fecha for a in actas_list if a.fecha}
    mesa_lookup: dict[tuple, MesaExamen] = {}
    if materia_ids and fechas:
        for mesa in MesaExamen.objects.filter(materia_id__in=materia_ids, fecha__in=fechas):
            key = (mesa.materia_id, mesa.fecha, mesa.modalidad)  # type: ignore
            mesa_lookup[key] = mesa

    result = []
    for acta in actas_list:
        mesa: MesaExamen | None = mesa_lookup.get((acta.materia_id, acta.fecha, acta.tipo))  # type: ignore
        result.append(
            {
                "id": acta.id,  # type: ignore
                "codigo": acta.codigo,
                "fecha": acta.fecha.isoformat() if acta.fecha else None,
                "materia": acta.materia.nombre if acta.materia else "Desconocida",
                "libro": acta.libro,
                "folio": acta.folio,
                "total_estudiantes": acta.total_alumnos,
                "created_at": format_datetime(acta.created_at),
                "mesa_id": mesa.id if mesa else None,  # type: ignore
                "esta_cerrada": (mesa.planilla_cerrada_en is not None) if mesa else False,
                "tiene_vocales": acta.tiene_vocales,  # type: ignore
            }
        )
    return result


@router.get(
    "/actas/{acta_id}",
    response={200: ActaDetailLocal, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@requires("ver_actas")
def obtener_acta(request, acta_id: int):
    """Obtiene el detalle completo de un acta, incluyendo nómina de alumnos y tribunal docente."""
    acta = ActaExamen.objects.select_related("materia", "profesorado", "created_by", "plan").filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    # Verificación de permisos territoriales
    user = request.user
    if not can(user, "cargar_equivalencias_titulos"):
        from core.models import StaffAsignacion

        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        if acta.profesorado_id not in carreras_ids:  # type: ignore
            return 403, ApiResponse(ok=False, message="No tiene permiso para ver actas de este profesorado.")

    mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()  # type: ignore

    estudiantes_qs = acta.estudiantes.all().order_by("numero_orden")  # type: ignore
    estudiantes_list = [
        ActaEstudianteLocal(
            numero_orden=a.numero_orden,
            permiso_examen=a.permiso_examen,
            dni=a.dni,
            apellido_nombre=a.apellido_nombre,
            examen_escrito=a.examen_escrito,
            examen_oral=a.examen_oral,
            calificacion_definitiva=a.calificacion_definitiva,
            observaciones=a.observaciones,
        )
        for a in estudiantes_qs
    ]

    docentes_qs = acta.docentes.all().order_by("orden")  # type: ignore
    docentes_list = [
        ActaDocenteLocal(docente_id=a.docente_id, nombre=a.nombre, dni=a.dni, rol=a.rol) for a in docentes_qs
    ]

    return ActaDetailLocal(
        id=acta.id,  # type: ignore
        codigo=acta.codigo,
        fecha=format_date(acta.fecha),  # type: ignore
        tipo=acta.tipo,
        profesorado_id=acta.profesorado_id,  # type: ignore
        materia_id=acta.materia_id,  # type: ignore
        plan_id=acta.plan_id,  # type: ignore
        profesorado=acta.profesorado.nombre,
        materia=acta.materia.nombre if acta.materia else "Desconocida",
        materia_anio=acta.materia.anio_cursada if acta.materia else None,
        plan_resolucion=acta.plan.resolucion if acta.plan else None,
        libro=acta.libro,
        folio=acta.folio,
        observaciones=acta.observaciones,
        total_estudiantes=acta.total_alumnos,
        total_aprobados=acta.total_aprobados or 0,
        total_desaprobados=acta.total_desaprobados or 0,
        total_ausentes=acta.total_ausentes or 0,
        created_by=format_user_display(acta.created_by),
        created_at=format_datetime(acta.created_at),
        mesa_id=mesa.id if mesa else None,  # type: ignore
        esta_cerrada=(mesa.planilla_cerrada_en is not None) if mesa else False,
        estudiantes=estudiantes_list,
        docentes=docentes_list,
    )


@router.post(
    "/actas",
    response={200: ApiResponse, 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def crear_acta_examen(request, payload: ActaCreateLocal = Body(...)):
    """
    Crea un acta de examen y sincroniza los resultados con las inscripciones a mesa.
    """
    from datetime import date

    from core.permissions import can, get_user_roles, require

    user_roles = get_user_roles(request.user)
    is_docente_only = "docente" in user_roles and not can(request.user, "acta_manual")

    if is_docente_only:
        require(request.user, "carga_notas")
    else:
        require(request.user, "acta_manual")

    NOTA_NUMERIC_VALUES = [str(i) for i in range(1, 11)]
    ACTA_NOTA_CHOICES = NOTA_NUMERIC_VALUES + [
        ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO,
        ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO,
    ]

    # Resolución de fecha
    try:
        acta_fecha = datetime.strptime(payload.fecha, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        try:
            acta_fecha = datetime.fromisoformat(payload.fecha).date()
        except ValueError:
            return 400, ApiResponse(ok=False, message="Formato de fecha inválido. Use YYYY-MM-DD")

    try:
        profesorado = Profesorado.objects.get(pk=payload.profesorado_id)
        if not is_docente_only:
            ensure_profesorado_access(request.user, profesorado.id)
    except Profesorado.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")

    # Resolución de mesa
    mesa = None
    if payload.mesa_id:
        mesa = MesaExamen.objects.filter(id=payload.mesa_id).first()
        if not mesa:
            return 404, ApiResponse(ok=False, message="Mesa de examen no encontrada.")

    # Si es solo docente, verificar tribunal
    if is_docente_only:
        try:
            docente_obj = Docente.objects.get(persona__user_profile__user=request.user)
            if mesa:
                # Validar tribunal de la mesa específica
                tribunal_valido = docente_obj.id in [  # type: ignore
                    mesa.docente_presidente_id,  # type: ignore
                    mesa.docente_vocal1_id,  # type: ignore
                    mesa.docente_vocal2_id,  # type: ignore
                ]
                if not tribunal_valido:
                    return 403, ApiResponse(
                        ok=False, message="Solo los docentes del tribunal de la mesa pueden crear esta acta."
                    )
                # Validar fecha/cierre para docentes
                if mesa.fecha < date.today() and mesa.planilla_cerrada_en is not None:
                    return 403, ApiResponse(
                        ok=False, message="No tiene permisos para modificar un acta de mesa pasada y cerrada."
                    )
            else:
                # Validar tribunal para mesas en la fecha dada
                tribunal_valido = (
                    MesaExamen.objects.filter(
                        materia_id=payload.materia_id,
                        fecha=acta_fecha,
                    )
                    .filter(
                        models.Q(docente_presidente=docente_obj)
                        | models.Q(docente_vocal1=docente_obj)
                        | models.Q(docente_vocal2=docente_obj)
                    )
                    .exists()
                )
                if not tribunal_valido:
                    return 403, ApiResponse(
                        ok=False, message="Solo los docentes del tribunal de la mesa pueden crear esta acta."
                    )
        except Docente.DoesNotExist:
            return 403, ApiResponse(ok=False, message="No se encontró un perfil de docente asociado a su usuario.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio").get(pk=payload.materia_id)
    except Materia.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    plan = materia.plan_de_estudio
    if plan.profesorado_id != profesorado.id:
        return 400, ApiResponse(ok=False, message="Inconsistencia de Plan/Profesorado.")

    # Validar duplicados por Libro/Folio/Materia/Fecha (Evitar carga doble de la misma planilla física)
    if payload.libro and payload.folio:
        duplicate = ActaExamen.objects.filter(
            materia_id=payload.materia_id, fecha=acta_fecha, libro=payload.libro, folio=payload.folio
        ).first()
        if duplicate:
            return 400, ApiResponse(
                ok=False,
                message=f"Ya existe un acta registrada ({duplicate.codigo}) para esta materia en la fecha {acta_fecha} con Libro {payload.libro} y Folio {payload.folio}.",
            )

    # Ciclo de validación y auto-creación de alumnos
    user_dni = getattr(request.user, "username", "")
    for estudiante_data in payload.estudiantes:
        clean_dni = estudiante_data.dni.strip()
        if not clean_dni:
            continue
        if clean_dni == user_dni:
            return 403, ApiResponse(ok=False, message="No puede cargar un acta donde figura usted mismo.")

        estudiante = Estudiante.objects.filter(persona__dni=clean_dni).first()
        if not estudiante:
            # Creación automática para legajos históricos
            nombre_completo = estudiante_data.apellido_nombre.strip()
            parts = nombre_completo.split(",")
            if len(parts) == 2:
                from django.contrib.auth.models import User

                from core.models import Persona

                last_name, first_name = parts[0].strip(), parts[1].strip()
                user, _ = User.objects.get_or_create(
                    username=clean_dni, defaults={"first_name": first_name, "last_name": last_name}
                )
                if _:
                    user.set_password(secrets.token_urlsafe(12))
                    user.save()
                persona, _ = Persona.objects.update_or_create(
                    dni=clean_dni, defaults={"nombre": first_name, "apellido": last_name}
                )
                estudiante = Estudiante.objects.create(
                    user=user, persona=persona, estado_legajo=Estudiante.EstadoLegajo.PENDIENTE
                )
            else:
                return 400, ApiResponse(ok=False, message=f"Falta 'Apellido, Nombre' para crear alumno {clean_dni}")

        estudiante.asignar_profesorado(profesorado)

    # Generación de códigos administrativos (Libro/Folio/Acta)
    anio = acta_fecha.year
    numero = _next_acta_numero(profesorado.id, anio)
    codigo = _compute_acta_codigo(profesorado, anio, numero)

    # Validación académica al momento de generar el acta
    # (complementa la verificación al inscribirse — puede haber cambiado desde entonces)
    from apps.estudiantes.api.mesas_api import _check_academic_eligibility

    AUSENTES = {ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO, ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO}

    for est_item in payload.estudiantes:
        clean_dni = est_item.dni.strip()
        if not clean_dni:
            continue
        # Ausentes no se validan académicamente
        if est_item.calificacion_definitiva in AUSENTES:
            continue

        # SI NO ES ESTRICTO (Primera Carga), saltamos validaciones académicas pesadas
        if not payload.strict:
            continue

        est_obj = Estudiante.objects.filter(persona__dni=clean_dni).first()
        if not est_obj:
            continue  # Legajo histórico nuevo — se validará en otro momento
        # Buscar la mesa asociada por materia y fecha
        mesa = MesaExamen.objects.filter(materia=materia, fecha=acta_fecha).first()
        if mesa:
            eligible, motivo, _ = _check_academic_eligibility(
                est_obj,
                materia=mesa.materia,
                modalidad=mesa.modalidad,
                mesa=mesa,
                bypass_legajo=True,
                bypass_correlativas=not payload.strict,
                bypass_regularidad=not payload.strict,
                bypass_historial=not payload.strict,
            )
            if not eligible:
                # Advertencia no bloqueante para inscripciones ya existentes;
                # bloqueante si el estudiante no está inscripto (caso manual sin mesa)
                insc = InscripcionMesa.objects.filter(
                    estudiante=est_obj, mesa=mesa, estado=InscripcionMesa.Estado.INSCRIPTO
                ).exists()
                if not insc:
                    return 400, ApiResponse(
                        ok=False, message=f"El estudiante {clean_dni} no cumple los requisitos para rendir: {motivo}"
                    )

    # Clasificación de resultados para auditoría de totales
    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for est_item in payload.estudiantes:
        if est_item.calificacion_definitiva not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Nota inválida para {est_item.dni}")

        # Salvaguarda: Evitar dobles aprobaciones en trayectoria (Omitir si no es estricto)
        if payload.strict and _clasificar_resultado(est_item.calificacion_definitiva) == "aprobado":
            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni).first()
            if est_obj and estudiante_tiene_materia_aprobada(est_obj, materia):
                return 400, ApiResponse(
                    ok=False, message=f"El estudiante {est_obj.dni} ya aprobó esta materia anteriormente."
                )

        categoria = _clasificar_resultado(est_item.calificacion_definitiva)
        categoria_counts[categoria] += 1

    usuario = getattr(request, "user", None)
    with transaction.atomic():
        acta = ActaExamen.objects.create(
            codigo=codigo,
            numero=numero,
            anio_academico=anio,
            tipo=payload.tipo,
            profesorado=profesorado,
            materia=materia,
            plan=plan,
            anio_cursada=materia.anio_cursada,
            fecha=acta_fecha,
            folio=payload.folio,
            libro=payload.libro or "",
            observaciones=payload.observaciones or "",
            total_alumnos=len(payload.estudiantes),
            total_aprobados=categoria_counts["aprobado"],
            total_desaprobados=categoria_counts["desaprobado"],
            total_ausentes=categoria_counts["ausente"],
            created_by=usuario if getattr(usuario, "is_authenticated", False) else None,
            mesa=mesa,
        )

        # Persistir tribunal docente
        docente_presidente = None
        for idx, docente_data in enumerate(payload.docentes):
            rol = (
                docente_data.rol
                if docente_data.rol in dict(ActaExamenDocente.Rol.choices)
                else ActaExamenDocente.Rol.PRESIDENTE
            )
            docente_obj = (
                Docente.objects.filter(id=docente_data.docente_id).first() if docente_data.docente_id else None  # type: ignore
            )
            ActaExamenDocente.objects.create(
                acta=acta,
                docente=docente_obj,
                nombre=docente_data.nombre.strip(),
                dni=(docente_data.dni or "").strip(),
                rol=rol,
                orden=idx,
            )
            if rol == ActaExamenDocente.Rol.PRESIDENTE:
                docente_presidente = docente_obj

        # Sincronización de Mesa de Examen (Presidencia, Vocales)
        if not mesa:
            mesa = MesaExamen.objects.filter(
                materia=materia,
                fecha=acta_fecha,
                modalidad=MesaExamen.Modalidad.LIBRE
                if payload.tipo == ActaExamen.Tipo.LIBRE
                else MesaExamen.Modalidad.REGULAR,
            ).first()
            if not mesa:
                mesa = MesaExamen.objects.create(
                    materia=materia,
                    fecha=acta_fecha,
                    tipo=MesaExamen.Tipo.FINAL,
                    modalidad=MesaExamen.Modalidad.LIBRE
                    if payload.tipo == ActaExamen.Tipo.LIBRE
                    else MesaExamen.Modalidad.REGULAR,
                    codigo=f"MA-{acta.id}-{acta_fecha.strftime('%Y%m%d')}",  # type: ignore
                    docente_presidente=docente_presidente,
                    planilla_cerrada_en=timezone.now(),
                    planilla_cerrada_por=usuario if getattr(usuario, "is_authenticated", False) else None,
                )
                acta.mesa = mesa
                acta.save(update_fields=["mesa"])
            elif not mesa.planilla_cerrada_en:
                mesa.planilla_cerrada_en = timezone.now()
                mesa.planilla_cerrada_por = usuario if getattr(usuario, "is_authenticated", False) else None
                mesa.save(update_fields=["planilla_cerrada_en", "planilla_cerrada_por"])
                acta.mesa = mesa
                acta.save(update_fields=["mesa"])
        else:
            if not mesa.planilla_cerrada_en:
                mesa.planilla_cerrada_en = timezone.now()
                mesa.planilla_cerrada_por = usuario if getattr(usuario, "is_authenticated", False) else None
                mesa.save(update_fields=["planilla_cerrada_en", "planilla_cerrada_por"])

        # Carga de renglones de acta y actualización de inscripciones a mesa
        for est_item in payload.estudiantes:
            acta_est_obj = ActaExamenEstudiante.objects.create(
                acta=acta,
                numero_orden=est_item.numero_orden,
                permiso_examen=est_item.permiso_examen or "",
                dni=est_item.dni.strip(),
                apellido_nombre=est_item.apellido_nombre.strip(),
                examen_escrito=est_item.examen_escrito or "",
                examen_oral=est_item.examen_oral or "",
                calificacion_definitiva=est_item.calificacion_definitiva,
                observaciones=est_item.observaciones or "",
            )

            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni.strip()).first()
            if est_obj:
                # Mapeamos la calificación del acta a condiciones de InscripcionMesa
                calif = est_item.calificacion_definitiva.strip().upper()
                condicion = InscripcionMesa.Condicion.DESAPROBADO
                nota_dec = None
                if calif.isdigit():
                    nota_dec = Decimal(calif)
                    if nota_dec >= 6:
                        condicion = InscripcionMesa.Condicion.APROBADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
                    condicion = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
                    condicion = InscripcionMesa.Condicion.AUSENTE

                InscripcionMesa.objects.update_or_create(
                    mesa=mesa,
                    estudiante=est_obj,
                    defaults={
                        "estado": InscripcionMesa.Estado.INSCRIPTO,
                        "fecha_resultado": acta_fecha,
                        "condicion": condicion,
                        "nota": nota_dec,
                        "folio": payload.folio,
                        "libro": payload.libro,
                        "observaciones": "Carga por Acta de Examen",
                        "cuenta_para_intentos": condicion != InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO,
                    },
                )
                verify_acta_consistency(acta_est_obj)

        # Registrar acción en auditoría
        log_action_from_request(
            request,
            accion="CREATE",
            tipo_accion="CRUD",
            detalle_accion=f"Creación de Acta de Examen: {codigo}",
            entidad="ActaExamen",
            entidad_id=acta.id,  # type: ignore
            metadata={
                "libro": payload.libro,
                "folio": payload.folio,
                "materia": materia.nombre,
                "total_alumnos": len(payload.estudiantes),
            },
        )

    return ApiResponse(
        ok=True,
        message="Acta de examen generada correctamente.",
        data=ActaCreateOutLocal(id=acta.id, codigo=acta.codigo).dict(),  # type: ignore
    )


@router.api_operation(
    ["PUT", "POST"],
    "/actas/{acta_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
def actualizar_acta_examen(request, acta_id: int, payload: ActaCreateLocal = Body(...)):
    """
    Actualiza o rectifica un acta de examen existente.
    Bloquea la edición si la Mesa de Examen ya ha sido auditada y cerrada por bedelía fuera de este flujo.
    """
    from datetime import date

    from core.permissions import can, get_user_roles, require

    user_roles = get_user_roles(request.user)
    is_docente_only = "docente" in user_roles and not can(request.user, "acta_manual")

    if is_docente_only:
        require(request.user, "carga_notas")
    else:
        require(request.user, "acta_manual")

    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    nueva_materia = Materia.objects.filter(id=payload.materia_id).first()
    if not nueva_materia:
        return 400, ApiResponse(ok=False, message="Materia no encontrada.")

    nuevo_profesorado = Profesorado.objects.filter(id=payload.profesorado_id).first()
    if not nuevo_profesorado:
        return 400, ApiResponse(ok=False, message="Profesorado no encontrado.")

    # Resolución de mesa
    mesa = None
    if payload.mesa_id:
        mesa = MesaExamen.objects.filter(id=payload.mesa_id).first()
    if not mesa and acta.mesa_id:  # type: ignore
        mesa = acta.mesa

    # Validar tribunal y fecha para docentes
    if is_docente_only:
        try:
            docente_obj = Docente.objects.get(persona__user_profile__user=request.user)
            if mesa:
                tribunal_valido = docente_obj.id in [  # type: ignore
                    mesa.docente_presidente_id,  # type: ignore
                    mesa.docente_vocal1_id,  # type: ignore
                    mesa.docente_vocal2_id,  # type: ignore
                ]
                if not tribunal_valido:
                    return 403, ApiResponse(
                        ok=False, message="Solo los docentes del tribunal de la mesa pueden modificar esta acta."
                    )
                if mesa.fecha < date.today() and mesa.planilla_cerrada_en is not None:
                    return 403, ApiResponse(
                        ok=False, message="No tiene permisos para modificar un acta de mesa pasada y cerrada."
                    )
        except Docente.DoesNotExist:
            return 403, ApiResponse(ok=False, message="No se encontró un perfil de docente asociado a su usuario.")

    # Mesa vinculada a la materia/fecha ORIGINAL (antes de editar)
    fecha_original = acta.fecha
    tipo_original = acta.tipo
    mesa_modalidad = MesaExamen.Modalidad.LIBRE if acta.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR
    mesa_vieja = MesaExamen.objects.filter(
        materia_id=acta.materia_id, fecha=fecha_original, modalidad=mesa_modalidad  # type: ignore
    ).first()

    # Si cambió materia, fecha o tipo, buscar/crear la mesa correspondiente a los nuevos valores
    nueva_fecha = payload.fecha
    materia_cambio = acta.materia_id != payload.materia_id  # type: ignore
    fecha_cambio = str(fecha_original) != str(nueva_fecha)
    tipo_cambio = acta.tipo != payload.tipo

    nueva_modalidad = (
        MesaExamen.Modalidad.LIBRE if payload.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR
    )

    if materia_cambio or fecha_cambio or tipo_cambio:
        mesa, created = MesaExamen.objects.get_or_create(
            materia_id=payload.materia_id,
            fecha=nueva_fecha,
            modalidad=nueva_modalidad,
            defaults={
                "tipo": MesaExamen.Tipo.FINAL,
                "codigo": f"MA-{acta.id}-{nueva_fecha}-R",  # type: ignore
                "planilla_cerrada_en": timezone.now(),
            },
        )
        if not created and not mesa.planilla_cerrada_en:
            mesa.planilla_cerrada_en = timezone.now()
            mesa.save(update_fields=["planilla_cerrada_en"])
        # Limpiar InscripcionMesa de la mesa vieja vinculadas a este acta
        if mesa_vieja:
            InscripcionMesa.objects.filter(mesa=mesa_vieja, folio=acta.folio).delete()

            # Limpieza de "mesa fantasma": si la mesa vieja queda sin inscriptos
            # y era una mesa generada automáticamente (MA-), la eliminamos.
            if (
                mesa_vieja.codigo
                and mesa_vieja.codigo.startswith("MA-")
                and not mesa_vieja.inscripciones.exists()  # type: ignore
                and not ActaExamen.objects.filter(
                    materia=mesa_vieja.materia, fecha=mesa_vieja.fecha, tipo=tipo_original
                )
                .exclude(id=acta.id)  # type: ignore
                .exists()
            ):
                mesa_vieja.delete()
    else:
        mesa = mesa_vieja

    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for est_item in payload.estudiantes:
        categoria = _clasificar_resultado(est_item.calificacion_definitiva)
        categoria_counts[categoria] += 1

    usuario = getattr(request, "user", None)
    # Capturar estado previo para auditoría
    before = snapshot(acta)
    with transaction.atomic():
        acta.tipo = payload.tipo
        acta.materia = nueva_materia
        acta.profesorado = nuevo_profesorado
        acta.fecha = payload.fecha
        acta.folio = payload.folio
        acta.libro = payload.libro or ""
        acta.observaciones = payload.observaciones or ""
        acta.total_alumnos = len(payload.estudiantes)
        acta.total_aprobados = categoria_counts["aprobado"]
        acta.total_desaprobados = categoria_counts["desaprobado"]
        acta.total_ausentes = categoria_counts["ausente"]
        acta.updated_by = usuario if getattr(usuario, "is_authenticated", False) else None
        acta.mesa = mesa
        acta.save()

        if mesa and not mesa.planilla_cerrada_en:
            mesa.planilla_cerrada_en = timezone.now()
            mesa.planilla_cerrada_por = usuario if getattr(usuario, "is_authenticated", False) else None
            mesa.save(update_fields=["planilla_cerrada_en", "planilla_cerrada_por"])

        # Re-construcción del tribunal docente
        acta.docentes.all().delete()  # type: ignore
        pres_obj = voc1_obj = voc2_obj = None
        for idx, docente_data in enumerate(payload.docentes):
            rol = (
                docente_data.rol
                if docente_data.rol in dict(ActaExamenDocente.Rol.choices)
                else ActaExamenDocente.Rol.PRESIDENTE
            )
            docente_obj = (
                Docente.objects.filter(id=docente_data.docente_id).first() if docente_data.docente_id else None  # type: ignore
            )
            ActaExamenDocente.objects.create(
                acta=acta,
                docente=docente_obj,
                nombre=docente_data.nombre.strip(),
                dni=(docente_data.dni or "").strip(),
                rol=rol,
                orden=idx,
            )
            if rol == ActaExamenDocente.Rol.PRESIDENTE:
                pres_obj = docente_obj
            elif rol == ActaExamenDocente.Rol.VOCAL1:
                voc1_obj = docente_obj
            elif rol == ActaExamenDocente.Rol.VOCAL2:
                voc2_obj = docente_obj

        # Sincronizar mesa con el tribunal actualizado
        if mesa:
            mesa.docente_presidente = pres_obj
            mesa.docente_vocal1 = voc1_obj
            mesa.docente_vocal2 = voc2_obj
            mesa.save(update_fields=["docente_presidente", "docente_vocal1", "docente_vocal2"])

        # Re-construcción de nómina (Idempotencia)
        acta.estudiantes.all().delete()  # type: ignore
        if mesa:
            InscripcionMesa.objects.filter(mesa=mesa, folio=payload.folio).delete()

        for est_item in payload.estudiantes:
            acta_est_obj = ActaExamenEstudiante.objects.create(
                acta=acta,
                numero_orden=est_item.numero_orden,
                permiso_examen=est_item.permiso_examen or "",
                dni=est_item.dni.strip(),
                apellido_nombre=est_item.apellido_nombre.strip(),
                examen_escrito=est_item.examen_escrito or "",
                examen_oral=est_item.examen_oral or "",
                calificacion_definitiva=est_item.calificacion_definitiva,
                observaciones=est_item.observaciones or "",
            )

            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni.strip()).first()
            if est_obj and mesa:
                # Sincronización iterativa de resultados
                calif = est_item.calificacion_definitiva.strip().upper()
                condicion = InscripcionMesa.Condicion.DESAPROBADO
                nota_dec = None
                if calif.isdigit():
                    nota_dec = Decimal(calif)
                    if nota_dec >= 6:
                        condicion = InscripcionMesa.Condicion.APROBADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO:
                    condicion = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO:
                    condicion = InscripcionMesa.Condicion.AUSENTE

                InscripcionMesa.objects.update_or_create(
                    mesa=mesa,
                    estudiante=est_obj,
                    defaults={
                        "estado": InscripcionMesa.Estado.INSCRIPTO,
                        "fecha_resultado": payload.fecha,
                        "condicion": condicion,
                        "nota": nota_dec,
                        "folio": payload.folio,
                        "libro": payload.libro,
                        "observaciones": "Carga por Acta de Examen",
                        "cuenta_para_intentos": condicion != InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO,
                    },
                )
                verify_acta_consistency(acta_est_obj)

        # Registrar acción en auditoría
        log_action_from_request(
            request,
            accion="UPDATE",
            tipo_accion="CRUD",
            detalle_accion=f"Rectificación de Acta de Examen: {acta.codigo}",
            entidad="ActaExamen",
            entidad_id=acta_id,
            before=before,
            after=acta,
            metadata={"motivo": "Rectificación administrativa", "nuevos_estudiantes_count": len(payload.estudiantes)},
        )

    return ApiResponse(ok=True, message="Acta rectificada correctamente.")


@router.put(
    "/actas/{acta_id}/header",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@requires("editar_estructura")
def actualizar_cabecera_acta(request, acta_id: int):
    """Acceso rápido para editar Libro/Folio sin afectar la nómina."""
    return ApiResponse(ok=False, message="Operación deshabilitada. Utilice la actualización completa del acta.")


@router.patch(
    "/actas/{acta_id}/docentes",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@requires("editar_estructura")
def actualizar_docentes_acta(request, acta_id: int, payload: list[ActaDocenteLocal] = Body(...)):
    """
    Actualiza solo el tribunal docente de un acta, sin tocar notas ni estudiantes.
    Funciona aunque la planilla esté cerrada — el cierre protege las notas, no el tribunal.
    """
    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    user = request.user
    if not can(user, "cargar_equivalencias_titulos"):
        from core.models import StaffAsignacion

        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        if acta.profesorado_id not in carreras_ids:  # type: ignore
            return 403, ApiResponse(ok=False, message="No tiene permiso para editar actas de este profesorado.")

    with transaction.atomic():
        acta.docentes.all().delete()  # type: ignore
        pres_obj = voc1_obj = voc2_obj = None
        for idx, docente_data in enumerate(payload):
            rol = (
                docente_data.rol
                if docente_data.rol in dict(ActaExamenDocente.Rol.choices)
                else ActaExamenDocente.Rol.PRESIDENTE
            )
            docente_obj = (
                Docente.objects.filter(id=docente_data.docente_id).first() if docente_data.docente_id else None
            )
            ActaExamenDocente.objects.create(
                acta=acta,
                docente=docente_obj,
                nombre=docente_data.nombre.strip(),
                dni=(docente_data.dni or "").strip(),
                rol=rol,
                orden=idx,
            )
            if rol == ActaExamenDocente.Rol.PRESIDENTE:
                pres_obj = docente_obj
            elif rol == ActaExamenDocente.Rol.VOCAL1:
                voc1_obj = docente_obj
            elif rol == ActaExamenDocente.Rol.VOCAL2:
                voc2_obj = docente_obj

        # Sincronizar mesa vinculada
        modalidad = MesaExamen.Modalidad.LIBRE if acta.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR
        mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=modalidad).first()  # type: ignore
        if mesa:
            mesa.docente_presidente = pres_obj
            mesa.docente_vocal1 = voc1_obj
            mesa.docente_vocal2 = voc2_obj
            mesa.save(update_fields=["docente_presidente", "docente_vocal1", "docente_vocal2"])

        log_action_from_request(
            request,
            accion="UPDATE",
            tipo_accion="CRUD",
            detalle_accion=f"Actualización de tribunal del acta: {acta.codigo}",
            entidad="ActaExamen",
            entidad_id=acta_id,
        )

    return ApiResponse(ok=True, message="Tribunal actualizado correctamente.")


@router.get(
    "/actas/{acta_id}/pdf",
    auth=JWTAuth(),
)
@requires("ver_actas")
def descargar_acta_pdf(request, acta_id: int):
    """Genera y descarga el PDF del acta principal (alumnos del profesorado)."""
    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return HttpResponse("Acta no encontrada", status=404)

    pdf_bytes = generar_acta_examen_pdf(acta, es_comisionados=False)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    filename = f"ACTA_{acta.codigo}.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@router.get(
    "/actas/{acta_id}/pdf-comisionados",
    auth=JWTAuth(),
)
@requires("ver_actas")
def descargar_acta_comisionados_pdf(request, acta_id: int):
    """Genera y descarga el PDF de alumnos comisionados de un acta."""
    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return HttpResponse("Acta no encontrada", status=404)

    pdf_bytes = generar_acta_examen_pdf(acta, es_comisionados=True)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    filename = f"ACTA_{acta.codigo}_COMISIONADOS.pdf"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
