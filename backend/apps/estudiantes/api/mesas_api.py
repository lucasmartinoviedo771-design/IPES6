"""
API de Mesas de Examen.
Gestiona el catálogo de mesas de examen final y el proceso de inscripción para alumnos.

Reglas Generales de Examen:
1. Condición de Alumno: El alumno debe tener legajo 'COMPLETO' o permiso condicional (Título en trámite).
2. Modalidad Regular: Requiere cursada aprobada y vigente (2 años + 1 llamado). Límite de 3 intentos fallidos.
3. Modalidad Libre: Permite rendir sin regularidad previa, siempre que no esté cursando la materia o tenga regularidad vigente.
4. Correlatividades: Verifica el cumplimiento de materias aprobadas requeridas para rendir el final.
"""

from __future__ import annotations
from datetime import date
from django.contrib.auth.models import AnonymousUser
from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    Correlatividad,
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    PlanDeEstudio,
    Preinscripcion,
    Profesorado,
    Regularidad,
    InscripcionMateriaEstudiante,
)
from apps.common.date_utils import format_date, format_datetime
from ..schemas import InscripcionMesaIn, InscripcionMesaOut, MesaExamenIn, MesaExamenOut
from .helpers import (
    _correlatividades_qs,
    _ensure_estudiante_access,
    _listar_carreras_detalle,
    _resolve_estudiante,
)
from .router import estudiantes_router

MESA_TIPOS_ORDINARIOS = (MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL)


