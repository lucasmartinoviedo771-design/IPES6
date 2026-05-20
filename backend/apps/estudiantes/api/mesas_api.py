"""
        API de Mesas de Examen.
Gestiona el catálogo de mesas de examen final y el proceso de inscripción para alumnos.

Reglas Generales de Examen:
1. Condición de Alumno: El alumno debe tener legajo 'COMPLETO' o permiso condicional (Título en trámite).
2. Modalidad Regular: Requiere cursada aprobada y vigente (2 años + 60 días o 1 llamado). Límite de 3 intentos fallidos.
3. Modalidad Libre: Permite rendir sin regularidad previa, siempre que no esté cursando la materia o tenga regularidad vigente.
4. Correlatividades: Verifica el cumplimiento de materias aprobadas requeridas para rendir el final.
"""

from __future__ import annotations
from datetime import date, datetime
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import AnonymousUser
from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from apps.estudiantes.api.helpers import _acta_condicion
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
    SolicitudMesa,
    VentanaHabilitacion,
)
from apps.common.date_utils import format_date, format_datetime, calcular_limite_baja_mesa
from ..schemas import (
    InscripcionMesaIn,
    InscripcionMesaOut,
    MesaExamenIn,
    MesaExamenOut,
    BajaMesaIn,
    BajaMesaOut,
    SolicitudMesaIn,
    SolicitudMesaOut,
)
from .helpers import (
    _add_years,
    _correlatividades_qs,
    _tiene_aprobacion_valida,
    _ensure_estudiante_access,
    _listar_carreras_detalle,
    _resolve_estudiante,
)
from .router import estudiantes_router

MESA_TIPOS_ORDINARIOS = (MesaExamen.Tipo.FINAL, MesaExamen.Tipo.ESPECIAL, MesaExamen.Tipo.EXTRAORDINARIA)


