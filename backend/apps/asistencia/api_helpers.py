from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import List

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from django.db.models import Count, Q, Case, When, Value, CharField, F
from ninja import Router
from ninja.errors import HttpError

from core.models import (
    Comision,
    Docente,
    Estudiante,
    PlanDeEstudio,
    Profesorado,
    Turno,
    StaffAsignacion,
)
from core.permissions import (
    allowed_profesorados,
    ensure_profesorado_access,
    ensure_roles,
    get_user_roles,
)
from apps.docentes.services.docente_service import DocenteService
from core.auth_ninja import JWTAuth

from .models import (
    AsistenciaEstudiante,
    AsistenciaDocente,
    ClaseProgramada,
    CalendarioAsistenciaEvento,
    CursoEstudianteSnapshot,
    DocenteMarcacionLog,
    Justificacion,
)
from apps.common.date_utils import format_date, format_datetime
from .schemas import (
    EstudianteResumenOut,
    EstudianteClasesResponse,
    EstudianteClaseListadoOut,
    AsistenciaCalendarioEventoIn,
    AsistenciaCalendarioEventoOut,
    ClaseEstudianteDetalleOut,
    DocenteClasesResponse,
    DocenteHistorialOut,
    DocenteInfoOut,
    DocenteClaseOut,
    DocenteMarcarPresenteIn,
    DocenteMarcarPresenteOut,
    DocenteDniLogIn,
    RegistrarAsistenciaEstudiantesIn,
    JustificacionCreateIn,
    JustificacionDetailOut,
    JustificacionListItemOut,
    JustificacionOut,
    JustificacionRechazarIn,
    EstudianteAsistenciaItemOut,
)
from .services import (
    apply_justification,
    attach_classes_to_justification,
    calcular_ventanas_turno,
    generate_classes_for_date,
    generate_classes_for_range,
    registrar_log_docente,
    sync_course_snapshots,
)

# Common Roles
STRUCTURE_VIEW_ROLES = {"admin", "secretaria", "bedel", "coordinador", "tutor", "jefes", "jefa_aaee", "consulta"}
STRUCTURE_EDIT_ROLES = {"admin", "secretaria", "bedel"}

def _staff_profesorados(user, roles: set[str]) -> set[int]:
    if not user or not user.is_authenticated:
        return set()
    if not roles & {"bedel", "coordinador", "tutor"}:
        return set()
    asignaciones = StaffAsignacion.objects.filter(
        user=user,
        rol__in=[rol for rol in StaffAsignacion.Rol.values if rol in roles],
    )
    return set(asignaciones.values_list("profesorado_id", flat=True))

def _get_profesorado_id_from_comision(comision: Comision) -> int | None:
    materia = getattr(comision, "materia", None)
    if not materia:
        return None
    plan = getattr(materia, "plan_de_estudio", None)
    if not plan:
        return None
    return plan.profesorado_id

def _resolve_scope(request: HttpRequest) -> tuple[set[str], set[int], Docente | None]:
    user = getattr(request, "user", None)
    roles = get_user_roles(user)
    staff_profesorados = _staff_profesorados(user, roles)
    docente_profile = DocenteService.get_docente_from_user(user)
    return roles, staff_profesorados, docente_profile

def _ensure_authenticated_scope(roles: set[str], docente_profile: Docente | None):
    if not roles and not docente_profile:
        raise HttpError(401, "Autenticación requerida.")

def _scope_profesorado_ids(scope: dict[str, object | None]) -> set[int]:
    ids: set[int] = set()
    profesorado = scope.get("profesorado")
    if profesorado:
        ids.add(profesorado.id)
    plan = scope.get("plan")
    if plan:
        ids.add(plan.profesorado_id)
    comision = scope.get("comision")
    if comision:
        materia = getattr(comision, "materia", None)
        if materia and getattr(materia, "plan_de_estudio", None):
            ids.add(materia.plan_de_estudio.profesorado_id)
    return ids

def _calendario_queryset_with_scope(
    queryset,
    roles: set[str],
    staff_profesorados: set[int],
    docente_profile: Docente | None,
):
    if roles & {"admin", "secretaria"}:
        return queryset
    filters = Q()
    if staff_profesorados:
        filters |= Q(profesorado_id__in=staff_profesorados)
        filters |= Q(plan__profesorado_id__in=staff_profesorados)
        filters |= Q(comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados)
    if docente_profile:
        filters |= Q(docente=docente_profile) | Q(comision__docente=docente_profile)
    filters |= Q(profesorado__isnull=True, plan__isnull=True, comision__isnull=True)
    if filters == Q(profesorado__isnull=True, plan__isnull=True, comision__isnull=True):
        raise HttpError(403, "No tenes permisos suficientes para consultar el calendario.")
    return queryset.filter(filters).distinct()

