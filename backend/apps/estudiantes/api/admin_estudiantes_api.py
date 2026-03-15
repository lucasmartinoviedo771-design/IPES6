from __future__ import annotations

from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.common.api_schemas import ApiResponse
from core.models import Estudiante, EstudianteCarrera
from core.permissions import allowed_profesorados, ensure_roles, ensure_profesorado_access
from apps.common.date_utils import format_datetime

from ..schemas import (
    EstudianteAdminDetail,
    EstudianteAdminListItem,
    EstudianteAdminListResponse,
    EstudianteAdminUpdateIn,
    EstudianteDocumentacionListItem,
    EstudianteDocumentacionListResponse,
    EstudianteDocumentacionUpdateIn,
    EstudianteDocumentacionBulkUpdateIn,
)
from .router import estudiantes_router as router
from ..services.estudiante_service import EstudianteService
from .helpers import (
    _ensure_admin,
    _apply_estudiante_updates,
    _build_admin_detail,
)


@router.get(
    "/admin/estudiantes",
    response=EstudianteAdminListResponse,
)
def admin_list_estudiantes(
    request,
    q: str | None = None,
    carrera_id: int | None = None,
    estado_legajo: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _ensure_admin(request)
    filters = {"q": q, "carrera_id": carrera_id, "estado_legajo": estado_legajo}
    return EstudianteService.list_estudiantes_admin(filters, limit, offset)


@router.get(
    "/admin/estudiantes-documentacion",
    response=EstudianteDocumentacionListResponse,
)
def admin_list_estudiantes_documentacion(
    request,
    q: str | None = None,
    carrera_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
):
    _ensure_admin(request)
    data = _get_estudiantes_documentacion_raw(request, q=q, carrera_id=carrera_id)
    
    total = len(data)
    items = data[offset : offset + limit] if limit else data[offset:]
    
    return EstudianteDocumentacionListResponse(total=total, items=items)


def _get_estudiantes_documentacion_raw(request, q=None, carrera_id=None):
    from core.models import PreinscripcionChecklist

    
    allowed_ids = allowed_profesorados(request.user)
    qs = (
        Estudiante.objects.select_related("persona", "user")
        .prefetch_related("carreras")
        .order_by("persona__apellido", "persona__nombre", "persona__dni")
    )
    
    if q:
        q_clean = q.strip()
        if q_clean:
            qs = qs.filter(
                Q(persona__dni__icontains=q_clean)
                | Q(persona__nombre__icontains=q_clean)
                | Q(persona__apellido__icontains=q_clean)
                | Q(user__first_name__icontains=q_clean)
                | Q(user__last_name__icontains=q_clean)
            )
    
    if carrera_id:
        if allowed_ids is not None and int(carrera_id) not in allowed_ids:
            qs = qs.none()
        else:
            qs = qs.filter(carreras__id=carrera_id)
    elif allowed_ids is not None:
        qs = qs.filter(carreras__id__in=allowed_ids)

    qs = qs.distinct()
    estudiantes_list = list(qs)
    estudiante_ids = [e.id for e in estudiantes_list]

    checklists = PreinscripcionChecklist.objects.filter(
        preinscripcion__alumno_id__in=estudiante_ids
    ).select_related("preinscripcion__alumno").order_by("-updated_at")
    
    checklist_map = {}
    for cl in checklists:
        if cl.preinscripcion.alumno_id not in checklist_map:
            checklist_map[cl.preinscripcion.alumno_id] = cl

    items = []
    from .helpers import _determine_condicion, _extract_documentacion
    
    for est in estudiantes_list:
        user = est.user if est.user_id else None
        datos_extra = est.datos_extra or {}
        doc_data = _extract_documentacion(datos_extra)
        
        cl = checklist_map.get(est.id)
        if cl:
            cl_fields = {
                "dni_legalizado": cl.dni_legalizado,
                "fotos_4x4": cl.fotos_4x4,
                "certificado_salud": cl.certificado_salud,
                "folios_oficio": cl.folios_oficio,
                "titulo_secundario_legalizado": cl.titulo_secundario_legalizado,
                "certificado_titulo_en_tramite": cl.certificado_titulo_en_tramite,
                "analitico_legalizado": cl.analitico_legalizado,
                "articulo_7": cl.articulo_7,
            }
            for k, v in cl_fields.items():
                if doc_data.get(k) in (None, False, 0, ""):
                    doc_data[k] = v
        
        condicion = _determine_condicion(doc_data)
        titulo_sec_ok = any([
            doc_data.get("titulo_secundario_legalizado"),
            doc_data.get("certificado_titulo_en_tramite"),
            doc_data.get("analitico_legalizado")
        ])

        items.append(
            EstudianteDocumentacionListItem(
                dni=est.dni,
                apellido=user.last_name if user else "",
                nombre=user.first_name if user else "",
                condicion_administrativa=condicion,
                curso_introductorio_aprobado=bool(datos_extra.get("curso_introductorio_aprobado", est.curso_introductorio_aprobado)),
                libreta_entregada=bool(datos_extra.get("libreta_entregada")),
                dni_legalizado=bool(doc_data.get("dni_legalizado")),
                fotos_4x4=bool(doc_data.get("fotos_4x4")),
                certificado_salud=bool(doc_data.get("certificado_salud")),
                folios_oficio=int(doc_data.get("folios_oficio") or 0),
                titulo_secundario_ok=titulo_sec_ok,
                articulo_7=bool(doc_data.get("articulo_7")),
            )
        )
    return items


@router.get("/admin/estudiantes-documentacion/export/excel")
def admin_export_estudiantes_documentacion_excel(request, q: str | None = None, carrera_id: int | None = None):
    _ensure_admin(request)
    items = _get_estudiantes_documentacion_raw(request, q=q, carrera_id=carrera_id)
    
    import openpyxl
    from openpyxl.styles import Font, Alignment
    from django.http import HttpResponse
    from io import BytesIO

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Documentación"

    headers = [
        "DNI", "Apellido", "Nombre", "Condición", "CI", "Libreta", 
        "DNI (F.)", "Fotos", "Cert. Salud", "Folios", "Título Sec.", "Art. 7mo"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True)
        cell.alignment = Alignment(horizontal="center")

    for idx, item in enumerate(items, 2):
        ws.cell(row=idx, column=1, value=item.dni)
        ws.cell(row=idx, column=2, value=item.apellido)
        ws.cell(row=idx, column=3, value=item.nombre)
        ws.cell(row=idx, column=4, value=item.condicion_administrativa)
        ws.cell(row=idx, column=5, value="SI" if item.curso_introductorio_aprobado else "NO")
        ws.cell(row=idx, column=6, value="SI" if item.libreta_entregada else "NO")
        ws.cell(row=idx, column=7, value="SI" if item.dni_legalizado else "NO")
        ws.cell(row=idx, column=8, value="SI" if item.fotos_4x4 else "NO")
        ws.cell(row=idx, column=9, value="SI" if item.certificado_salud else "NO")
        ws.cell(row=idx, column=10, value=item.folios_oficio)
        ws.cell(row=idx, column=11, value="SI" if item.titulo_secundario_ok else "NO")
        ws.cell(row=idx, column=12, value="SI" if item.articulo_7 else "NO")

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = 15

    output = BytesIO()
    wb.save(output)
    output.seek(0)

    response = HttpResponse(
        output.read(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = 'attachment; filename="estudiantes_documentacion.xlsx"'
    return response


@router.get("/admin/estudiantes-documentacion/export/pdf")
def admin_export_estudiantes_documentacion_pdf(request, q: str | None = None, carrera_id: int | None = None):
    _ensure_admin(request)
    items = _get_estudiantes_documentacion_raw(request, q=q, carrera_id=carrera_id)
    
    from django.template.loader import render_to_string
    from django.http import HttpResponse
    from weasyprint import HTML
    import datetime

    context = {
        "items": items,
        "fecha": format_datetime(datetime.datetime.now()),
        "q": q,
    }
    
    html_string = render_to_string("estudiantes/export_documentacion_pdf.html", context)
    pdf = HTML(string=html_string).write_pdf()

    response = HttpResponse(pdf, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="estudiantes_documentacion.pdf"'
    return response


def _perform_documentacion_update(est, payload):
    from core.models import PreinscripcionChecklist
    
    # Buscamos el último checklist
    checklist = PreinscripcionChecklist.objects.filter(preinscripcion__alumno=est).order_by("-updated_at").first()
    
    # Actualizamos datos_extra del estudiante (algunos campos viven ahí)
    datos_extra = est.datos_extra or {}
    updated_est = False
    
    upd_fields = []
    if payload.libreta_entregada is not None:
        est.libreta_entregada = payload.libreta_entregada
        upd_fields.append("libreta_entregada")
    
    if payload.curso_introductorio_aprobado is not None:
        est.curso_introductorio_aprobado = payload.curso_introductorio_aprobado
        upd_fields.append("curso_introductorio_aprobado")

    # Documentación técnica
    if payload.dni_legalizado is not None: 
        est.dni_legalizado = payload.dni_legalizado
        upd_fields.append("dni_legalizado")
    if payload.fotos_4x4 is not None: 
        est.fotos_4x4 = payload.fotos_4x4
        upd_fields.append("fotos_4x4")
    if payload.certificado_salud is not None: 
        est.certificado_salud = payload.certificado_salud
        upd_fields.append("certificado_salud")
    if payload.folios_oficio is not None: 
        est.folios_oficio = payload.folios_oficio
        upd_fields.append("folios_oficio")
    if payload.articulo_7 is not None: 
        est.articulo_7 = payload.articulo_7
        upd_fields.append("articulo_7")
    
    if payload.titulo_secundario_ok is not None:
        est.titulo_secundario_legalizado = payload.titulo_secundario_ok
        upd_fields.append("titulo_secundario_legalizado")

    if upd_fields:
        est.save(update_fields=upd_fields)
        
        if checklist:
            if payload.dni_legalizado is not None: checklist.dni_legalizado = payload.dni_legalizado
            if payload.fotos_4x4 is not None: checklist.fotos_4x4 = payload.fotos_4x4
            if payload.certificado_salud is not None: checklist.certificado_salud = payload.certificado_salud
            if payload.folios_oficio is not None: checklist.folios_oficio = payload.folios_oficio
            if payload.articulo_7 is not None: checklist.articulo_7 = payload.articulo_7
            if payload.titulo_secundario_ok is not None: checklist.titulo_secundario_legalizado = payload.titulo_secundario_ok
            if payload.curso_introductorio_aprobado is not None:
                checklist.curso_introductorio_aprobado = payload.curso_introductorio_aprobado
            checklist.save()


@router.patch(
    "/admin/estudiantes-documentacion/{dni}",
    response=ApiResponse,
)
def admin_update_estudiante_documentacion(
    request,
    dni: str,
    payload: EstudianteDocumentacionUpdateIn,
):
    _ensure_admin(request)

    
    est = get_object_or_404(Estudiante, persona__dni=dni)
    
    # Verificación de permisos para Bedeles: deben tener acceso a al menos una carrera del estudiante
    allowed_ids = allowed_profesorados(request.user)
    if allowed_ids is not None:
        est_carreras_ids = set(EstudianteCarrera.objects.filter(estudiante=est).values_list("profesorado_id", flat=True))
        if not allowed_ids.intersection(est_carreras_ids):
            from apps.common.errors import raise_app_error
            from apps.common.constants import AppErrorCode
            raise_app_error(403, AppErrorCode.PERMISSION_DENIED, "No tiene permisos para modificar la documentación de este estudiante.")

    _perform_documentacion_update(est, payload)
        
    return ApiResponse(ok=True, message="Documentación actualizada correctamente.")


@router.patch(
    "/admin/estudiantes-documentacion-bulk",
    response=ApiResponse,
)
def admin_bulk_update_estudiante_documentacion(
    request,
    payload: EstudianteDocumentacionBulkUpdateIn,
):
    _ensure_admin(request)

    
    allowed_ids = allowed_profesorados(request.user)
    
    updated_count = 0
    for update_item in payload.updates:
        est = Estudiante.objects.filter(persona__dni=update_item.dni).first()
        if not est:
            continue
            
        if allowed_ids is not None:
            est_carreras_ids = set(EstudianteCarrera.objects.filter(estudiante=est).values_list("profesorado_id", flat=True))
            if not allowed_ids.intersection(est_carreras_ids):
                continue
        
        _perform_documentacion_update(est, update_item.changes)
        updated_count += 1
        
    return ApiResponse(ok=True, message=f"Se actualizaron {updated_count} estudiantes.")


@router.get(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 404: ApiResponse},
)
def admin_get_estudiante(request, dni: str):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")
    return _build_admin_detail(est)


@router.put(
    "/admin/estudiantes/{dni}",
    response={200: EstudianteAdminDetail, 400: ApiResponse, 404: ApiResponse},
)
def admin_update_estudiante(request, dni: str, payload: EstudianteAdminUpdateIn):
    _ensure_admin(request)
    est = Estudiante.objects.select_related("user").prefetch_related("carreras").filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    updated, error = _apply_estudiante_updates(
        est,
        payload,
        allow_estado_legajo=True,
        allow_force_password=True,
    )
    if not updated and error:
        status_code, api_resp = error
        return status_code, api_resp

    return _build_admin_detail(est)


@router.delete(
    "/admin/estudiantes/{dni}",
    response={200: ApiResponse, 400: ApiResponse, 404: ApiResponse},
)
def admin_delete_estudiante(request, dni: str):
    _ensure_admin(request)
    # Buscamos por DNI
    est = Estudiante.objects.filter(persona__dni=dni).first()
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado")

    # --- Verificaciones de actividad previa ---
    reasons = []

    # 1. Inscripciones a materias confirmadas o pendientes
    ins_count = est.inscripciones_materia.exclude(estado="ANUL").count()
    if ins_count > 0:
        ejemplos = list(est.inscripciones_materia.exclude(estado="ANUL")[:2].values_list("materia__nombre", flat=True))
        txt_ej = f" (ej: {', '.join(ejemplos)})" if ejemplos else ""
        reasons.append(f"Tiene {ins_count} inscripciones activas a materias{txt_ej}.")

    # 2. Regularidades cargadas
    reg_count = est.regularidades.count()
    if reg_count > 0:
        ejemplos = list(est.regularidades.all()[:2].values_list("materia__nombre", flat=True))
        txt_ej = f" (ej: {', '.join(ejemplos)})" if ejemplos else ""
        reasons.append(f"Tiene {reg_count} notas de cursada/regularidades{txt_ej}.")

    # 3. Inscripciones a mesas o exámenes
    mesas_count = est.inscripciones_mesa.count()
    if mesas_count > 0:
        reasons.append(f"Tiene {mesas_count} inscripciones a mesas de examen.")

    # 4. Actas de examen históricas (por DNI)
    from core.models import ActaExamenEstudiante
    actas_count = ActaExamenEstudiante.objects.filter(dni=dni).count()
    if actas_count > 0:
        reasons.append(f"Figura en {actas_count} actas de examen históricas.")

    # 5. Preinscripción activa
    from core.models import Preinscripcion
    pre = Preinscripcion.objects.filter(alumno=est).first()
    if pre and pre.estado not in ["ANULADA"]:
        reasons.append(f"Tiene una preinscripción activa ({pre.codigo}) en estado {pre.get_estado_display()}.")

    if reasons:
        msg = "No se puede eliminar al estudiante porque ya tiene actividad en el sistema: " + " ".join(reasons)
        return 400, ApiResponse(ok=False, message=msg)

    # --- Fin verificaciones ---

    nombre_completo = str(est)
    user = est.user

    # Al borrar el estudiante, se borran en cascada sus relaciones (EstudianteCarrera, etc.)
    # Las que no bloqueamos arriba pero podrían existir (ej. mensajes, notificaciones).
    est.delete()

    # Si el usuario no tiene otros roles (como staff o docente), lo borramos también para limpiar.
    if user and not (user.is_staff or user.groups.filter(name__in=["docente", "bedel", "admin"]).exists()):
        user.delete()

    return 200, ApiResponse(ok=True, message=f"Estudiante {nombre_completo} eliminado correctamente")