@estudiantes_router.get(
    "/mesas",
    response={200: list[dict], 400: ApiResponse, 403: ApiResponse, 404: ApiResponse},
    auth=JWTAuth(),
)
def listar_mesas_estudiante(
    request,
    tipo: str | None = None,
    ventana_id: int | None = None,
    dni: str | None = None,
    solo_rendibles: bool = False,
    profesorado_id: int | None = None,
    plan_id: int | None = None,
):
    """
    Lista las mesas de examen disponibles según los criterios de búsqueda y perfil del alumno.
    
    Lógica de visualización:
    - Personal (Bedeles/Admin): Ven todas las mesas (pasadas y futuras).
    - Alumnos: Solo ven mesas futuras dentro de una 'VentanaHabilitacion' activa de tipo MESAS.
    - Filtro 'solo_rendibles': Realiza una pre-validación académica pesada para mostrar solo las mesas 
      en las que el alumno realmente cumple con las condiciones administrativas (vigencia y correlatividad).
    """
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    carreras_est = list(est.carreras.all()) if est else []

    plan_obj: PlanDeEstudio | None = None
    plan_profesorado: Profesorado | None = None

    # Resolución de contexto académico (Plan/Carrera)
    if plan_id is not None:
        plan_obj = PlanDeEstudio.objects.select_related("profesorado").filter(id=plan_id).first()
        if not plan_obj:
            return 404, ApiResponse(ok=False, message="Plan de estudio no encontrado.")
        plan_profesorado = plan_obj.profesorado
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El alumno no pertenece a este plan.")
    elif profesorado_id is not None:
        plan_profesorado = Profesorado.objects.filter(id=profesorado_id).first()
        if not plan_profesorado:
            return 404, ApiResponse(ok=False, message="Profesorado no encontrado.")
        if est and plan_profesorado not in carreras_est:
            return 403, ApiResponse(ok=False, message="El alumno no pertenece a esta carrera.")
    else:
        if est:
            if not carreras_est:
                return 400, ApiResponse(ok=False, message="El estudiante no tiene ninguna carrera asignada.")
            if len(carreras_est) > 1:
                return 400, ApiResponse(
                    ok=False,
                    message="Múltiples carreras detectadas. Seleccione una.",
                    data={"carreras": _listar_carreras_detalle(est, carreras_est)},
                )
            plan_profesorado = carreras_est[0]

    qs = MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").all()

    # Restricciones para Alumnos
    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    es_staff = _user_has_roles(request.user, ADMIN_ALLOWED_ROLES)

    if not es_staff:
        qs = qs.filter(fecha__gte=date.today())
        if not ventana_id:
            from core.models import VentanaHabilitacion
            ventanas_activas = VentanaHabilitacion.objects.filter(
                tipo__in=[VentanaHabilitacion.Tipo.MESAS_FINALES, VentanaHabilitacion.Tipo.MESAS_EXTRA, VentanaHabilitacion.Tipo.INSCRIPCION],
                activo=True,
                desde__lte=date.today(),
                hasta__gte=date.today()
            )
            qs = qs.filter(ventana__in=ventanas_activas)

    if tipo:
        qs = qs.filter(tipo=tipo)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if plan_obj:
        qs = qs.filter(materia__plan_de_estudio=plan_obj)
    elif plan_profesorado:
        qs = qs.filter(materia__plan_de_estudio__profesorado=plan_profesorado)

    out = []
    estudiante_para_rendir = est if solo_rendibles else None
    if solo_rendibles and not estudiante_para_rendir:
        if dni:
            estudiante_para_rendir = Estudiante.objects.filter(persona__dni=dni).first()
        elif not isinstance(request.user, AnonymousUser):
            estudiante_para_rendir = getattr(request.user, "estudiante", None)

    # Cache de estado académico para optimizar el filtro 'solo_rendibles'
    aprobadas_rendir_set = set()
    if estudiante_para_rendir:
        from core.models import ActaExamenEstudiante
        actas = ActaExamenEstudiante.objects.filter(persona__dni=estudiante_para_rendir.dni)
        for a in actas:
            if a.calificacion_definitiva or a.permiso_examen == "EQUIV":
                aprobadas_rendir_set.add(a.acta.materia_id)
        regs_aprob = Regularidad.objects.filter(
            estudiante=estudiante_para_rendir, 
            situacion__in=[Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO]
        )
        for r in regs_aprob:
            aprobadas_rendir_set.add(r.materia_id)

    # Procesamiento y validación fila a fila
    for m in qs.order_by("fecha", "hora_desde"):
        req_aprob = list(_correlatividades_qs(m.materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante_para_rendir).values_list("materia_correlativa_id", flat=True))
        
        row = {
            "id": m.id,
            "materia": {"id": m.materia_id, "nombre": m.materia.nombre, "anio": m.materia.anio_cursada},
            "tipo": m.tipo,
            "codigo": m.codigo,
            "fecha": format_date(m.fecha),
            "hora_desde": str(m.hora_desde) if m.hora_desde else None,
            "hora_hasta": str(m.hora_hasta) if m.hora_hasta else None,
            "aula": m.aula,
            "cupo": m.cupo,
            "correlativas_aprob": req_aprob,
            "plan_id": m.materia.plan_de_estudio_id if m.materia_id else None,
            "profesorado_id": (m.materia.plan_de_estudio.profesorado_id if m.materia_id and m.materia.plan_de_estudio_id else None),
        }
        
        if solo_rendibles and estudiante_para_rendir:
            # 1. Ya aprobada
            if m.materia_id in aprobadas_rendir_set:
                continue

            if m.tipo in MESA_TIPOS_ORDINARIOS:
                # 2. Legajo incompleto (Excepto certificado de título en trámite)
                legajo_ok = estudiante_para_rendir.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
                if not legajo_ok:
                    prof = m.materia.plan_de_estudio.profesorado if m.materia and m.materia.plan_de_estudio else None
                    pre = Preinscripcion.objects.filter(estudiante=estudiante_para_rendir, carrera=prof).order_by("-anio", "-id").first()
                    cl = getattr(pre, "checklist", None) if pre else None
                    if not (cl and cl.certificado_titulo_en_tramite):
                        continue
                
                # 3. Regularidad ausente
                reg = Regularidad.objects.filter(estudiante=estudiante_para_rendir, materia=m.materia).order_by("-fecha_cierre").first()
                if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                    continue

                # 4. Vigencia de regularidad (2 años + 1 llamado)
                def _add_years(d: date, years: int) -> date:
                    try: return d.replace(year=d.year + years)
                    except ValueError: return d.replace(month=2, day=28, year=d.year + years)

                two_years = _add_years(reg.fecha_cierre, 2)
                next_call = MesaExamen.objects.filter(materia=m.materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years).order_by("fecha").values_list("fecha", flat=True).first()
                allowed_until = next_call or two_years
                if m.fecha > allowed_until:
                    continue
                
                # 5. Límite de llamados (3 fallidos)
                intentos = InscripcionMesa.objects.filter(
                    estudiante=estudiante_para_rendir, estado=InscripcionMesa.Estado.INSCRIPTO,
                    mesa__materia=m.materia, mesa__tipo__in=MESA_TIPOS_ORDINARIOS,
                    mesa__fecha__gte=reg.fecha_cierre, mesa__fecha__lte=allowed_until,
                ).count()
                if intentos >= 3:
                    continue
                    
        out.append(row)
    return out


