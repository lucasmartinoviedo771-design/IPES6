"""Herramientas de diagnóstico de correlatividades y requisitos de inscripción para el Asistente IA."""

import logging
from datetime import date

from django.db.models import Q

from apps.estudiantes.api.helpers import _correlatividades_qs, _tiene_aprobacion_valida
from core.models import (
    ActaExamenEstudiante,
    Comision,
    Correlatividad,
    Estudiante,
    InscripcionMateriaEstudiante,
    Materia,
    MesaExamen,
    Regularidad,
)

logger = logging.getLogger(__name__)


import re


def _resolver_materia(estudiante: Estudiante, termino: str) -> Materia | None:
    """Busca una materia por ID o coincidencia flexible en lenguaje natural."""
    if not termino:
        return None

    termino_str = str(termino).strip()
    if termino_str.isdigit():
        mat = Materia.objects.filter(id=int(termino_str)).first()
        if mat:
            return mat

    # Obtener materias del plan de estudio de las carreras del estudiante
    prof_ids = list(estudiante.carreras.values_list("id", flat=True))
    candidatas_qs = (
        Materia.objects.filter(plan_de_estudio__profesorado_id__in=prof_ids) if prof_ids else Materia.objects.all()
    )

    # 1. Coincidencia directa icontains
    mat_directa = candidatas_qs.filter(nombre__icontains=termino_str).first()
    if mat_directa:
        return mat_directa

    # 2. Si la consulta es una frase, verificar si el nombre de alguna materia de la carrera está contenido en el texto
    termino_lower = termino_str.lower()
    for m in candidatas_qs:
        if len(m.nombre) >= 4 and m.nombre.lower() in termino_lower:
            return m

    # 3. Búsqueda por palabras significativas (> 4 caracteres excluyendo stopwords)
    stopwords = {"inscribir", "inscribirme", "cursar", "rendir", "puedo", "materia", "final", "mesa"}
    palabras = [w for w in re.findall(r"\b[a-záéíóúñ]{4,}\b", termino_lower) if w not in stopwords]
    for p in palabras:
        mat_p = candidatas_qs.filter(nombre__icontains=p).first()
        if mat_p:
            return mat_p

    # Fallback global fuera del profesorado
    return Materia.objects.filter(nombre__icontains=termino_str).first()


def _esta_aprobada(estudiante: Estudiante, materia: Materia) -> bool:
    """Determina si el estudiante ya tiene aprobada la materia según la lógica canónica del sistema."""
    return _tiene_aprobacion_valida(estudiante, materia)


def diagnosticar_inscripcion_cursada(user, materia_query: str) -> dict:
    """
    Diagnostica si el estudiante puede inscribirse a cursar una materia específica
    y detalla exactamente qué correlativas o requisitos le faltan.
    """
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {
            "error": "La consulta de diagnóstico solo está disponible para usuarios con perfil de estudiante.",
            "puede_inscribirse": False,
        }

    materia = _resolver_materia(estudiante, materia_query)
    if not materia:
        return {
            "error": f"No se encontró ninguna materia que coincida con '{materia_query}'. Verificá el nombre exacto.",
            "puede_inscribirse": False,
        }

    # 1. ¿Ya la tiene aprobada?
    if _esta_aprobada(estudiante, materia):
        return {
            "materia": materia.nombre,
            "id": materia.id,
            "anio_cursada": materia.anio_cursada,
            "puede_inscribirse": False,
            "estado_actual": "Aprobada",
            "motivo_bloqueo": "Ya tenés esta materia completamente aprobada en tu historial académico.",
            "requisitos_faltantes": [],
        }

    # 2. ¿Ya está cursándola actualmente?
    cursando_actual = InscripcionMateriaEstudiante.objects.filter(
        estudiante=estudiante,
        comision__materia=materia,
        estado="CONFIRMADA",
    ).first()

    if cursando_actual:
        comision = cursando_actual.comision
        return {
            "materia": materia.nombre,
            "id": materia.id,
            "puede_inscribirse": False,
            "estado_actual": "En Cursada",
            "motivo_bloqueo": f"Ya te encontrás inscripto cursando en la comisión '{comision.codigo}' ({comision.anio_lectivo}).",
            "requisitos_faltantes": [],
        }

    # 3. Validación de Correlatividades
    req_reg = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )
    req_apr = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )
    req_sim = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.SIMULTANEA_PARA_CURSAR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )

    faltantes = []
    autorizadas_ids = set(estudiante.materias_autorizadas.values_list("id", flat=True))

    # Chequeo de correlativas regulares
    for mid in req_reg:
        if mid in autorizadas_ids:
            continue
        m_corr = Materia.objects.filter(id=mid).first()
        nombre_m = m_corr.nombre if m_corr else f"Materia #{mid}"
        tiene_regular = Regularidad.objects.filter(
            estudiante=estudiante,
            materia_id=mid,
            situacion=Regularidad.Situacion.REGULAR,
            en_resguardo=False,
        ).exists()
        aprobada = m_corr and _esta_aprobada(estudiante, m_corr)
        if not tiene_regular and not aprobada:
            faltantes.append(f"Tener regularizada: {nombre_m}")

    # Chequeo de correlativas aprobadas
    for mid in req_apr:
        if mid in autorizadas_ids:
            continue
        m_corr = Materia.objects.filter(id=mid).first()
        nombre_m = m_corr.nombre if m_corr else f"Materia #{mid}"
        if not m_corr or not _esta_aprobada(estudiante, m_corr):
            faltantes.append(f"Tener examen final aprobado de: {nombre_m}")

    # Chequeo de correlativas simultáneas
    for mid in req_sim:
        if mid in autorizadas_ids:
            continue
        m_corr = Materia.objects.filter(id=mid).first()
        nombre_m = m_corr.nombre if m_corr else f"Materia #{mid}"
        esta_simultanea = InscripcionMateriaEstudiante.objects.filter(
            estudiante=estudiante,
            comision__materia_id=mid,
            estado="CONFIRMADA",
        ).exists()
        aprobada = m_corr and _esta_aprobada(estudiante, m_corr)
        if not esta_simultanea and not aprobada:
            faltantes.append(f"Estar cursando simultáneamente: {nombre_m}")

    puede = len(faltantes) == 0

    return {
        "materia": materia.nombre,
        "id": materia.id,
        "anio_cursada": materia.anio_cursada,
        "puede_inscribirse": puede,
        "estado_actual": "Habilitada para cursar" if puede else "Bloqueada por correlatividades",
        "requisitos_faltantes": faltantes,
        "mensaje": (
            f"¡Estás en condiciones de inscribirte a {materia.nombre}!"
            if puede
            else f"Para poder inscribirte a {materia.nombre}, necesitás cumplir previamente con los siguientes requisitos: {', '.join(faltantes)}."
        ),
    }


