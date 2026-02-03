from __future__ import annotations

from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import (
    ActaExamenAlumno,
    InscripcionMateriaAlumno,
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
    HistorialAlumno,
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
from .router import alumnos_router


@alumnos_router.get("/historial", response=HistorialAlumno, auth=JWTAuth())
def historial_alumno(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return HistorialAlumno(aprobadas=[], regularizadas=[], inscriptas_actuales=[])

    aprobadas_set: set[int] = set()
    regularizadas_set: set[int] = set()
    inscriptas_actuales_set: set[int] = set()

    # 1. Regularidades
    regularidades_qs = Regularidad.objects.filter(estudiante=est)
    for reg in regularidades_qs:
        if reg.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            aprobadas_set.add(reg.materia_id)
        elif reg.situacion == Regularidad.Situacion.REGULAR:
            regularizadas_set.add(reg.materia_id)

    # 2. Actas de Examen (Incluye equivalencias)
    actas_alumno_qs = ActaExamenAlumno.objects.filter(dni=est.dni).select_related("acta")
    for a in actas_alumno_qs:
        cond_val, _ = _acta_condicion(a.calificacion_definitiva)
        
        # Robust equivalency detection (mirrors trayectoria_alumno)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        
        if cond_val == "APR" or is_equiv:
            aprobadas_set.add(a.acta.materia_id)

    # 3. Inscripciones a Mesa con resultado APROBADO
    inscripciones_mesa_qs = InscripcionMesa.objects.filter(
        estudiante=est, 
        condicion=InscripcionMesa.Condicion.APROBADO,
        estado=InscripcionMesa.Estado.INSCRIPTO
    ).select_related("mesa")
    for insc in inscripciones_mesa_qs:
        if insc.mesa and insc.mesa.materia_id:
            aprobadas_set.add(insc.mesa.materia_id)

    # 4. Inscripciones Actuales (Cursadas en curso o pendientes)
    inscriptas_actuales = list(
        InscripcionMateriaAlumno.objects.filter(
            estudiante=est,
            estado__in=[
                InscripcionMateriaAlumno.Estado.CONFIRMADA,
                InscripcionMateriaAlumno.Estado.PENDIENTE,
            ],
        ).values_list("materia_id", flat=True)
    )
    inscriptas_actuales_set.update(inscriptas_actuales)

    return HistorialAlumno(
        aprobadas=sorted(list(aprobadas_set)),
        regularizadas=sorted(list(regularizadas_set - aprobadas_set)),
        inscriptas_actuales=sorted(list(inscriptas_actuales_set)),
    )


@alumnos_router.get("/trayectoria", response={200: TrayectoriaOut, 404: ApiResponse})
def trayectoria_alumno(request, dni: str | None = None):
    est = _resolve_estudiante(request, dni)
    if not est:
        return 404, ApiResponse(ok=False, message="No se encontró el estudiante.")

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
    aprobadas_set: set[int] = set()
    regularizadas_set: set[int] = set()
    inscriptas_actuales_set: set[int] = set()

    preinscripciones = list(Preinscripcion.objects.filter(alumno=est).select_related("carrera").order_by("-created_at"))
    for pre in preinscripciones:
        eventos_raw.append(
            {
                "id": f"pre-{pre.id}",
                "tipo": "preinscripcion",
                "fecha": _to_iso(pre.created_at or pre.updated_at),
                "titulo": f"Preinscripción a {pre.carrera.nombre}",
                "subtitulo": pre.estado,
                "detalle": None,
                "estado": pre.estado,
                "profesorado_id": pre.carrera_id,
                "profesorado_nombre": pre.carrera.nombre,
                "metadata": _metadata_str(
                    {
                        "carrera": pre.carrera.nombre,
                        "anio": pre.anio,
                        "codigo": pre.codigo,
                    }
                ),
            }
        )

    inscripciones_qs = (
        InscripcionMateriaAlumno.objects.filter(estudiante=est)
        .select_related(
            "materia",
            "materia__plan_de_estudio",
            "materia__plan_de_estudio__profesorado",
            "comision",
            "comision__turno",
            "comision_solicitada",
        )
        .order_by("-created_at")
    )
    for insc in inscripciones_qs:
        detalle = None
        if insc.comision:
            detalle = f"Comisión {insc.comision.codigo}"
        elif insc.comision_solicitada:
            detalle = f"Cambio solicitado a {insc.comision_solicitada.codigo}"
        plan_estudio = getattr(insc.materia, "plan_de_estudio", None)
        profesorado = getattr(plan_estudio, "profesorado", None)
        eventos_raw.append(
            {
                "id": f"insc-{insc.id}",
                "tipo": "inscripcion_materia",
                "fecha": _to_iso(insc.created_at or insc.updated_at),
                "titulo": f"Inscripción a {insc.materia.nombre}",
                "subtitulo": f"Año académico {insc.anio}",
                "detalle": detalle,
                "estado": insc.estado,
                "profesorado_id": getattr(profesorado, "id", None),
                "profesorado_nombre": getattr(profesorado, "nombre", None),
                "metadata": _metadata_str(
                    {
                        "materia": insc.materia.nombre,
                        "materia_id": insc.materia_id,
                        "estado": insc.get_estado_display(),
                        "anio": insc.anio,
                    }
                ),
            }
        )
        inscriptas_actuales_set.add(insc.materia_id)

    regularidades_qs = (
        Regularidad.objects.filter(estudiante=est)
        .select_related("materia", "materia__plan_de_estudio", "materia__plan_de_estudio__profesorado")
        .order_by("-fecha_cierre")
    )

    hoy = timezone.now().date()
    for reg in regularidades_qs:
        vigencia_iso = None
        vigente = None
        dias_restantes: int | None = None
        if reg.situacion == Regularidad.Situacion.REGULAR:
            vigencia_limite, intentos = _calcular_vigencia_regularidad(est, reg)
            dias_restantes = (vigencia_limite - hoy).days
            vigente = dias_restantes >= 0
            vigencia_iso = vigencia_limite.isoformat()
            regularidades_vigencia_data.append(
                {
                    "materia_id": reg.materia_id,
                    "materia_nombre": reg.materia.nombre,
                    "situacion": reg.situacion,
                    "situacion_display": reg.get_situacion_display(),
                    "fecha_cierre": reg.fecha_cierre.isoformat(),
                    "vigencia_hasta": vigencia_iso,
                    "dias_restantes": dias_restantes,
                    "vigente": vigente,
                    "intentos_usados": intentos,
                    "intentos_max": 3,
                }
            )
            if vigente:
                comentarios: list[str] = []
                if dias_restantes <= 30:
                    comentarios.append("La regularidad vence en menos de 30 días.")
                finales_habilitados_data.append(
                    {
                        "materia_id": reg.materia_id,
                        "materia_nombre": reg.materia.nombre,
                        "regularidad_fecha": reg.fecha_cierre.isoformat(),
                        "vigencia_hasta": vigencia_iso,
                        "dias_restantes": dias_restantes,
                        "comentarios": comentarios,
                    }
                )
            else:
                alertas.append(f"La regularidad de {reg.materia.nombre} está vencida desde {vigencia_iso}.")

        regularidades_resumen_data.append(
            {
                "id": reg.id,
                "materia_id": reg.materia_id,
                "materia_nombre": reg.materia.nombre,
                "situacion": reg.situacion,
                "situacion_display": reg.get_situacion_display(),
                "fecha_cierre": reg.fecha_cierre.isoformat(),
                "nota_tp": (
                    float(reg.nota_trabajos_practicos) if reg.nota_trabajos_practicos is not None else None
                ),
                "nota_final": reg.nota_final_cursada,
                "asistencia": reg.asistencia_porcentaje,
                "excepcion": reg.excepcion,
                "observaciones": reg.observaciones,
                "vigencia_hasta": vigencia_iso,
                "vigente": vigente,
                "dias_restantes": dias_restantes,
            }
        )
        if reg.situacion in (
            Regularidad.Situacion.APROBADO,
            Regularidad.Situacion.PROMOCIONADO,
        ):
            aprobadas_set.add(reg.materia_id)
        if reg.situacion == Regularidad.Situacion.REGULAR:
            regularizadas_set.add(reg.materia_id)

    inscripciones_mesa_qs = (
        InscripcionMesa.objects.filter(estudiante=est, estado=InscripcionMesa.Estado.INSCRIPTO)
        .select_related("mesa__materia", "mesa__materia__plan_de_estudio", "mesa__materia__plan_de_estudio__profesorado")
        .order_by("-mesa__fecha")
    )
    for insc in inscripciones_mesa_qs:
        mesa = insc.mesa
        if not mesa:
            continue
        materia = mesa.materia
        plan_estudio = materia.plan_de_estudio if materia else None
        mesas_raw.append(
            {
                "id": insc.id,
                "mesa_id": mesa.id,
                "materia_id": materia.id if materia else 0,
                "materia_nombre": materia.nombre if materia else "",
                "tipo": mesa.tipo,
                "tipo_display": mesa.get_tipo_display(),
                "fecha": mesa.fecha.isoformat(),
                "estado": insc.condicion if insc.condicion else insc.estado,
                "estado_display": (insc.get_condicion_display() if insc.condicion else insc.get_estado_display()) or "",
                "nota": _format_nota(insc.nota),
                "aula": mesa.aula,
            }
        )

    # --- ACTAS DE EXAMEN ---
    actas_alumno_qs = (
        ActaExamenAlumno.objects.filter(dni=est.dni)
        .select_related("acta", "acta__materia")
        .order_by("-acta__fecha")
    )
    actas_map: dict[int, list[dict]] = {}
    for a in actas_alumno_qs:
        mid = a.acta.materia_id
        if mid not in actas_map:
            actas_map[mid] = []
        
        cond_val, cond_label = _acta_condicion(a.calificacion_definitiva)
        print(f"DEBUG: Processing acta ID {a.id}, initial cond: {cond_val}", flush=True)
        
        # Robust equivalency detection
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        
        folio_val = a.acta.folio
        if is_equiv:
            cond_val = "EQUI"
            cond_label = "Equivalencia"
            if a.acta.folio:
                fol_str = str(a.acta.folio).strip()
                if fol_str and not fol_str.upper().startswith("DISP"):
                    folio_val = f"Disp. {fol_str}"
        
        actas_map[mid].append({
            "fecha": a.acta.fecha.isoformat(),
            "condicion": cond_val,
            "condicion_display": cond_label,
            "nota": a.calificacion_definitiva,
            "folio": folio_val,
            "libro": a.acta.libro,
            "id_fila": a.id,
            "es_acta": True
        })
        
        if cond_val in ("APR", "EQUI"):
            aprobadas_set.add(mid)
    
    # --- CONSTRUCCION DEL CARTON (Verificacion de Planes) ---
    regularidades_map = {reg.materia_id: reg for reg in regularidades_qs}
    # Para finales, agrupamos TODAS las inscripciones por materia
    finales_map = {}
    for insc in inscripciones_mesa_qs:
        mid = insc.mesa.materia_id
        if mid not in finales_map:
            finales_map[mid] = []
        finales_map[mid].append(insc)
        
        if insc.condicion == InscripcionMesa.Condicion.APROBADO:
            # We add logic to define what is "approved".
            # Usually Nota >= 4 or just APROBADO enum. 
            # In this system, cond='APR' is enough.
            aprobadas_set.add(mid)

    for carrera in carreras_est:
        # Buscamos planes de estudio activos o relacionados a la carrera
        # Idealmente, buscamos el plan vigente
        planes = PlanDeEstudio.objects.filter(profesorado=carrera, vigente=True)
        if not planes:
             # Fallback: Traer todos si no hay vigentes explicitos
             planes = PlanDeEstudio.objects.filter(profesorado=carrera)
        
        for plan in planes:
            materias_plan = Materia.objects.filter(plan_de_estudio=plan).order_by("anio_cursada", "nombre")
            
            carton_materias = []
            for mat in materias_plan:
                reg = regularidades_map.get(mat.id)
                reg_data = None
                if reg:
                    reg_data = {
                        "fecha": reg.fecha_cierre.isoformat(),
                        "condicion": reg.situacion,
                        "nota": _format_nota(reg.nota_final_cursada) if reg.nota_final_cursada else None,
                        "folio": None, # Regularidad no suele tener folio en este modelo simple
                        "libro": None
                    }

                finales_list = finales_map.get(mat.id, [])
                actas_list = actas_map.get(mat.id, [])
                # Diccionario para unificar por fecha
                merged_finales = {}
                
                # 1. Agregar Inscripciones a Mesa
                for f in finales_list:
                    fecha_key = f.mesa.fecha.isoformat()
                    # Normalizar condicion para comparacion
                    c_val = f.condicion if f.condicion else "INS"
                    merged_finales[fecha_key] = {
                        "fecha": fecha_key,
                        "condicion": c_val,
                        "nota": _format_nota(f.nota),
                        "folio": f.folio,
                        "libro": f.libro,
                        "id_fila": f.id
                    }

                # 2. Agregar/Actualizar con Actas de Examen (tienen prioridad)
                for a_data in actas_list:
                    fecha_key = a_data["fecha"]
                    # El Acta tiene el resultado definitivo y la condicion 'EQUI'
                    merged_finales[fecha_key] = a_data
                
                carton_finales = sorted(merged_finales.values(), key=lambda x: x["fecha"], reverse=True)
                best_final = None
                
                # Encontrar el mejor resultado para el resumen de la materia
                for f_data in carton_finales:
                    if not best_final:
                        best_final = f_data
                    else:
                        is_aprob = f_data["condicion"] in ("APR", "EQUI")
                        best_aprob = best_final["condicion"] in ("APR", "EQUI")
                        if is_aprob and not best_aprob:
                            best_final = f_data
                
                # Ordenar finales por fecha descendente
                carton_finales.sort(key=lambda x: x["fecha"], reverse=True)
                
                final_data = best_final

                carton_materias.append({
                    "materia_id": mat.id,
                    "materia_nombre": mat.nombre,
                    "anio": mat.anio_cursada,
                    "regimen": mat.regimen,
                    "regimen_display": mat.get_regimen_display(),
                    "formato": mat.formato,
                    "formato_display": mat.get_formato_display(),
                    "regularidad": reg_data,
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

    estudiante_out = EstudianteResumen(
        dni=est.dni,
        legajo=est.legajo,
        apellido_nombre=est.user.get_full_name() if est.user_id else "",
        carreras=carreras,
        carreras_detalle=carreras_detalle_data,
        email=est.user.email if est.user_id else None,
        telefono=est.telefono or None,
        fecha_nacimiento=(est.fecha_nacimiento.isoformat() if est.fecha_nacimiento else None),
        lugar_nacimiento=None,
        curso_introductorio=None,
        promedio_general=None,
        libreta_entregada=bool(est.datos_extra.get("libreta_entregada")),
        legajo_estado=est.get_estado_legajo_display(),
        cohorte=None,
        activo=est.user.is_active if est.user_id else None,
        materias_totales=None,
        materias_aprobadas=len(aprobadas_set),
        materias_regularizadas=len(regularizadas_set - aprobadas_set),
        materias_en_curso=len(inscriptas_actuales_set - regularizadas_set - aprobadas_set),
        fotoUrl=None,
    )

    eventos_raw.sort(key=lambda item: item["fecha"], reverse=True)
    mesas_raw.sort(key=lambda item: item["fecha"], reverse=True)
    regularidades_resumen_data.sort(key=lambda item: item["fecha_cierre"], reverse=True)
    regularidades_vigencia_data.sort(key=lambda item: item["vigencia_hasta"] or "")
    finales_habilitados_data.sort(
        key=lambda item: (item["dias_restantes"] if item["dias_restantes"] is not None else 9999)
    )
    alertas = list(dict.fromkeys(alertas))

    recomendaciones = RecomendacionesOut(
        materias_sugeridas=[],
        finales_habilitados=[FinalHabilitado(**item) for item in finales_habilitados_data],
        alertas=alertas,
    )

    trayectoria = TrayectoriaOut(
        estudiante=estudiante_out,
        historial=[TrayectoriaEvento(**item) for item in eventos_raw],
        mesas=[TrayectoriaMesa(**item) for item in mesas_raw],
        regularidades=[RegularidadResumen(**item) for item in regularidades_resumen_data],
        recomendaciones=recomendaciones,
        regularidades_vigencia=[RegularidadVigenciaOut(**item) for item in regularidades_vigencia_data],
        aprobadas=sorted(aprobadas_set),
        regularizadas=sorted(regularizadas_set),
        inscriptas_actuales=sorted(inscriptas_actuales_set),
        carton=carton_planes,
        updated_at=timezone.now().isoformat(),
    )

    return trayectoria
