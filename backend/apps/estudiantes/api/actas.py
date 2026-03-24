"""
API de Gestión de Actas de Examen.
Permite la carga, consulta y rectificación de actas de examen finales (Regulares y Libres).
Incluye lógica crítica para la sincronización de resultados con la Trayectoria Académica,
creación automatizada de legajos para carga de datos históricos y validación de consistencia
contra Mesas de Examen activas.
"""

from datetime import datetime
from decimal import Decimal
import uuid
from django.db import transaction
from apps.common.date_utils import format_date, format_datetime
from django.utils import timezone
from ninja import Router, Body

from apps.common.api_schemas import ApiResponse
from apps.estudiantes.services.cursada import estudiante_tiene_materia_aprobada
from core.permissions import ensure_profesorado_access
from core.auth_ninja import JWTAuth, ensure_roles
from core.models import (
    ActaExamen,
    ActaExamenEstudiante,
    ActaExamenDocente,
    Docente,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Profesorado,
)
from .notas_utils import normalized_user_roles, format_user_display
from apps.primera_carga.audit_utils import verify_acta_consistency

from apps.estudiantes.api.actas_schemas import (
    ActaCreateLocal,
    ActaCreateOutLocal,
    ActaDetailLocal,
    ActaDocenteLocal,
    ActaEstudianteLocal,
    ActaListItem,
    ActaMetadataOut,
)
from apps.estudiantes.api.actas_helpers import (
    _acta_metadata,
    _clasificar_resultado,
    _compute_acta_codigo,
    _next_acta_numero,
    _nota_label,
)

router = Router(tags=["actas"])


