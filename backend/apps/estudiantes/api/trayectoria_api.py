"""
Motor de Trayectoria Académica y Seguimiento de Alumnos (Cartón del Alumno).
Esta API es el núcleo de la inteligencia académica del sistema. Consolida múltiples fuentes 
de datos para reconstruir la 'Sábana Académica' completa del estudiante.

Fuentes de Datos Consolidadas:
1. Cursadas (Regularidades): Calificaciones parciales y condición final de cursada.
2. Actas de Examen: Calificaciones definitivas registradas en libros y folios.
3. Inscripciones a Mesas: Estado dinámico de exámenes finales en curso.
4. Históricos/Equivalencias: Reconocimiento de materias externas o planes anteriores.

Lógicas de Negocio Implementadas:
- Cálculo de Vigencia: Determinación sensible de vencimientos de cursadas según tiempo y llamados fallidos.
- Sistema de Correlatividades: Motor de validación de requisitos (Aprobada/Regular para Cursar/Rendir).
- Mapeo al Cartón Visual: Agrupación por Plan de Estudio para visualización histórica.
"""

from __future__ import annotations
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone
from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamenEstudiante,
    Correlatividad,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Materia,
    PlanDeEstudio,
    Preinscripcion,
    Regularidad,
)

from ..schemas import (
    CarreraDetalleResumen,
    CarreraPlanResumen,
    EstudianteResumen,
    FinalHabilitado,
    HistorialEstudiante,
    MateriaSugerida,
    RegularidadResumen,
    RegularidadVigenciaOut,
    RecomendacionesOut,
    TrayectoriaEvento,
    TrayectoriaMesa,
    TrayectoriaOut,
)
from .helpers import (
    _acta_condicion,
    _calcular_vigencia_regularidad,
    _format_acta_calificacion,
    _format_nota,
    _listar_carreras_detalle,
    _metadata_str,
    _resolve_estudiante,
    _to_iso,
)
from apps.common.date_utils import format_date, format_datetime
from .router import estudiantes_router


@estudiantes_router.get("/historial", response=HistorialEstudiante, auth=JWTAuth())
def historial_estudiante(request, dni: str | None = None):
    """
    Retorna un resumen simplificado de IDs de materias por estado académico.
    Se utiliza principalmente para lógica de visualización rápida en el frontend 
    (ej. habilitar botones de inscripción si tiene la materia aprobada).
    """
    est = _resolve_estudiante(request, dni)
    if not est:
        return HistorialEstudiante(aprobadas=[], regularizadas=[], inscriptas_actuales=[])

    aprobadas_set: set[int] = set()
    regularizadas_set: set[int] = set()
    inscriptas_actuales_set: set[int] = set()

    # 1. Análisis de cursadas (Tomamos la situación más reciente de cada materia)
    situacion_por_materia: dict[int, Regularidad] = {}
    for reg in Regularidad.objects.filter(estudiante=est).order_by("fecha_cierre"):
        situacion_por_materia[reg.materia_id] = reg

    hoy = timezone.now().date()
    for mid, reg in situacion_por_materia.items():
        if reg.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            aprobadas_set.add(mid)
        elif reg.situacion == Regularidad.Situacion.REGULAR:
            # Determinamos si la regularid continúa vigente según tiempo e intentos fallidos (Llamado)
            vigencia_limite, intentos = _calcular_vigencia_regularidad(est, reg)
            # "o un llamado lo que ocurra primer" -> máximo 1 intento (llamado)
            if vigencia_limite >= hoy and intentos < 1:
                regularizadas_set.add(mid)

    # 2. Análisis de Actas y Equivalencias
    actas_estudiante_qs = ActaExamenEstudiante.objects.filter(dni=est.dni).select_related("acta")
    for a in actas_estudiante_qs:
        cond_val, _ = _acta_condicion(a.calificacion_definitiva)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        if cond_val == "APR" or is_equiv:
            aprobadas_set.add(a.acta.materia_id)

    # 3. Finales Recientes (No impactados aún en actas)
    insc_mesa_qs = InscripcionMesa.objects.filter(estudiante=est, condicion=InscripcionMesa.Condicion.APROBADO, estado=InscripcionMesa.Estado.INSCRIPTO)
    for insc in insc_mesa_qs:
        if insc.mesa and insc.mesa.materia_id:
            aprobadas_set.add(insc.mesa.materia_id)

    # 4. Inscripciones Activas (A cursar)
    inscriptas_actuales = InscripcionMateriaEstudiante.objects.filter(
        estudiante=est,
        estado__in=[InscripcionMateriaEstudiante.Estado.CONFIRMADA, InscripcionMateriaEstudiante.Estado.PENDIENTE],
    ).values_list("materia_id", flat=True)
    inscriptas_actuales_set.update(inscriptas_actuales)

    return HistorialEstudiante(
        aprobadas=sorted(list(aprobadas_set)),
        regularizadas=sorted(list(regularizadas_set - aprobadas_set)),
        inscriptas_actuales=sorted(list(inscriptas_actuales_set)),
    )