def _check_academic_eligibility(est, materia: Materia, modalidad: str, fecha_examen: date | None = None, mesa_tipo: str | None = None, mesa: MesaExamen | None = None, bypass_legajo: bool = False, bypass_correlativas: bool = False, bypass_regularidad: bool = False, bypass_historial: bool = False):
    """
    Unified academic validation for exam enrollment or request.
    Returns (is_eligible, error_message, extra_data)
    """
    from datetime import date, timedelta
    from core.models import (
        ActaExamenEstudiante, Regularidad, Preinscripcion, 
        InscripcionMesa, InscripcionMateriaEstudiante,
        Correlatividad, Materia
    )

    if mesa:
        materia = mesa.materia
        modalidad = mesa.modalidad
        fecha_examen = mesa.fecha
        mesa_tipo = mesa.tipo

    # A. Materia ya superada (Común a ambas modalidades)
    aprobado_historial = False
    for acta_est in ActaExamenEstudiante.objects.filter(dni=est.dni, acta__materia=materia):
        cond_val, _ = _acta_condicion(acta_est.calificacion_definitiva)
        if cond_val == "APR" or acta_est.permiso_examen == "EQUIV":
            aprobado_historial = True
            break
    if not aprobado_historial:
        aprobado_historial = InscripcionMesa.objects.filter(
            estudiante=est, mesa__materia=materia,
            condicion=InscripcionMesa.Condicion.APROBADO,
        ).exists()
    if aprobado_historial and not bypass_historial:
        return False, "La materia ya figura aprobada en su historial.", {}

    # B. Cupo (B4 - Validación de capacidad) - Solo si hay mesa física
    if mesa and mesa.cupo and mesa.cupo > 0:
        inscriptos_count = InscripcionMesa.objects.filter(mesa=mesa, estado=InscripcionMesa.Estado.INSCRIPTO).count()
        if inscriptos_count >= mesa.cupo:
            return False, f"La mesa ha alcanzado su cupo máximo de {mesa.cupo} inscriptos.", {}

    # --- MODALIDAD REGULAR ---
    if modalidad == MesaExamen.Modalidad.REGULAR:
        if mesa_tipo is None or mesa_tipo in MESA_TIPOS_ORDINARIOS:
            # 1. Estado de Legajo (omitido si un administrativo gestiona la inscripción)
            if not bypass_legajo:
                legajo_ok = est.estado_legajo == Estudiante.EstadoLegajo.COMPLETO
                if not legajo_ok:
                    from core.models import ProrrogaTituloSecundario
                    prorroga_vigente = ProrrogaTituloSecundario.objects.filter(
                        estudiante=est,
                        fecha_vencimiento__gte=date.today(),
                    ).exists()
                    if not prorroga_vigente:
                        prof = materia.plan_de_estudio.profesorado if materia and materia.plan_de_estudio else None
                        pre = Preinscripcion.objects.filter(alumno=est, carrera=prof).order_by("-anio", "-id").first()
                        cl = getattr(pre, "checklist", None) if pre else None
                        if not (cl and cl.certificado_titulo_en_tramite):
                            return False, "Tu legajo está incompleto. Para inscribirte a rendir debés completar la documentación requerida.", {}

            # 2. Verificación de Regularidad
            if not bypass_regularidad:
                reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
                if not reg or reg.situacion != Regularidad.Situacion.REGULAR:
                    # Si tiene aprobación válida por cualquier fuente → ya está superada
                    if _tiene_aprobacion_valida(est, materia):
                        return False, "Materia ya aprobada/promocionada en cursada.", {}
                    return False, "No posee regularidad vigente en la materia.", {}
    
                if not reg.fecha_cierre:
                    return False, "Regularidad sin fecha de cierre válida.", {}
    
                fecha_base = _add_years(reg.fecha_cierre, 2)
                allowed_until = (fecha_base + timedelta(days=60)) if fecha_base else None
                if fecha_examen and allowed_until and fecha_examen > allowed_until:
                    return False, f"La vigencia de su regularidad ha expirado. Venció el {format_date(allowed_until)}.", {}
            else:
                reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
                allowed_until = None # no aplica si bypass

            # 3. Conteo de Intentos (excluye la mesa actual para no contarse a sí mismo)
            if not bypass_regularidad and reg:
                intentos_qs = InscripcionMesa.objects.filter(
                    estudiante=est, cuenta_para_intentos=True,
                    mesa__materia=materia, mesa__tipo__in=MESA_TIPOS_ORDINARIOS,
                    mesa__fecha__gte=reg.fecha_cierre,
                )
                if allowed_until:
                    intentos_qs = intentos_qs.filter(mesa__fecha__lte=allowed_until)
                
                if mesa:
                    intentos_qs = intentos_qs.exclude(mesa=mesa)
                    
                if intentos_qs.count() >= 3:
                    return False, "Ha agotado los llamados permitidos (3) para esta regularidad. Debe rendir como libre o recursar.", {}

            # 4a. Correlativas de cursada caídas (resguardo dinámico)
            # Verifica que las correlativas que habilitaban cursar esta materia
            # siguen siendo válidas (cubre Regularidad, Equivalencia y Acta).
            if not bypass_correlativas and reg:
                req_cursar_reg = list(_correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, est).values_list("materia_correlativa_id", flat=True))
                req_cursar_apr = list(_correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, est).values_list("materia_correlativa_id", flat=True))
                autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
                caidas = []

                for mid in req_cursar_reg:
                    if mid in autorizadas_ids:
                        continue
                    m_obj = Materia.objects.filter(id=mid).first()
                    if not m_obj:
                        continue
                    # REGULAR_PARA_CURSAR: alcanza con regularidad vigente O aprobación válida
                    reg_corr_reciente = Regularidad.objects.filter(
                        estudiante=est, materia_id=mid,
                        situacion=Regularidad.Situacion.REGULAR,
                        en_resguardo=False,
                    ).order_by("-fecha_cierre").first()
                    
                    tiene_regular_vigente = False
                    if reg_corr_reciente:
                        from apps.estudiantes.api.helpers import _calcular_vigencia_regularidad
                        limite, intentos, max_intentos = _calcular_vigencia_regularidad(est, reg_corr_reciente)
                        fecha_comparacion = fecha_examen if fecha_examen else date.today()
                        if fecha_comparacion <= limite and intentos < max_intentos:
                            tiene_regular_vigente = True
                    if not tiene_regular_vigente and not _tiene_aprobacion_valida(est, m_obj, fecha_ref=fecha_examen, autorizadas_ids=autorizadas_ids):
                        caidas.append(f"{m_obj.nombre} (correlativa caída o en resguardo)")

                for mid in req_cursar_apr:
                    if mid in autorizadas_ids:
                        continue
                    m_obj = Materia.objects.filter(id=mid).first()
                    if not m_obj or not _tiene_aprobacion_valida(est, m_obj, fecha_ref=fecha_examen, autorizadas_ids=autorizadas_ids):
                        nombre = m_obj.nombre if m_obj else f"Materia {mid}"
                        caidas.append(f"{nombre} (aprobación requerida caída o en resguardo)")

                if caidas:
                    return False, "Correlativas de cursada en resguardo o caídas. No se puede rendir.", {"caidas": caidas}

            # 4. Correlatividades (omitido si el staff gestiona el pedido)
            if not bypass_correlativas:
                req_ids = list(_correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, est).values_list("materia_correlativa_id", flat=True))
                if req_ids:
                    faltan = []
                    autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
                    for mid in req_ids:
                        m = Materia.objects.filter(id=mid).first()
                        nombre = m.nombre if m else f"Materia {mid}"
                        if not m or not _tiene_aprobacion_valida(est, m, fecha_ref=fecha_examen, autorizadas_ids=autorizadas_ids):
                            faltan.append(nombre)
                    if faltan:
                        return False, "Faltan correlativas aprobadas para rendir final.", {"faltantes": faltan}

    # --- MODALIDAD LIBRE ---
    elif modalidad == MesaExamen.Modalidad.LIBRE:
        if _tiene_aprobacion_valida(est, materia):
            return False, "Materia ya superada en el ciclo de cursada.", {}

        current_year = date.today().year
        is_enrolled = InscripcionMateriaEstudiante.objects.filter(
            estudiante=est, materia=materia, anio=current_year,
            estado__in=[InscripcionMateriaEstudiante.Estado.CONFIRMADA, InscripcionMateriaEstudiante.Estado.PENDIENTE]
        ).exists()
        if is_enrolled:
             return False, "No puede rendir LIBRE mientras cursa la materia actualmente.", {}

        reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
        if reg and reg.situacion == Regularidad.Situacion.REGULAR:
            if not reg.fecha_cierre:
                 return False, "Regularidad sin fecha de cierre válida.", {}
            two_years = _add_years(reg.fecha_cierre, 2)
            next_call = MesaExamen.objects.filter(materia=materia, tipo__in=MESA_TIPOS_ORDINARIOS, fecha__gte=two_years).order_by("fecha").values_list("fecha", flat=True).first() if two_years else None
            allowed_until = next_call or two_years
            if fecha_examen and allowed_until and fecha_examen <= allowed_until:
                return False, "Posee regularidad vigente. Debe inscribirse en modalidad REGULAR.", {}

        # Correlatividades para LIBRE (omitido si el staff gestiona el pedido)
        if not bypass_correlativas:
            req_ids = list(_correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, est).values_list("materia_correlativa_id", flat=True))
            if req_ids:
                faltan = []
                autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))
                for mid in req_ids:
                    m = Materia.objects.filter(id=mid).first()
                    nombre = m.nombre if m else f"Materia {mid}"
                    if not m or not _tiene_aprobacion_valida(est, m, fecha_ref=fecha_examen, autorizadas_ids=autorizadas_ids):
                        faltan.append(nombre)
                if faltan:
                    return False, "Faltan correlativas (aprobadas o promocionadas) para rendir LIBRE.", {"faltantes": faltan}

    return True, "", {}


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

    qs = MesaExamen.objects.select_related(
        "materia__plan_de_estudio__profesorado",
        "docente_presidente",
        "docente_vocal1",
        "docente_vocal2"
    ).all()

    # Restricciones para Alumnos
    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    es_staff = _user_has_roles(request.user, ADMIN_ALLOWED_ROLES)

    # Barrido automático antes de listar para Alumnos (Removido por R2)
    # MesaExamen.auto_cleanup_deserted_mesas()

    # Restricciones de visibilidad (Fecha y Ventana)
    # Por defecto, solo mostramos mesas futuras para evitar ruido histórico (mesas de años anteriores).
    # Para Staff, permitimos ver el pasado solo si se selecciona una ventana específica.
    if not (es_staff and ventana_id):
        qs = qs.filter(fecha__gte=date.today())

    if not es_staff:
        # Alumnos: Solo ven mesas dentro de una ventana de habilitación activa.
        if not ventana_id:
            from core.models import VentanaHabilitacion
            ventanas_activas = VentanaHabilitacion.objects.filter(
                tipo__in=[VentanaHabilitacion.Tipo.MESAS_FINALES, VentanaHabilitacion.Tipo.MESAS_EXTRA, VentanaHabilitacion.Tipo.INSCRIPCION],
                activo=True,
                desde__lte=date.today(),
                hasta__gte=date.today()
            )
            qs = qs.filter(ventana__in=ventanas_activas)
        else:
            # Si el alumno selecciona una ventana específica, verificamos que esté activa.
            qs = qs.filter(ventana__activo=True)

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

    # Mesas EXT/ESP: restringidas al estudiante consultado (aplica siempre que haya un est resuelto)
    mesas_ext_permitidas: set[int] = set()
    if est:
        from core.models import SolicitudMesa
        mesas_ext_permitidas = set(
            SolicitudMesa.objects.filter(
                estudiante=est,
                estado=SolicitudMesa.Estado.PROCESADA,
                mesa_asignada__isnull=False,
            ).values_list("mesa_asignada_id", flat=True)
        )

    # Cache de estado académico para optimizar el filtro 'solo_rendibles'
    aprobadas_rendir_set = set()
    if estudiante_para_rendir:
        from core.models import ActaExamenEstudiante
        actas = ActaExamenEstudiante.objects.filter(dni=estudiante_para_rendir.dni)
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
            "modalidad": m.modalidad,
            "codigo": m.codigo,
            "fecha": format_date(m.fecha),
            "hora_desde": str(m.hora_desde) if m.hora_desde else None,
            "hora_hasta": str(m.hora_hasta) if m.hora_hasta else None,
            "aula": m.aula,
            "cupo": m.cupo,
            "correlativas_aprob": req_aprob,
            "plan_id": m.materia.plan_de_estudio_id if m.materia_id else None,
            "profesorado_id": (m.materia.plan_de_estudio.profesorado_id if m.materia_id and m.materia.plan_de_estudio_id else None),
            "tribunal": {
                "presidente": f"{m.docente_presidente.apellido}, {m.docente_presidente.nombre}" if m.docente_presidente else None,
                "vocal1": f"{m.docente_vocal1.apellido}, {m.docente_vocal1.nombre}" if m.docente_vocal1 else None,
                "vocal2": f"{m.docente_vocal2.apellido}, {m.docente_vocal2.nombre}" if m.docente_vocal2 else None,
            }
        }
        
        # Mesas EXT: el alumno queda inscripto automáticamente al crearse — no deben aparecer para inscripción manual
        if est and m.tipo == MesaExamen.Tipo.EXTRAORDINARIA:
            continue
        # Mesas ESP: solo visibles para el estudiante_exclusivo asignado
        if est and m.tipo == MesaExamen.Tipo.ESPECIAL:
            if m.estudiante_exclusivo_id is None or m.estudiante_exclusivo_id != est.id:
                continue

        if solo_rendibles and estudiante_para_rendir:
            is_ok, _, _ = _check_academic_eligibility(estudiante_para_rendir, materia=m.materia, modalidad=m.modalidad, mesa=m)
            if not is_ok:
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

    # --- VALIDACIÓN UNIFICADA ---
    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    es_staff = payload.dni and _user_has_roles(request.user, ADMIN_ALLOWED_ROLES)

    # Validar que la ventana esté activa y dentro de fecha (solo para alumnos)
    if not es_staff:
        from datetime import date as _date
        hoy = _date.today()
        ventana = mesa.ventana
        if not ventana or not ventana.activo:
            return 400, {"message": "La inscripción no está habilitada para esta mesa."}
        if hoy < ventana.desde or hoy > ventana.hasta:
            return 400, {"message": f"La inscripción solo está habilitada entre el {ventana.desde.strftime('%d/%m/%Y')} y el {ventana.hasta.strftime('%d/%m/%Y')}."}

    is_ok, msg, extra = _check_academic_eligibility(
        est, materia=mesa.materia, modalidad=mesa.modalidad, mesa=mesa,
        bypass_legajo=bool(es_staff),
        bypass_correlativas=bool(es_staff),
        bypass_regularidad=bool(es_staff),
        bypass_historial=bool(es_staff)
    )
    if not is_ok:
        return 400, {"message": msg, **extra}

    ins, created = InscripcionMesa.objects.get_or_create(mesa=mesa, estudiante=est)
    if not created and ins.estado == InscripcionMesa.Estado.INSCRIPTO:
        return 400, {"message": "Ya se encuentra inscripto en esta mesa."}
    ins.estado = InscripcionMesa.Estado.INSCRIPTO
    ins.save()
    return {"message": "Inscripción registrada exitosamente."}