def diagnosticar_inscripcion_mesa(user, materia_query: str) -> dict:
    """Diagnostica si el estudiante puede inscribirse a rendir examen final de una materia."""
    estudiante = getattr(user, "estudiante", None)
    if not estudiante:
        return {
            "error": "La consulta solo está disponible para estudiantes.",
            "puede_rendir": False,
        }

    materia = _resolver_materia(estudiante, materia_query)
    if not materia:
        return {
            "error": f"No se encontró la materia '{materia_query}'.",
            "puede_rendir": False,
        }

    if _esta_aprobada(estudiante, materia):
        return {
            "materia": materia.nombre,
            "puede_rendir": False,
            "motivo": "Ya aprobaste esta materia definitivamente.",
            "mesas_disponibles": [],
        }

    # 1. Regularidad
    reg = (
        Regularidad.objects.filter(
            estudiante=estudiante,
            materia=materia,
            situacion=Regularidad.Situacion.REGULAR,
            en_resguardo=False,
        )
        # Regularidad no tiene anio_cursada; se ordena por la fecha de cierre
        # para quedarse con la regularidad más reciente de esa materia.
        .order_by("-fecha_cierre", "-id")
        .first()
    )

    es_regular = reg is not None

    # 2. Correlativas aprobadas para rendir
    req_rendir = list(
        _correlatividades_qs(materia, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR, estudiante).values_list(
            "materia_correlativa_id", flat=True
        )
    )

    faltantes = []
    for mid in req_rendir:
        m_corr = Materia.objects.filter(id=mid).first()
        nombre_m = m_corr.nombre if m_corr else f"Materia #{mid}"
        if not m_corr or not _esta_aprobada(estudiante, m_corr):
            faltantes.append(f"Aprobada: {nombre_m}")

    # 3. Mesas activas
    mesas_qs = MesaExamen.objects.filter(
        materia=materia,
        planilla_cerrada_en__isnull=True,
        fecha__gte=date.today(),
    ).order_by("fecha", "hora_desde")

    mesas_data = []
    for m in mesas_qs:
        mesas_data.append(
            {
                "fecha": m.fecha.strftime("%d/%m/%Y"),
                "hora": m.hora_desde.strftime("%H:%M") if m.hora_desde else "A confirmar",
                "tipo": m.get_tipo_display() if hasattr(m, "get_tipo_display") else m.tipo,
                "modalidad": "Regular" if m.modalidad == "REG" else "Libre",
                "presidente": str(m.docente_presidente) if m.docente_presidente else "A designar",
            }
        )

    puede_rendir = (es_regular or materia.permite_mesa_libre) and len(faltantes) == 0

    return {
        "materia": materia.nombre,
        "es_regular": es_regular,
        "anio_regularidad": reg.materia.anio_cursada if reg else None,
        "puede_rendir": puede_rendir,
        "correlativas_faltantes": faltantes,
        "mesas_programadas": mesas_data,
        "mensaje": (
            f"Podés rendir {materia.nombre}. Hay {len(mesas_data)} mesa(s) programada(s)."
            if puede_rendir
            else f"No podés rendir {materia.nombre} todavía: "
            + (f"Te faltan correlativas: {', '.join(faltantes)}. " if faltantes else "")
            + ("No tenés la cursada regularizada." if not es_regular and not materia.permite_mesa_libre else "")
        ),
    }