@estudiantes_router.post(
    "/inscribir_mesa",
    response={200: dict, 400: dict, 404: dict},
    auth=JWTAuth(),
)
def inscribir_mesa(request, payload: InscripcionMesaIn):
    """
    Registra formalmente la inscripción a una mesa de examen.
    Aplica todas las restricciones académicas según la modalidad (REGULAR o LIBRE).
    """
    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}
    mesa = MesaExamen.objects.select_related("materia__plan_de_estudio__profesorado").filter(id=payload.mesa_id).first()
    if not mesa:
        return 404, {"message": "Mesa no encontrada"}

    # --- LÓGICA PARA MODALIDAD REGULAR ---
    if mesa.modalidad == MesaExamen.Modalidad.REGULAR:
        if mesa.tipo in MESA_TIPOS_ORDINARIOS:
            # A. Estado de Legajo
            legajo_ok = est.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
            if not legajo_ok:
                prof = mesa.materia.plan_de_estudio.profesorado if mesa.materia and mesa.materia.plan_de_estudio else None
                pre = Preinscripcion.objects.filter(estudiante=est, carrera=prof).order_by("-anio", "-id").first()
                cl = getattr(pre, "checklist", None) if pre else None
                if not (cl and cl.certificado_titulo_en_tramite):
                    return 400, {"message": "Legajo incompleto o condicional: no puede rendir examen final."}

            # B. Materia ya superada
            from core.models import ActaExamenEstudiante
            if ActaExamenEstudiante.objects.filter(persona__dni=est.dni, acta__materia=mesa.materia).exists():
                 return 400, {"message": "La materia ya figura aprobada en su historial."}

            # C. Verificación de Regularidad Vigente
            reg = Regularidad.objects.filter(estudiante=est, materia=mesa.materia).order_by("-fecha_cierre").first()
            if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                if reg and reg.situacion in (Regularidad.Situacion.PROMOCIONADO, Regularidad.Situacion.APROBADO):
                    return 400, {"message": "Materia ya aprobada/promocionada en cursada."}
                return 400, {"message": "No posee regularidad vigente en la materia."}

            def _add_years(d: date, years: int) -> date:
                try: return d.replace(year=d.year + years)
                except ValueError: return d.replace(month=2, day=28, year=d.year + years)

            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = MesaExamen.objects.filter(materia=mesa.materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years).order_by("fecha").values_list("fecha", flat=True).first()
            allowed_until = next_call or two_years
            
            if mesa.fecha > allowed_until:
                return 400, {"message": "La vigencia de su regularidad ha expirado (2 años + 1 llamado)."}

            # D. Conteo de Intentos
            intentos = InscripcionMesa.objects.filter(
                estudiante=est, estado=InscripcionMesa.Estado.INSCRIPTO,
                mesa__materia=mesa.materia, mesa__tipo__in=MESA_TIPOS_ORDINARIOS,
                mesa__fecha__gte=reg.fecha_cierre, mesa__fecha__lte=allowed_until,
            ).count()
            if intentos >= 3:
                return 400, {"message": "Ha agotado los 3 llamados permitidos para esta regularidad."}

            # E. Correlatividades para Rendir
            req_ids = list(_correlatividades_qs(mesa.materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, est).values_list("materia_correlativa_id", flat=True))
            if req_ids:
                faltan = []
                regs = Regularidad.objects.filter(estudiante=est, materia_id__in=req_ids).order_by("materia_id", "-fecha_cierre")
                latest: dict[int, Regularidad] = {}
                for r in regs: latest.setdefault(r.materia_id, r)
                for mid in req_ids:
                    r = latest.get(mid)
                    if not r or r.situacion not in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                        m = Materia.objects.filter(id=mid).first()
                        faltan.append(m.nombre if m else f"Materia {mid}")
                if faltan:
                    return 400, {"message": "Faltan correlativas aprobadas para rendir final.", "faltantes": faltan}

    # --- LÓGICA PARA MODALIDAD LIBRE ---
    elif mesa.modalidad == MesaExamen.Modalidad.LIBRE:
        # A. Historial Aprobado
        from core.models import ActaExamenEstudiante
        if ActaExamenEstudiante.objects.filter(persona__dni=est.dni, acta__materia=mesa.materia).exists():
             return 400, {"message": "La materia ya figura aprobada."}

        reg_aprobada = Regularidad.objects.filter(estudiante=est, materia=mesa.materia, situacion__in=[Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO]).exists()
        if reg_aprobada:
            return 400, {"message": "Materia ya superada en el ciclo de cursada."}

        # B. Exclusión por Cursada Activa
        current_year = date.today().year
        is_enrolled = InscripcionMateriaEstudiante.objects.filter(
            estudiante=est, materia=mesa.materia, anio=current_year,
            estado__in=[InscripcionMateriaEstudiante.Estado.CONFIRMADA, InscripcionMateriaEstudiante.Estado.PENDIENTE]
        ).exists()
        if is_enrolled:
             return 400, {"message": "No puede rendir LIBRE mientras cursa la materia actualmente."}

        # C. Exclusión por Regularidad Vigente
        reg = Regularidad.objects.filter(estudiante=est, materia=mesa.materia).order_by("-fecha_cierre").first()
        if reg and reg.situacion == Regularidad.Situacion.REGULAR:
            def _add_years(d: date, years: int) -> date:
                try: return d.replace(year=d.year + years)
                except ValueError: return d.replace(month=2, day=28, year=d.year + years)

            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = MesaExamen.objects.filter(materia=mesa.materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years).order_by("fecha").values_list("fecha", flat=True).first()
            allowed_until = next_call or two_years
            
            if mesa.fecha <= allowed_until:
                 return 400, {"message": "Posee regularidad vigente. Debe inscribirse en una mesa modalidad REGULAR."}

        # D. Correlatividades para Rendir (Igual que regular)
        req_ids = list(_correlatividades_qs(mesa.materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, est).values_list("materia_correlativa_id", flat=True))
        if req_ids:
            faltan = []
            regs = Regularidad.objects.filter(estudiante=est, materia_id__in=req_ids).order_by("materia_id", "-fecha_cierre")
            latest: dict[int, Regularidad] = {}
            for r in regs: latest.setdefault(r.materia_id, r)
            for mid in req_ids:
                r = latest.get(mid)
                if not r or r.situacion not in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                    m = Materia.objects.filter(id=mid).first()
                    faltan.append(m.nombre if m else f"Materia {mid}")
            if faltan:
                return 400, {"message": "Correlativas sin aprobar para rendir libre.", "faltantes": faltan}

    ins, created = InscripcionMesa.objects.get_or_create(mesa=mesa, estudiante=est)
    if not created and ins.estado == InscripcionMesa.Estado.INSCRIPTO:
        return 400, {"message": "Ya se encuentra inscripto en esta mesa."}
    ins.estado = InscripcionMesa.Estado.INSCRIPTO
    ins.save()
    return {"message": "Inscripción registrada exitosamente."}


@estudiantes_router.post("/mesa-examen", response=MesaExamenOut, auth=JWTAuth())
def mesa_examen(request, payload: MesaExamenIn):
    return {"message": "Solicitud recibida."}