@estudiantes_router.post(
    "/baja_mesa",
    response={200: BajaMesaOut, 400: dict, 404: dict},
    auth=JWTAuth(),
)
def baja_mesa(request, payload: BajaMesaIn):
    """
    Permite a un estudiante cancelar su inscripción a una mesa.
    Solo es posible hasta 48 horas hábiles antes de la mesa.
    """
    # 1. Verificar permisos del estudiante
    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}

    # 2. Obtener la mesa
    mesa = MesaExamen.objects.filter(id=payload.mesa_id).first()
    if not mesa:
        return 404, {"message": "Mesa no encontrada"}

    # 3. Buscar la inscripción activa
    ins = InscripcionMesa.objects.filter(
        mesa=mesa,
        estudiante=est,
        estado=InscripcionMesa.Estado.INSCRIPTO
    ).first()

    if not ins:
        return 400, {"message": "No tiene inscripción activa en esta mesa"}

    # 4. Validar ventana de inscripción (Baja permitida solo si la ventana sigue abierta)
    if mesa.ventana:
        ahora = date.today()
        if ahora > mesa.ventana.hasta or not mesa.ventana.activo:
            return 400, {
                "message": f"El período de inscripción para esta mesa ha finalizado (cerró el {format_date(mesa.ventana.hasta)}). Ya no puede cancelar su inscripción."
            }
    else:
        # Si no tiene ventana (mesa especial), aplicamos el límite de 48hs hábiles por defecto
        limite_baja = calcular_limite_baja_mesa(mesa.fecha)
        ahora = datetime.now()
        if ahora > limite_baja:
            return 400, {
                "message": f"El plazo para darse de baja venció el {format_datetime(limite_baja)}. No puede cancelar su inscripción."
            }

    # 5. Cancelar la inscripción
    ins.estado = InscripcionMesa.Estado.CANCELADO
    ins.cuenta_para_intentos = False  # No penaliza el intento
    ins.save()

    return {
        "message": "Inscripción cancelada exitosamente.",
        "mesa_id": mesa.id,
        "limite_baja": format_datetime(limite_baja)
    }