def _ensure_calendar_manage_scope(
    roles: set[str],
    staff_profesorados: set[int],
    scope: dict[str, object | None],
) -> None:
    if roles & {"admin", "secretaria"}:
        return
    if "bedel" in roles:
        if not staff_profesorados:
            raise HttpError(403, "No tenes profesorados asignados.")
        target_ids = _scope_profesorado_ids(scope)
        if not target_ids:
            raise HttpError(403, "Los bedeles solo pueden gestionar eventos asociados a un profesorado, plan o comision.")
        if not target_ids.issubset(staff_profesorados):
            raise HttpError(403, "No tenes permisos sobre el profesorado indicado.")
        return
    raise HttpError(403, "No tenes permisos para gestionar eventos de asistencia.")

def _turno_to_dict(turno: Turno | None) -> tuple[int | None, str | None]:
    if not turno:
        return None, None
    return turno.id, turno.nombre

def _docente_to_dict(docente: Docente | None) -> tuple[int | None, str | None]:
    if not docente:
        return None, None
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part).strip() or docente.dni
    return docente.id, nombre

def _resolver_event_scope(payload: AsistenciaCalendarioEventoIn):
    comision = None
    plan = None
    profesorado = None
    if getattr(payload, "comision_id", None):
        comision = (
            Comision.objects.select_related("materia__plan_de_estudio__profesorado")
            .filter(id=payload.comision_id)
            .first()
        )
        if not comision:
            raise HttpError(404, "La comisión indicada no existe.")
        materia = getattr(comision, "materia", None)
        if materia and materia.plan_de_estudio_id:
            plan = materia.plan_de_estudio
            profesorado = plan.profesorado
    if getattr(payload, "plan_id", None):
        plan_lookup = (
            PlanDeEstudio.objects.select_related("profesorado").filter(id=payload.plan_id).first()
        )
        if not plan_lookup:
            raise HttpError(404, "El plan de estudio indicado no existe.")
        if plan and plan.id != plan_lookup.id:
            raise HttpError(400, "La comisión seleccionada pertenece a otro plan de estudio.")
        plan = plan_lookup
        profesorado = plan.profesorado
    if getattr(payload, "profesorado_id", None):
        profes_lookup = Profesorado.objects.filter(id=payload.profesorado_id).first()
        if not profes_lookup:
            raise HttpError(404, "El profesorado indicado no existe.")
        if profesorado and profesorado.id != profes_lookup.id:
            raise HttpError(400, "El profesorado no coincide con el plan/comisión seleccionados.")
        profesorado = profes_lookup
    docente = None
    if getattr(payload, "docente_id", None):
        docente = Docente.objects.filter(id=payload.docente_id).first()
        if not docente:
            raise HttpError(404, "El docente indicado no existe.")
    return {"comision": comision, "plan": plan, "profesorado": profesorado, "docente": docente}

def _evento_to_schema(evento: CalendarioAsistenciaEvento) -> AsistenciaCalendarioEventoOut:
    profesorado_nombre = evento.profesorado.nombre if evento.profesorado_id else None
    plan_resolucion = evento.plan.resolucion if evento.plan_id else None
    comision_nombre = evento.comision.codigo if evento.comision_id else None
    return AsistenciaCalendarioEventoOut(
        id=evento.id,
        nombre=evento.nombre,
        tipo=evento.tipo,
        subtipo=evento.subtipo or "",
        fecha_desde=format_date(evento.fecha_desde),
        fecha_hasta=format_date(evento.fecha_hasta),
        turno_id=evento.turno_id,
        turno_nombre=evento.turno.nombre if evento.turno_id else None,
        profesorado_id=evento.profesorado_id,
        profesorado_nombre=evento.profesorado.nombre if evento.profesorado_id else None,
        plan_id=evento.plan_id,
        plan_resolucion=evento.plan.resolucion if evento.plan_id else None,
        comision_id=evento.comision_id,
        comision_nombre=evento.comision.codigo if evento.comision_id else None,
        docente_id=evento.docente_id,
        docente_nombre=str(evento.docente) if evento.docente_id else None,
        aplica_docentes=evento.aplica_docentes,
        aplica_estudiantes=evento.aplica_estudiantes,
        motivo=evento.motivo,
        activo=evento.activo,
        creado_en=format_datetime(evento.creado_en),
    )

def _build_horario(hora_inicio, hora_fin) -> str | None:
    if hora_inicio and hora_fin:
        return f"{hora_inicio.strftime('%H:%M')} a {hora_fin.strftime('%H:%M')}"
    if hora_inicio:
        return f"{hora_inicio.strftime('%H:%M')}"
    return None

def _calcular_ventanas(clase: ClaseProgramada):
    data = calcular_ventanas_turno(clase)
    if not data:
        return None, None, None, ""
    return data

def _docente_nombre(docente: Docente) -> str:
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part).strip()
    return nombre or docente.dni