@estudiantes_router.get("/trayectoria", response={200: TrayectoriaOut, 404: ApiResponse}, auth=JWTAuth())
def trayectoria_estudiante(request, dni: str | None = None):
    """
    Construye la trayectoria académica integral ('Cartón del Alumno').
    Este es el proceso más complejo del sistema, consolidando múltiples fuentes de datos.
    
    Flujo de Trabajo:
    1. Consolidación de aprobaciones (Actas + Equivalencias + Finales).
    2. Identificación de regularidades vigentes y detección de bloqueos por recursado.
    3. Construcción del timeline de exámenes y actas históricas.
    4. Cálculo de vencimientos (Lógica de los 18/24 meses o 3 intentos fallidos).
    5. Motor de Sugerencias: Verifica el grafo de correlatividades para detectar qué puede cursar el alumno.
    6. Mapeo al Cartón Visual: Agrupa la información por Planes de Estudio vigentes.
    """
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="Estudiante no encontrado.")

    carreras_est = list(est.carreras.order_by("nombre"))
    carreras = [profesorado.nombre for profesorado in carreras_est]
    carreras_detalle_data = _listar_carreras_detalle(est, carreras_est)

    eventos_raw: list[dict] = []
    mesas_raw: list[dict] = []
    regularidades_resumen_data: list[dict] = []
    regularidades_vigencia_data: list[dict] = []
    finales_habilitados_data: list[dict] = []
    alertas: list[str] = []
    carton_planes: list[dict] = []
    
    # Acumuladores de estado para lógica de recomendaciones
    aprobadas_set: set[int] = set()
    aprobadas_notas: dict[int, str] = {}
    regularizadas_set: set[int] = set()
    inscriptas_actuales_set: set[int] = set()

    hoy = timezone.now().date()
    
    # --- 1. PRE-CÁLCULO DE ESTADOS ---
    
    # Análisis de cursadas cerradas
    regularidades_qs = (
        Regularidad.objects.filter(estudiante=est)
        .select_related("materia", "materia__plan_de_estudio", "materia__plan_de_estudio__profesorado")
        .prefetch_related("materia__correlativas_requeridas__materia_correlativa")
        .order_by("-fecha_cierre")
    )
    regularidades_list = list(regularidades_qs)

    # Identificación de situaciones que bloquean el acceso a finales (Ej. recursar)
    SITUACIONES_BLOQUEANTES = {
        Regularidad.Situacion.LIBRE_I,
        Regularidad.Situacion.LIBRE_AT,
        Regularidad.Situacion.DESAPROBADO_PA,
        Regularidad.Situacion.DESAPROBADO_TP,
    }
    
    # 1. PRE-CÁLCULO DE ESTADOS (Tomando siempre la última instancia)
    ultima_situacion_por_materia: dict[int, str] = {}
    for reg in regularidades_list:
        if reg.materia_id not in ultima_situacion_por_materia:
            ultima_situacion_por_materia[reg.materia_id] = reg.situacion
            
            # Si lo último es APROBADO o PROMOCIONADO
            if reg.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                aprobadas_set.add(reg.materia_id)
                aprobadas_notas[reg.materia_id] = _format_nota(reg.nota_final_cursada) if reg.nota_final_cursada else "-"
            
            # Si lo último es REGULAR, verificamos vigencia (Tiempo + 1 Llamado)
            elif reg.situacion == Regularidad.Situacion.REGULAR:
                limite, intentos = _calcular_vigencia_regularidad(est, reg)
                if limite >= hoy and intentos < 1:
                    regularizadas_set.add(reg.materia_id)

    materias_bloqueadas_final: set[int] = {
        mid for mid, sit in ultima_situacion_por_materia.items()
        if sit in SITUACIONES_BLOQUEANTES
    }

    # Análisis de Actas / Equivalencias (Prioridad diagnóstica alta)
    actas_estudiante_qs = (
        ActaExamenEstudiante.objects.filter(dni=est.dni)
        .select_related("acta", "acta__materia")
        .order_by("-acta__fecha")
    )
    for a in actas_estudiante_qs:
        cond_val, _ = _acta_condicion(a.calificacion_definitiva)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        if cond_val in ("APR", "EQUI") or is_equiv:
            aprobadas_set.add(a.acta.materia_id)
            aprobadas_notas[a.acta.materia_id] = _format_acta_calificacion(a.calificacion_definitiva)

    # Análisis de Inscripciones confirmadas (In-Situ)
    inscripciones_mesa_qs = (
        InscripcionMesa.objects.filter(estudiante=est, estado=InscripcionMesa.Estado.INSCRIPTO)
        .select_related("mesa__materia", "mesa__materia__plan_de_estudio", "mesa__materia__plan_de_estudio__profesorado")
        .order_by("-mesa__fecha")
    )
    for insc in inscripciones_mesa_qs:
        if insc.condicion == InscripcionMesa.Condicion.APROBADO:
            if insc.mesa and insc.mesa.materia_id:
                aprobadas_set.add(insc.mesa.materia_id)
                aprobadas_notas[insc.mesa.materia_id] = _format_nota(insc.nota) if insc.nota else "-"

    # --- 2. CONSTRUCCIÓN DE LÍNEA DE TIEMPO DE EXÁMENES ---
    
    inscripciones_mesa_all = (
        InscripcionMesa.objects.filter(estudiante=est)
        .select_related("mesa", "mesa__materia")
        .order_by("-mesa__fecha")
    )
    
    mesas_added_keys = set() 

    for insc in inscripciones_mesa_all:
        fecha_str = format_date(insc.mesa.fecha)
        key = (insc.mesa.materia_id, fecha_str)
        mesas_added_keys.add(key)
        
        estado_val = insc.estado
        estado_lbl = insc.get_estado_display()
        nota_str = None
        
        if insc.condicion:
            estado_val = insc.condicion
            estado_lbl = insc.get_condicion_display()
            nota_str = _format_nota(insc.nota)
            
        mesas_raw.append({
            "id": insc.id,
            "mesa_id": insc.mesa_id,
            "materia_id": insc.mesa.materia_id,
            "materia_nombre": insc.mesa.materia.nombre,
            "tipo": insc.mesa.tipo,
            "tipo_display": insc.mesa.get_tipo_display(),
            "fecha": fecha_str,
            "estado": estado_val,
            "estado_display": estado_lbl,
            "aula": insc.mesa.aula,
            "nota": nota_str,
        })
        
    # Integración de actas históricas que no tienen 'inscripción previa' registrada
    for a in actas_estudiante_qs:
        fecha_str = format_date(a.acta.fecha)
        key = (a.acta.materia_id, fecha_str)
        
        if key in mesas_added_keys:
            continue
            
        cond_val, cond_lbl = _acta_condicion(a.calificacion_definitiva)
        
        mesas_raw.append({
            "id": -a.id, 
            "mesa_id": a.acta.id,
            "materia_id": a.acta.materia_id,
            "materia_nombre": a.acta.materia.nombre,
            "tipo": a.acta.tipo,
            "tipo_display": a.acta.get_tipo_display(),
            "fecha": fecha_str,
            "estado": cond_val,
            "estado_display": cond_lbl,
            "aula": None,
            "nota": a.calificacion_definitiva,
        })

    # --- 3. AUDITORÍA DE VENCIMIENTOS Y ALERTAS ---
    
    materias_procesadas_vigencia = set()
    for reg in regularidades_list:
        vigencia_iso = None
        vigencia_str = None
        vigente = None
        dias_restantes: int | None = None
        
        materia_ya_aprobada = reg.materia_id in aprobadas_set
        
        # Procesamos solo la regularidad más reciente para cada materia
        if reg.materia_id not in materias_procesadas_vigencia:
            es_bloqueada = reg.materia_id in materias_bloqueadas_final
            if reg.situacion == Regularidad.Situacion.REGULAR and not materia_ya_aprobada and not es_bloqueada:
                # El helper calcula la vigencia base y resta los intentos fallidos (3 intentos o 18-24 meses)
                vigencia_limite, intentos = _calcular_vigencia_regularidad(est, reg)
                dias_restantes = (vigencia_limite - hoy).days
                vigente = dias_restantes >= 0
                vigencia_str = format_date(vigencia_limite)
                
                regularidades_vigencia_data.append(
                    {
                        "materia_id": reg.materia_id,
                        "materia_nombre": reg.materia.nombre,
                        "situacion": reg.situacion,
                        "situacion_display": reg.get_situacion_display(),
                        "fecha_cierre": format_date(reg.fecha_cierre),
                        "vigencia_hasta": vigencia_str,
                        "dias_restantes": dias_restantes,
                        "vigente": vigente,
                        "intentos_usados": intentos,
                        "intentos_max": 1, 
                    }
                )
                if vigente:
                    comentarios: list[str] = []
                    if dias_restantes <= 30:
                        comentarios.append("Vencimiento inminente de la regularidad.")
                    
                    # Chequeo de correlativas para habilitar el examen final
                    correlativas_encontradas = []
                    for correlativa_req in reg.materia.correlativas_requeridas.all():
                        mat_corr = correlativa_req.materia_correlativa
                        if mat_corr.id in aprobadas_set:
                            nota = aprobadas_notas.get(mat_corr.id, "-")
                            correlativas_encontradas.append(f"{mat_corr.nombre} (Nota: {nota})")

                    finales_habilitados_data.append(
                        {
                            "materia_id": reg.materia_id,
                            "materia_nombre": reg.materia.nombre,
                            "regularidad_fecha": format_date(reg.fecha_cierre),
                            "vigencia_hasta": vigencia_str,
                            "dias_restantes": dias_restantes,
                            "comentarios": comentarios,
                            "correlativas_aprobadas": correlativas_encontradas,
                        }
                    )
                else:
                    alertas.append(f"Tu regularidad en {reg.materia.nombre} venció el {vigencia_str}.")
            
            materias_procesadas_vigencia.add(reg.materia_id)

    # --- 4. CONSTRUCCIÓN DEL CARTÓN (SÁBANA ACADÉMICA) ---
    # Se agrupan todas las instancias por materia para mostrar historial dentro del cartón
    
    actas_map: dict[int, list[dict]] = {}
    for a in actas_estudiante_qs:
        mid = a.acta.materia_id
        if mid not in actas_map:
            actas_map[mid] = []
        
        cond_val, cond_label = _acta_condicion(a.calificacion_definitiva)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        
        folio_val = a.acta.folio
        if is_equiv:
            cond_val = "EQUI"
            cond_label = "Equivalencia"
        
        actas_map[mid].append({
            "fecha": format_date(a.acta.fecha),
            "condicion": cond_val,
            "condicion_display": cond_label,
            "nota": a.calificacion_definitiva,
            "folio": folio_val,
            "libro": a.acta.libro,
            "es_acta": True
        })
    
    regularidades_map: dict[int, list[Regularidad]] = {}
    for reg in regularidades_list:
        if reg.materia_id not in regularidades_map:
            regularidades_map[reg.materia_id] = []
        regularidades_map[reg.materia_id].append(reg)
        
    finales_map = {}
    for insc in inscripciones_mesa_qs:
        mid = insc.mesa.materia_id
        if mid not in finales_map:
            finales_map[mid] = []
        finales_map[mid].append(insc)

    for carrera in carreras_est:
        planes = PlanDeEstudio.objects.filter(profesorado=carrera, vigente=True)
        if not planes:
             planes = PlanDeEstudio.objects.filter(profesorado=carrera)
        
        for plan in planes:
            materias_plan = Materia.objects.filter(plan_de_estudio=plan).order_by("anio_cursada", "nombre")
            
            carton_materias = []
            for mat in materias_plan:
                regularidades_item_list = regularidades_map.get(mat.id, [])
                regularidades_data = [{
                    "fecha": format_date(reg.fecha_cierre),
                    "condicion": reg.situacion,
                    "nota": _format_nota(reg.nota_final_cursada) if reg.nota_final_cursada else None,
                } for reg in regularidades_item_list]
                
                reg_data_legacy = regularidades_data[0] if regularidades_data else None

                # Unificación de resultados de finales por fecha (Acta prevalece sobre inscripción)
                merged_finales = {}
                for f in finales_map.get(mat.id, []):
                    fecha_str_f = format_date(f.mesa.fecha)
                    merged_finales[fecha_str_f] = {
                        "fecha": fecha_str_f,
                        "condicion": f.condicion or "INS",
                        "nota": _format_nota(f.nota),
                        "folio": f.folio,
                        "libro": f.libro,
                    }
                for a_data in actas_map.get(mat.id, []):
                    merged_finales[a_data["fecha"]] = a_data
                
                carton_finales = sorted(merged_finales.values(), key=lambda x: x["fecha"], reverse=True)
                final_data = carton_finales[0] if carton_finales else None

                carton_materias.append({
                    "materia_id": mat.id,
                    "materia_nombre": mat.nombre,
                    "anio": mat.anio_cursada,
                    "regimen": mat.regimen,
                    "regimen_display": mat.get_regimen_display(),
                    "formato": mat.formato,
                    "formato_display": mat.get_formato_display(),
                    "regularidad": reg_data_legacy,
                    "regularidades": regularidades_data,
                    "final": final_data,
                    "finales": carton_finales
                })
            
            carton_planes.append({
                "profesorado_id": carrera.id,
                "profesorado_nombre": carrera.nombre,
                "plan_id": plan.id,
                "plan_resolucion": plan.resolucion,
                "materias": carton_materias
            })

    # --- 5. MOTOR DE RECOMENDACIONES DE INSCRIPCIÓN ---
    
    materias_sugeridas_data = []
    todas_las_materias_plan = set()
    for plan_data in carton_planes:
        for mat_data in plan_data["materias"]:
            todas_las_materias_plan.add(mat_data["materia_id"])

    materias_info = Materia.objects.filter(id__in=todas_las_materias_plan).prefetch_related(
        "correlativas_requeridas", "correlativas_requeridas__materia_correlativa"
    )

    for mat in materias_info:
        # Excluimos si ya está aprobada o si el alumno ya está cursándola
        if mat.id in aprobadas_set or mat.id in inscriptas_actuales_set:
            continue
            
        habilitada = True
        motivos = []
        correlativas = mat.correlativas_requeridas.all()
        
        for corr in correlativas:
            # Requisito: Aprobada para Cursar (APC)
            if corr.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
                if corr.materia_correlativa_id not in aprobadas_set:
                    habilitada = False
                    break
                motivos.append(f"{corr.materia_correlativa.nombre} (Aprobada)")
            # Requisito: Regular para Cursar (RPC) -> Sirve si está Regular o Aprobada
            elif corr.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
                es_reg = corr.materia_correlativa_id in regularizadas_set
                es_aprob = corr.materia_correlativa_id in aprobadas_set
                if not (es_reg or es_aprob):
                    habilitada = False
                    break
                motivos.append(f"{corr.materia_correlativa.nombre} ({'Aprobada' if es_aprob else 'Regular'})")

        if habilitada:
            materias_sugeridas_data.append({
                "materia_id": mat.id, "materia_nombre": mat.nombre, "anio": mat.anio_cursada,
                "cuatrimestre": mat.get_regimen_display(), "motivos": motivos
            })

    # Consolidación final del objeto de Trayectoria
    recomendaciones = RecomendacionesOut(
        materias_sugeridas=[MateriaSugerida(**item) for item in materias_sugeridas_data],
        finales_habilitados=[FinalHabilitado(**item) for item in finales_habilitados_data],
        alertas=alertas,
    )

    return TrayectoriaOut(
        estudiante=EstudianteResumen(
            dni=est.dni, legajo=est.legajo, 
            apellido_nombre=est.user.get_full_name() if est.user_id else "",
            carreras=carreras, carreras_detalle=carreras_detalle_data,
            materias_aprobadas=len(aprobadas_set),
            materias_regularizadas=len(regularizadas_set - aprobadas_set),
            materias_en_curso=len(inscriptas_actuales_set - regularizadas_set - aprobadas_set),
             legajo_estado=est.get_estado_legajo_display(),
            # ... otros campos mapeados directamente ...
        ),
        historial=[], # Reservado para eventos cronológicos futuros
        mesas=[TrayectoriaMesa(**m) for m in mesas_raw],
        regularidades=[RegularidadResumen(**r) for r in regularidades_resumen_data],
        recomendaciones=recomendaciones,
        regularidades_vigencia=[RegularidadVigenciaOut(**v) for v in regularidades_vigencia_data],
        aprobadas=sorted(list(aprobadas_set)),
        regularizadas=sorted(list(regularizadas_set - aprobadas_set)),
        inscriptas_actuales=sorted(list(inscriptas_actuales_set - aprobadas_set - regularizadas_set)),
        carton=carton_planes,
        updated_at=format_datetime(timezone.now()),
    )