@estudiantes_router.post(
    "/solicitar_mesa",
    response={200: dict, 400: dict, 404: dict},
    auth=JWTAuth(),
)
def solicitar_mesa(request, payload: SolicitudMesaIn):
    """
    Registra una solicitud de mesa extraordinaria cuando no hay una mesa armada.
    """
    _ensure_estudiante_access(request, payload.dni)
    est = _resolve_estudiante(request, payload.dni)
    if not est:
        return 400, {"message": "No se encontró el estudiante"}
    
    materia = get_object_or_404(Materia, id=payload.materia_id)
    ventana = get_object_or_404(VentanaHabilitacion, id=payload.ventana_id)
    
    if ventana.tipo != VentanaHabilitacion.Tipo.MESAS_EXTRA:
        return 400, {"message": "Solo se pueden enviar solicitudes para mesas extraordinarias."}
    
    if not ventana.activo:
        return 400, {"message": "El período de solicitudes no está activo."}

    # Determinamos la modalidad (priorizamos payload, sino predeterminada a Regular si tiene regularidad, sino Libre)
    modalidad = payload.modalidad
    if not modalidad:
        reg = Regularidad.objects.filter(estudiante=est, materia=materia).order_by("-fecha_cierre").first()
        modalidad = MesaExamen.Modalidad.REGULAR if (reg and reg.situacion == Regularidad.Situacion.REGULAR) else MesaExamen.Modalidad.LIBRE

    # --- VALIDACIÓN ACADÉMICA ---
    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    es_staff = payload.dni and _user_has_roles(request.user, ADMIN_ALLOWED_ROLES)
    is_ok, msg, extra = _check_academic_eligibility(
        est, materia=materia, modalidad=modalidad,
        mesa_tipo=MesaExamen.Tipo.EXTRAORDINARIA,
        bypass_legajo=bool(es_staff),
        bypass_correlativas=bool(es_staff),
        bypass_regularidad=bool(es_staff),
        bypass_historial=bool(es_staff)
    )
    if not is_ok:
        return 400, {"message": f"No cumple las condiciones: {msg}", **extra}

    sol, created = SolicitudMesa.objects.get_or_create(
        estudiante=est,
        materia=materia,
        ventana=ventana,
        defaults={
            "observaciones": payload.observaciones,
            "modalidad": modalidad
        }
    )
    
    if not created:
        return 400, {"message": "Ya envió una solicitud para esta materia en este período."}
        
    return {"message": "Solicitud enviada exitosamente. Se le notificará cuando la mesa sea armada."}