def _justificacion_queryset_with_scope(
    queryset,
    roles: set[str],
    staff_profesorados: set[int],
    docente_profile: Docente | None,
    *,
    for_manage: bool = False,
):
    if roles & {"admin", "secretaria"}:
        return queryset
    if "bedel" in roles:
        if not staff_profesorados:
            raise HttpError(403, "No tenés profesorados asignados.")
        return queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados
        ).distinct()
    if "coordinador" in roles:
        if for_manage:
            raise HttpError(403, "Los coordinadores solo poseen acceso de lectura.")
        if not staff_profesorados:
            raise HttpError(403, "No tenés profesorados asignados.")
        return queryset.filter(
            detalles__clase__comision__materia__plan_de_estudio__profesorado_id__in=staff_profesorados
        ).distinct()
    if docente_profile:
        if for_manage:
            raise HttpError(403, "Los docentes no pueden gestionar justificaciones.")
        return queryset.filter(
            Q(detalles__docente=docente_profile) | Q(detalles__clase__comision__docente=docente_profile)
        ).distinct()
    raise HttpError(403, "No tenés permisos para operar sobre justificaciones.")

def _estudiante_display(estudiante: Estudiante | None) -> str | None:
    if not estudiante:
        return None
    user = getattr(estudiante, "user", None)
    if user:
        full_name = user.get_full_name().strip()
        if full_name:
            return full_name
        if user.username:
            return user.username
    return getattr(estudiante.persona, "dni", None) if estudiante.persona else None

def _docente_display(docente: Docente | None) -> str | None:
    if not docente:
        return None
    partes = [docente.apellido or "", docente.nombre or ""]
    nombre = " ".join(part.strip() for part in partes if part.strip()).strip()
    return nombre or docente.dni

def _user_display(user) -> str | None:
    if not user:
        return None
    full_name = user.get_full_name().strip()
    return full_name or user.username

def _serialize_justificacion_summary(justificacion: Justificacion) -> JustificacionListItemOut:
    detalles = list(justificacion.detalles.all())
    comision = next((d.clase.comision for d in detalles if d.clase_id and d.clase.comision_id), None)
    materia = comision.materia if comision else None
    profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio_id else None
    estudiante_ref = next((d.estudiante for d in detalles if d.estudiante_id), None)
    docente_ref = next((d.docente for d in detalles if d.docente_id), None)
    return JustificacionListItemOut(
        id=justificacion.id,
        tipo=justificacion.tipo,
        estado=justificacion.estado,
        origen=justificacion.origen,
        motivo=justificacion.motivo,
        vigencia_desde=format_date(justificacion.vigencia_desde),
        vigencia_hasta=format_date(justificacion.vigencia_hasta),
        comision_id=comision.id if comision else None,
        comision=comision.codigo if comision else None,
        materia=materia.nombre if materia else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado=profesorado.nombre if profesorado else None,
        estudiante_id=estudiante_ref.id if estudiante_ref else None,
        estudiante=_estudiante_display(estudiante_ref),
        docente_id=docente_ref.id if docente_ref else None,
        docente=_docente_display(docente_ref),
        creado_en=format_datetime(justificacion.creado_en),
        aprobado_en=format_datetime(justificacion.aprobado_en),
    )

def _serialize_justificacion_detail(justificacion: Justificacion) -> JustificacionDetailOut:
    detalles = list(justificacion.detalles.all())
    detalles_out = []
    for d in detalles:
        detalles_out.append(
            {
                "id": d.id,
                "clase_id": d.clase_id,
                "clase_fecha": d.clase.fecha if d.clase_id else None,
                "clase_horario": _build_horario(d.clase.hora_inicio, d.clase.hora_fin) if d.clase_id else None,
                "estudiante_id": d.estudiante_id,
                "estudiante": _estudiante_display(d.estudiante),
                "docente_id": d.docente_id,
                "docente": _docente_display(d.docente),
            }
        )
    comision = next((d.clase.comision for d in detalles if d.clase_id and d.clase.comision_id), None)
    materia = comision.materia if comision else None
    profesorado = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio_id else None
    estudiante_ref = next((d.estudiante for d in detalles if d.estudiante_id), None)
    docente_ref = next((d.docente for d in detalles if d.docente_id), None)
    
    return JustificacionDetailOut(
        id=justificacion.id,
        tipo=justificacion.tipo,
        estado=justificacion.estado,
        origen=justificacion.origen,
        motivo=justificacion.motivo,
        observaciones=justificacion.observaciones or None,
        archivo_url=justificacion.archivo_url or None,
        vigencia_desde=format_date(justificacion.vigencia_desde),
        vigencia_hasta=format_date(justificacion.vigencia_hasta),
        comision_id=comision.id if comision else None,
        comision=comision.codigo if comision else None,
        materia=materia.nombre if materia else None,
        profesorado_id=profesorado.id if profesorado else None,
        profesorado=profesorado.nombre if profesorado else None,
        estudiante_id=estudiante_ref.id if estudiante_ref else None,
        estudiante=_estudiante_display(estudiante_ref),
        docente_id=docente_ref.id if docente_ref else None,
        docente=_docente_display(docente_ref),
        creado_en=format_datetime(justificacion.creado_en),
        creado_por=_user_display(justificacion.creado_por),
        aprobado_en=format_datetime(justificacion.aprobado_en),
        aprobado_por=_user_display(justificacion.aprobado_por),
        detalles=detalles_out,
    )
