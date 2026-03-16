from __future__ import annotations
from typing import List, Dict, Set, Any
from ninja import Router, Schema
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from apps.common.api_schemas import ApiResponse
from core.models import (
    Estudiante, Materia, Correlatividad, Regularidad,
    ActaExamenEstudiante, InscripcionMateriaEstudiante,
    InscripcionMesa
)
from core.auth_ninja import JWTAuth, ensure_roles
from apps.estudiantes.api.helpers import _acta_condicion, _correlatividades_qs
from .router import estudiantes_router
from core.permissions import allowed_profesorados
from collections import defaultdict

class StudentEligibilityDetail(Schema):
    dni: str
    nombre: str
    apellido: str
    habilitado: bool
    motivos: List[str]
    situacion: str  # "APROBADA", "REGULAR", "EN_CURSO", "PENDIENTE"
    cohorte: int | None = None

class AnalisisMateriaOut(Schema):
    materia_id: int
    materia_nombre: str
    estudiantes: List[StudentEligibilityDetail]

@estudiantes_router.get("/analisis-correlatividades/{materia_id}", response={200: AnalisisMateriaOut, 403: ApiResponse})
@ensure_roles(["admin", "secretaria", "bedel"])
def analizar_habilitados_materia(request, materia_id: int):
    materia = get_object_or_404(Materia.objects.select_related("plan_de_estudio__profesorado"), id=materia_id)
    profesorado = materia.plan_de_estudio.profesorado

    # Permisos
    allowed = allowed_profesorados(request.user, role_filter=["bedel"])
    if allowed is not None and profesorado.id not in allowed:
        return 403, ApiResponse(ok=False, message="No tiene permisos sobre este profesorado.")

    # Estudiantes del profesorado
    estudiantes_qs = Estudiante.objects.filter(carreras_detalle__profesorado=profesorado).select_related("persona")
    estudiantes_list = list(estudiantes_qs)
    
    # Optimizamos carga de datos academicos
    estudiantes_dnis = [est.persona.dni for est in estudiantes_list]
    estudiantes_ids = [est.id for est in estudiantes_list]

    # Pre-cargar todas las regularidades y actas de los estudiantes (podría ser MUCHA data, pero restringimos por plan)
    # Mejor traer solo lo que necesitamos. Pero necesitamos las aprobadas para las correlativas.
    # Como no sabemos qué correlativas tienen sin mirar al estudiante, traemos TODO el historial de estos estudiantes
    # de materias del mismo profesorado/plan.
    
    plan_materias_ids = list(Materia.objects.filter(plan_de_estudio__profesorado=profesorado).values_list("id", flat=True))

    regularidades = Regularidad.objects.filter(
        materia_id__in=plan_materias_ids,
        estudiante_id__in=estudiantes_ids
    )
    actas = ActaExamenEstudiante.objects.filter(
        acta__materia_id__in=plan_materias_ids,
        dni__in=estudiantes_dnis
    ).select_related("acta")
    
    inscripciones = InscripcionMateriaEstudiante.objects.filter(
        materia_id__in=plan_materias_ids,
        estudiante_id__in=estudiantes_ids,
        estado__in=[InscripcionMateriaEstudiante.Estado.CONFIRMADA, InscripcionMateriaEstudiante.Estado.PENDIENTE]
    )

    # Estado académico por DNI
    # Usamos un dict plano para evitar lints de defaultdict
    student_academic_state: Dict[str, Dict[str, Set[int]]] = {}
    for est in estudiantes_list:
        student_academic_state[est.persona.dni] = {
            "aprobadas": set(),
            "regulares": set(),
            "en_curso": set()
        }

    for r in regularidades:
        # Necesitamos el DNI del estudiante de la regularidad. R tiene estudiante_id.
        # Buscamos en el mapeo id -> dni
        dni = next((e.persona.dni for e in estudiantes_list if e.id == r.estudiante_id), None)
        if not dni: continue
        
        if r.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
            student_academic_state[dni]["aprobadas"].add(r.materia_id)
        elif r.situacion == Regularidad.Situacion.REGULAR:
            student_academic_state[dni]["regulares"].add(r.materia_id)

    for a in actas:
        if a.dni not in student_academic_state: continue
        cond_val, _ = _acta_condicion(a.calificacion_definitiva)
        is_equiv = (
            (a.permiso_examen == "EQUIV") or 
            (a.acta.codigo and a.acta.codigo.startswith("EQUIV-")) or
            (a.acta.observaciones and "Equivalencia" in a.acta.observaciones)
        )
        if cond_val == "APR" or is_equiv:
            student_academic_state[a.dni]["aprobadas"].add(a.acta.materia_id)

    for i in inscripciones:
        # i has estudiante_id
        dni = next((e.persona.dni for e in estudiantes_list if e.id == i.estudiante_id), None)
        if not dni: continue
        student_academic_state[dni]["en_curso"].add(i.materia_id)

    results = []
    
    # Pre-cache de correlativas por materia (sin filtrar por version aun)
    # correlativas_all = Correlatividad.objects.filter(materia_origen=materia).select_related("materia_correlativa")
    # Pero usamos el helper que es más seguro.
    
    for est in estudiantes_list:
        sdni = est.persona.dni
        state = student_academic_state[sdni]
        
        # Situacion de la materia actual
        situacion = "PENDIENTE"
        if materia.id in state["aprobadas"]:
            situacion = "APROBADA"
        elif materia.id in state["en_curso"]:
            situacion = "EN_CURSO"
        elif materia.id in state["regulares"]:
            situacion = "REGULAR"
            
        # Chequeo de correlativas (específicas para este estudiante)
        habilitado = True
        motivos = []
        
        if situacion == "APROBADA":
            habilitado = False
            motivos.append("Ya aprobó esta materia.")
        else:
            # Consultamos la versión de correlatividades vigente para este estudiante
            from core.models import CorrelatividadVersion
            prof_id = materia.plan_de_estudio.profesorado_id
            cohorte = est.obtener_anio_ingreso(prof_id)
            version = CorrelatividadVersion.vigente_para(
                plan_id=materia.plan_de_estudio_id,
                profesorado_id=prof_id,
                cohorte=cohorte,
            )
            
            correlativas_qs = Correlatividad.objects.filter(materia_origen=materia).select_related("materia_correlativa")
            if version:
                correlativas_qs = correlativas_qs.filter(versiones__version=version)
            
            for corr in correlativas_qs:
                if corr.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR:
                    if corr.materia_correlativa_id not in state["aprobadas"]:
                        habilitado = False
                        motivos.append(f"Falta aprobar {corr.materia_correlativa.nombre}")
                elif corr.tipo == Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR:
                    es_reg = corr.materia_correlativa_id in state["regulares"]
                    es_aprob = corr.materia_correlativa_id in state["aprobadas"]
                    if not (es_reg or es_aprob):
                        habilitado = False
                        motivos.append(f"Falta regularizar {corr.materia_correlativa.nombre}")
                elif corr.tipo == Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR:
                    if corr.materia_correlativa_id not in state["aprobadas"]:
                        motivos.append(f"Falta aprobar {corr.materia_correlativa.nombre} (requerida para rendir final)")

        results.append({
            "dni": sdni,
            "nombre": est.persona.nombre,
            "apellido": est.persona.apellido,
            "habilitado": habilitado,
            "motivos": motivos,
            "situacion": situacion,
            "cohorte": cohorte
        })

    return {
        "materia_id": materia.id,
        "materia_nombre": materia.nombre,
        "estudiantes": results
    }