@estudiantes_router.get(
    "/mis_solicitudes",
    response=list[SolicitudMesaOut],
    auth=JWTAuth(),
)
def listar_solicitudes_estudiante(request, dni: str | None = None):
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return []
        
    qs = SolicitudMesa.objects.filter(estudiante=est).select_related("materia", "mesa_asignada").order_by("-fecha_solicitud")
    
    return [
        {
            "id": s.id,
            "materia_id": s.materia_id,
            "materia_nombre": s.materia.nombre,
            "estado": s.estado,
            "estado_display": s.get_estado_display(),
            "fecha_solicitud": s.fecha_solicitud,
            "modalidad": s.modalidad,
            "modalidad_display": s.get_modalidad_display(),
            "observaciones": s.observaciones,
            "mesa_asignada_id": s.mesa_asignada_id
        }
        for s in qs
    ]


@estudiantes_router.delete(
    "/cancelar_solicitud/{solicitud_id}",
    auth=JWTAuth(),
)
def cancelar_solicitud(request, solicitud_id: int):
    """
    Permite al estudiante cancelar su propia solicitud si aún no ha sido procesada (Pendiente).
    """
    from django.shortcuts import get_object_or_404
    solicitud = get_object_or_404(SolicitudMesa, id=solicitud_id)
    
    # Seguridad: solo el dueño de la solicitud (o un administrativo) puede borrarla
    _ensure_estudiante_access(request, solicitud.estudiante.dni)
    
    if solicitud.estado != SolicitudMesa.Estado.PENDIENTE:
        return 400, {"message": "Solo se pueden cancelar solicitudes en estado Pendiente."}
        
    solicitud.delete()
    return {"message": "Solicitud cancelada correctamente."}