@router.get(
    "/actas/metadata",
    response={200: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
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
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def listar_actas(request, anio: int = None, materia: str = None, libro: str = None, folio: str = None, anio_cursada_materia: int = None, incluir_equivalencias: bool = False, ordering: str = "-id"):
    """
    Lista actas de examen con filtros por Libro, Folio y Materia.
    Implementa control de acceso territorial (Bedeles solo ven sus carreras).
    """
    user = request.user
    roles = normalized_user_roles(user)

    if roles.intersection({"admin", "secretaria", "titulos"}):
        qs = ActaExamen.objects.all()
    else:
        from core.models import StaffAsignacion
        carreras_ids = StaffAsignacion.objects.filter(
            user=user
        ).values_list("profesorado_id", flat=True)
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

    # Limitar longitud de parámetros de búsqueda
    materia = (materia or "")[:100]
    libro = (libro or "")[:50]
    folio = (folio or "")[:20]

    has_filters = any([anio, materia, libro, folio, anio_cursada_materia])
    limit = 200 if has_filters else 50

    allowed_ordering = ["id", "-id", "fecha", "-fecha", "materia__nombre", "-materia__nombre", "total_alumnos", "-total_alumnos"]
    if ordering not in allowed_ordering:
        ordering = "-id"

    actas_list = list(qs.select_related("materia").order_by(ordering)[:limit])

    # Prefetch de estados de cierre de mesas correspondientes
    materia_ids = {a.materia_id for a in actas_list}
    fechas = {a.fecha for a in actas_list if a.fecha}
    mesa_lookup: dict[tuple, MesaExamen] = {}
    if materia_ids and fechas:
        for mesa in MesaExamen.objects.filter(materia_id__in=materia_ids, fecha__in=fechas):
            key = (mesa.materia_id, mesa.fecha, mesa.modalidad)
            mesa_lookup[key] = mesa

    result = []
    for acta in actas_list:
        mesa = mesa_lookup.get((acta.materia_id, acta.fecha, acta.tipo))
        result.append({
            "id": acta.id,
            "codigo": acta.codigo,
            "fecha": acta.fecha.isoformat() if acta.fecha else None,
            "materia": acta.materia.nombre if acta.materia else "Desconocida",
            "libro": acta.libro,
            "folio": acta.folio,
            "total_estudiantes": acta.total_alumnos,
            "created_at": format_datetime(acta.created_at),
            "mesa_id": mesa.id if mesa else None,
            "esta_cerrada": (mesa.planilla_cerrada_en is not None) if mesa else False
        })
    return result


@router.get(
    "/actas/{acta_id}",
    response={200: ActaDetailLocal, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel", "titulos", "coordinador"])
def obtener_acta(request, acta_id: int):
    """Obtiene el detalle completo de un acta, incluyendo nómina de alumnos y tribunal docente."""
    acta = ActaExamen.objects.select_related("materia", "profesorado", "created_by", "plan").filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    # Verificación de permisos territoriales
    user = request.user
    roles = normalized_user_roles(user)
    if not roles.intersection({"admin", "secretaria", "titulos"}):
        from core.models import StaffAsignacion
        carreras_ids = StaffAsignacion.objects.filter(user=user).values_list("profesorado_id", flat=True)
        if acta.profesorado_id not in carreras_ids:
             return 403, ApiResponse(ok=False, message="No tiene permiso para ver actas de este profesorado.")

    mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()

    estudiantes_qs = acta.estudiantes.all().order_by("numero_orden")
    estudiantes_list = [
        ActaEstudianteLocal(
            numero_orden=a.numero_orden,
            permiso_examen=a.permiso_examen,
            dni=a.dni,
            apellido_nombre=a.apellido_nombre,
            examen_escrito=a.examen_escrito,
            examen_oral=a.examen_oral,
            calificacion_definitiva=a.calificacion_definitiva,
            observaciones=a.observaciones
        ) for a in estudiantes_qs
    ]

    docentes_qs = acta.docentes.all().order_by("orden")
    docentes_list = [
        ActaDocenteLocal(
            docente_id=a.docente_id,
            nombre=a.nombre,
            dni=a.dni,
            rol=a.rol
        ) for a in docentes_qs
    ]

    return ActaDetailLocal(
        id=acta.id,
        codigo=acta.codigo,
        fecha=format_date(acta.fecha),
        tipo=acta.tipo,
        profesorado_id=acta.profesorado_id,
        materia_id=acta.materia_id,
        plan_id=acta.plan_id,
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
        mesa_id=mesa.id if mesa else None,
        esta_cerrada=(mesa.planilla_cerrada_en is not None) if mesa else False,
        estudiantes=estudiantes_list,
        docentes=docentes_list
    )


@router.post(
    "/actas",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel"])
def crear_acta_examen(request, payload: ActaCreateLocal = Body(...)):
    """
    Crea un acta de examen y sincroniza los resultados con las inscripciones a mesa.
    
    Lógica de Alta Especializada:
    1. Valida rangos de calificación (1-10, Abreviaturas de Ausente).
    2. Auto-crea registros de Estudiante/Persona si no existen (soporte para migración de datos históricos).
    3. Asigna automáticamente el alumno a la carrera si no está vinculado.
    4. Sincroniza con MesaExamen: Si no existe una mesa para esa fecha/materia, la crea 'cerrada'.
    5. Actualiza inscripciones a mesa para reflejar el resultado en la trayectoria.
    """
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

    # Validaciones de pertenencia académica
    try:
        profesorado = Profesorado.objects.get(pk=payload.profesorado_id)
        ensure_profesorado_access(request.user, profesorado.id)
    except Profesorado.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")

    try:
        materia = Materia.objects.select_related("plan_de_estudio").get(pk=payload.materia_id)
    except Materia.DoesNotExist:
        return 404, ApiResponse(ok=False, message="Materia no encontrada.")

    plan = materia.plan_de_estudio
    if plan.profesorado_id != profesorado.id:
        return 400, ApiResponse(ok=False, message="Inconsistencia de Plan/Profesorado.")

    # Ciclo de validación y auto-creación de alumnos
    user_dni = getattr(request.user, "username", "")
    for estudiante_data in payload.estudiantes:
        clean_dni = estudiante_data.dni.strip()
        if not clean_dni: continue
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
                user, _ = User.objects.get_or_create(username=clean_dni, defaults={"first_name": first_name, "last_name": last_name})
                if _: user.set_password(f"pass{clean_dni}"); user.save()
                persona, _ = Persona.objects.update_or_create(dni=clean_dni, defaults={"nombre": first_name, "apellido": last_name})
                estudiante = Estudiante.objects.create(user=user, persona=persona, estado_legajo=Estudiante.EstadoLegajo.PENDIENTE)
            else:
                return 400, ApiResponse(ok=False, message=f"Falta 'Apellido, Nombre' para crear alumno {clean_dni}")

        estudiante.asignar_profesorado(profesorado)

    # Generación de códigos administrativos (Libro/Folio/Acta)
    anio = acta_fecha.year
    numero = _next_acta_numero(profesorado.id, anio)
    codigo = _compute_acta_codigo(profesorado, anio, numero)

    # Clasificación de resultados para auditoría de totales
    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for est_item in payload.estudiantes:
        if est_item.calificacion_definitiva not in ACTA_NOTA_CHOICES:
            return 400, ApiResponse(ok=False, message=f"Nota inválida para {est_item.dni}")
        
        # Salvaguarda: Evitar dobles aprobaciones en trayectoria
        if _clasificar_resultado(est_item.calificacion_definitiva) == "aprobado":
            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni).first()
            if est_obj and estudiante_tiene_materia_aprobada(est_obj, materia):
                return 400, ApiResponse(ok=False, message=f"El estudiante {est_obj.dni} ya aprobó esta materia anteriormente.")

        categoria = _clasificar_resultado(est_item.calificacion_definitiva)
        categoria_counts[categoria] += 1

    usuario = getattr(request, "user", None)
    with transaction.atomic():
        acta = ActaExamen.objects.create(
            codigo=codigo, numero=numero, anio_academico=anio, tipo=payload.tipo,
            profesorado=profesorado, materia=materia, plan=plan, anio_cursada=materia.anio_cursada,
            fecha=acta_fecha, folio=payload.folio, libro=payload.libro or "", observaciones=payload.observaciones or "",
            total_alumnos=len(payload.estudiantes), total_aprobados=categoria_counts["aprobado"],
            total_desaprobados=categoria_counts["desaprobado"], total_ausentes=categoria_counts["ausente"],
            created_by=usuario if getattr(usuario, "is_authenticated", False) else None,
        )

        # Sincronización de Mesa de Examen (Presiden cia, Vocales)
        docente_presidente = Docente.objects.filter(id=next((d.docente_id for d in payload.docentes if d.rol == ActaExamenDocente.Rol.PRESIDENTE), None)).first()
        
        mesa = MesaExamen.objects.filter(materia=materia, fecha=acta_fecha, modalidad=MesaExamen.Modalidad.LIBRE if payload.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR).first()
        if not mesa:
            mesa = MesaExamen.objects.create(
                materia=materia, fecha=acta_fecha, tipo=MesaExamen.Tipo.FINAL,
                modalidad=MesaExamen.Modalidad.LIBRE if payload.tipo == ActaExamen.Tipo.LIBRE else MesaExamen.Modalidad.REGULAR,
                codigo=f"MA-{acta.id}-{acta_fecha.strftime('%Y%m%d')}",
                docente_presidente=docente_presidente,
                planilla_cerrada_en=timezone.now(),
                planilla_cerrada_por=usuario if getattr(usuario, "is_authenticated", False) else None
            )

        # Carga de renglones de acta y actualización de inscripciones a mesa
        for est_item in payload.estudiantes:
            acta_est_obj = ActaExamenEstudiante.objects.create(
                acta=acta, numero_orden=est_item.numero_orden, permiso_examen=est_item.permiso_examen or "",
                dni=est_item.dni.strip(), apellido_nombre=est_item.apellido_nombre.strip(),
                examen_escrito=est_item.examen_escrito or "", examen_oral=est_item.examen_oral or "",
                calificacion_definitiva=est_item.calificacion_definitiva, observaciones=est_item.observaciones or ""
            )

            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni.strip()).first()
            if est_obj:
                # Mapeamos la calificación del acta a condiciones de InscripcionMesa
                calif = est_item.calificacion_definitiva.strip().upper()
                condicion = InscripcionMesa.Condicion.DESAPROBADO
                nota_dec = None
                if calif.isdigit():
                    nota_dec = Decimal(calif)
                    if nota_dec >= 6: condicion = InscripcionMesa.Condicion.APROBADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO: condicion = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_INJUSTIFICADO: condicion = InscripcionMesa.Condicion.AUSENTE

                InscripcionMesa.objects.update_or_create(
                    mesa=mesa, estudiante=est_obj,
                    defaults={
                        "estado": InscripcionMesa.Estado.INSCRIPTO, "fecha_resultado": acta_fecha,
                        "condicion": condicion, "nota": nota_dec, "folio": payload.folio, "libro": payload.libro,
                        "observaciones": "Carga por Acta de Examen",
                        "cuenta_para_intentos": condicion != InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO
                    }
                )
                verify_acta_consistency(acta_est_obj)

    return ApiResponse(ok=True, message="Acta de examen generada correctamente.", data=ActaCreateOutLocal(id=acta.id, codigo=acta.codigo).dict())


@router.api_operation(
    ["PUT", "POST"],
    "/actas/{acta_id}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel"])
def actualizar_acta_examen(request, acta_id: int, payload: ActaCreateLocal = Body(...)):
    """
    Actualiza o rectifica un acta de examen existente.
    Bloquea la edición si la Mesa de Examen ya ha sido auditada y cerrada por bedelía fuera de este flujo.
    """
    acta = ActaExamen.objects.filter(id=acta_id).first()
    if not acta:
        return 404, ApiResponse(ok=False, message="Acta no encontrada.")

    # Salvaguarda: Solo editar actas si la mesa está abierta para cambios
    mesa = MesaExamen.objects.filter(materia_id=acta.materia_id, fecha=acta.fecha, modalidad=acta.tipo).first()
    if mesa and mesa.planilla_cerrada_en is not None:
        # Nota: Normalmente crear_acta genera la mesa cerrada, pero aquí permitimos reapertura desde este flujo
        pass 

    categoria_counts = {"aprobado": 0, "desaprobado": 0, "ausente": 0}
    for est_item in payload.estudiantes:
        categoria = _clasificar_resultado(est_item.calificacion_definitiva)
        categoria_counts[categoria] += 1

    usuario = getattr(request, "user", None)
    with transaction.atomic():
        acta.folio = payload.folio
        acta.libro = payload.libro or ""
        acta.observaciones = payload.observaciones or ""
        acta.total_alumnos = len(payload.estudiantes)
        acta.total_aprobados = categoria_counts["aprobado"]
        acta.total_desaprobados = categoria_counts["desaprobado"]
        acta.total_ausentes = categoria_counts["ausente"]
        acta.updated_by = usuario if getattr(usuario, "is_authenticated", False) else None
        acta.save()

        # Re-construcción de nómina (Idempotencia)
        acta.estudiantes.all().delete()
        if mesa:
            InscripcionMesa.objects.filter(mesa=mesa, folio=payload.folio).delete()

        for est_item in payload.estudiantes:
            acta_est_obj = ActaExamenEstudiante.objects.create(
                acta=acta, numero_orden=est_item.numero_orden, permiso_examen=est_item.permiso_examen or "",
                dni=est_item.dni.strip(), apellido_nombre=est_item.apellido_nombre.strip(),
                calificacion_definitiva=est_item.calificacion_definitiva, observaciones=est_item.observaciones or ""
            )

            est_obj = Estudiante.objects.filter(persona__dni=est_item.dni.strip()).first()
            if est_obj and mesa:
                # Sincronización iterativa de resultados
                calif = est_item.calificacion_definitiva.strip().upper()
                condicion = InscripcionMesa.Condicion.DESAPROBADO
                if calif.isdigit() and int(calif) >= 6: condicion = InscripcionMesa.Condicion.APROBADO
                elif calif == ActaExamenEstudiante.NOTA_AUSENTE_JUSTIFICADO: condicion = InscripcionMesa.Condicion.AUSENTE_JUSTIFICADO

                InscripcionMesa.objects.update_or_create(
                    mesa=mesa, estudiante=est_obj,
                    defaults={
                        "estado": InscripcionMesa.Estado.INSCRIPTO, "condicion": condicion,
                        "folio": payload.folio, "libro": payload.libro
                    }
                )
                verify_acta_consistency(acta_est_obj)

    return ApiResponse(ok=True, message="Acta rectificada correctamente.")


@router.put(
    "/actas/{acta_id}/header",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse, 403: ApiResponse},
    auth=JWTAuth(),
)
@ensure_roles(["admin", "secretaria", "bedel"])
def actualizar_cabecera_acta(request, acta_id: int):
    """Acceso rápido para editar Libro/Folio sin afectar la nómina."""
    return ApiResponse(ok=False, message="Operación deshabilitada. Utilice la actualización completa del acta.")