@estudiantes_router.get(
    "/materias_solicitables",
    response=list[dict],
    auth=JWTAuth(),
)
def listar_materias_solicitables(request, dni: str | None = None, modalidad: str | None = None, plan_id: int | None = None):
    """
    Lista las materias del plan del alumno que están en condiciones de ser solicitadas
    para un llamado extraordinario.
    """
    _ensure_estudiante_access(request, dni)
    est = _resolve_estudiante(request, dni)
    if not est:
        return []

    # 1. Obtener todas las materias de sus carreras (o el plan específico)
    if plan_id:
        materias_qs = Materia.objects.filter(plan_de_estudio_id=plan_id)
    else:
        materias_qs = Materia.objects.filter(
            plan_de_estudio__profesorado__in=est.carreras.all()
        )
    
    materias_qs = materias_qs.select_related("plan_de_estudio")

    # 2. Filtro de Formato (Excluir lo que no tiene final tradicional)
    formatos_excluidos = [
        Materia.FormatoMateria.PRACTICA,
        Materia.FormatoMateria.TALLER,
        Materia.FormatoMateria.LABORATORIO,
        Materia.FormatoMateria.SEMINARIO
    ]
    materias_qs = materias_qs.exclude(formato__in=formatos_excluidos)

    from .helpers import _user_has_roles, ADMIN_ALLOWED_ROLES
    es_staff = bool(dni and _user_has_roles(request.user, ADMIN_ALLOWED_ROLES))

    solicitables = []

    # Si no se especifica modalidad, devolvemos ambas (REG y LIB) para que el frontend las separe
    modalidades_a_chequear = [modalidad] if modalidad else ["REG", "LIB"]

    # 3. Validación Académica para cada materia
    for m in materias_qs:
        for mod in modalidades_a_chequear:
            if mod == "LIB" and not m.permite_mesa_libre:
                continue

            is_ok, _, _ = _check_academic_eligibility(
                est,
                materia=m,
                modalidad=mod,
                mesa_tipo=MesaExamen.Tipo.EXTRAORDINARIA,
                bypass_legajo=es_staff,
                bypass_correlativas=es_staff,
            )

            if is_ok:
                solicitables.append({
                    "materia_id": m.id,
                    "materia_nombre": m.nombre,
                    "anio": m.anio_cursada,
                    "plan_resolucion": m.plan_de_estudio.resolucion,
                    "modalidad": mod,
                })

    return solicitables


@estudiantes_router.post("/mesa-examen", response=MesaExamenOut, auth=JWTAuth())
def mesa_examen(request, payload: MesaExamenIn):
    return {"message": "Solicitud recibida."}
