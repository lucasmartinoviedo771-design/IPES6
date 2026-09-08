"""Base de conocimiento institucional estructurada para el Asistente IA de IPES6.

Contiene normativas, procedimientos, reglamentos (RAM) y respuestas a preguntas frecuentes.
"""

CONOCIMIENTO_INSTITUCIONAL = [
    {
        "id": "inscripcion_cursada",
        "titulo": "Inscripción a Cursadas de Materias",
        "fuente": "Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 12 a 16",
        "keywords": ["inscribir", "cursada", "materia", "comision", "anotarse", "requisitos"],
        "contenido": (
            "📌 **Fuente Oficial:** *Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 12 a 16*\n\n"
            "Para inscribirse a cursar una materia en el IPES Paulo Freire se deben cumplir los siguientes requisitos reglamentarios:\n"
            "1. La ventana de inscripción debe encontrarse formalmente abierta en el calendario académico institucional.\n"
            "2. Cumplir estrictamente con el régimen de correlatividades vigente de tu plan de estudios:\n"
            "   - **Regular para Cursar:** Tener la cursada regularizada de las materias previas obligatorias.\n"
            "   - **Aprobada para Cursar:** Tener el examen final aprobado o acreditado por promoción de las asignaturas previas.\n"
            "   - **Simultánea para Cursar:** Encontrarse inscripto en la materia correlativa simultánea en el mismo cuatrimestre.\n"
            "3. Contar con legajo activo y perfil institucional actualizado.\n"
            "Si no cumplís con alguna correlativa o tu regularidad venció, el sistema bloqueará la inscripción indicando el motivo puntual."
        ),
    },
    {
        "id": "mesas_examen",
        "titulo": "Mesas de Examen Final (Ordinarias y Extraordinarias)",
        "fuente": "Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 28 a 35",
        "keywords": ["mesa", "final", "rendir", "extraordinaria", "ordinaria", "tribunal", "examen"],
        "contenido": (
            "📌 **Fuente Oficial:** *Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 28 a 35*\n\n"
            "El régimen de exámenes finales estipula:\n"
            "1. **Mesas Ordinarias:** Tienen lugar en los turnos reglamentarios (Febrero/Marzo, Julio/Agosto y Noviembre/Diciembre).\n"
            "   - Condición Regular: Requiere tener la regularidad vigente (validez de 5 años según RAM) y todas las correlativas 'Aprobadas para Rendir' cumplimentadas.\n"
            "   - Modalidad Libre: Se rinde ante tribunal evaluador con instancia escrita y oral, siempre que el plan de estudios permita examen libre para dicha unidad curricular.\n"
            "2. **Mesas Extraordinarias (Turnos Especiales de Mayo y Septiembre):**\n"
            "   - Reservadas para estudiantes que adeuden hasta 3 materias para culminar la carrera o con causa justificada avalada por Coordinación Académica."
        ),
    },
    {
        "id": "equivalencias",
        "titulo": "Trámite de Solicitud de Equivalencias",
        "fuente": "Reglamento de Equivalencias IPES - Disposición N° 012/19 y RAM Art. 40",
        "keywords": ["equivalencia", "homologacion", "otra institucion", "materias de otra carrera", "tramite"],
        "contenido": (
            "📌 **Fuente Oficial:** *Reglamento de Equivalencias IPES - Disposición N° 012/19 y RAM Art. 40*\n\n"
            "Procedimiento oficial para homologar asignaturas cursadas en otras instituciones de nivel superior o universitario:\n"
            "1. Iniciar el trámite desde 'Trámites' -> 'Solicitud de Equivalencia' en el portal del estudiante dentro del período habilitado.\n"
            "2. Adjuntar obligatoriamente: Certificado analítico oficial legalizado de origen y programas analíticos firmados y sellados.\n"
            "3. La Comisión de Evaluación Docente y Coordinación emiten el dictamen. En caso de aprobación parcial, el estudiante deberá rendir un coloquio complementario."
        ),
    },
    {
        "id": "justificacion_inasistencias",
        "titulo": "Régimen de Asistencia y Justificación de Inasistencias",
        "fuente": "Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 18 a 22",
        "keywords": ["asistencia", "falta", "inasistencia", "medico", "certificado", "justificar", "porcentaje"],
        "contenido": (
            "📌 **Fuente Oficial:** *Régimen Académico Marco (RAM) - Res. MECCyT N° 045/18, Art. 18 a 22*\n\n"
            "Normativa de asistencia institucional:\n"
            "1. Asistencia mínima obligatoria: 75% de las clases dictadas en cada espacio curricular para conservar la condición de Regular (o 60% en casos contemplados con resguardo de salud o laboral comprobable).\n"
            "2. Plazo improrrogable: Los certificados médicos o laborales deben presentarse en Bedelía o cargarse en el sistema dentro de las **48 horas hábiles** posteriores a la inasistencia.\n"
            "3. La no presentación oportuna ocasiona la pérdida de regularidad (pasando a condición Libre)."
        ),
    },
    {
        "id": "certificado_alumno_regular",
        "titulo": "Certificado de Alumno Regular y Analítico",
        "fuente": "Guía de Autogestión y Trámites Bedelía IPES",
        "keywords": ["certificado", "alumno regular", "constancia", "analitico", "descargar"],
        "contenido": (
            "📌 **Fuente Oficial:** *Guía de Autogestión y Trámites Bedelía IPES*\n\n"
            "Gestión de certificados oficiales:\n"
            "1. **Certificado de Alumno Regular:** Podés generarlo y descargarlo inmediatamente en formato PDF con firma digital y validación QR desde el portal del estudiante.\n"
            "2. **Certificado Analítico Parcial / en Trámite:** Se gestiona en la sección 'Mis Trámites' -> 'Pedido de Analítico'. El tiempo estimado de confección por Bedelía es de 5 a 10 días hábiles."
        ),
    },
    {
        "id": "resguardo_correlatividades",
        "titulo": "Régimen de Resguardo y Cursada Condicional",
        "fuente": "Resolución Institucional de Resguardo N° 078/21 y RAM Art. 25",
        "keywords": ["resguardo", "condicional", "residencia", "practica", "autorizacion"],
        "contenido": (
            "📌 **Fuente Oficial:** *Resolución Institucional de Resguardo N° 078/21 y RAM Art. 25*\n\n"
            "Para unidades curriculares de Residencia y Prácticas Docentes finales:\n"
            "El Consejo Académico puede autorizar la cursada condicional 'Bajo Resguardo' mientras el estudiante rinde en las fechas inmediatas de exámenes las correlativas adeudadas.\n"
            "Si no se aprueban las materias requeridas antes del cierre del plazo estipulado en la disposición, la cursada condicional caduca de pleno derecho."
        ),
    },
]


import re

from apps.asistente_ia.knowledge.kb_loader import cargar_documentos_adicionales


def buscar_en_reglamento(consulta: str) -> str:
    """Busca en la base de conocimiento institucional (RAM + documentos PDF/TXT adicionales)."""
    consulta_norm = consulta.lower()
    coincidencias = []

    todos_los_items = list(CONOCIMIENTO_INSTITUCIONAL)
    try:
        adicionales = cargar_documentos_adicionales()
        todos_los_items.extend(adicionales)
    except Exception:
        pass

    palabras_consulta = [w for w in re.findall(r"\b\w+\b", consulta_norm) if len(w) > 3]

    for item in todos_los_items:
        puntaje = 0
        for kw in item.get("keywords", []):
            if re.search(r"\b" + re.escape(kw.lower()) + r"\b", consulta_norm):
                puntaje += 3

        for palabra in item.get("titulo", "").lower().split():
            if len(palabra) > 3 and re.search(r"\b" + re.escape(palabra) + r"\b", consulta_norm):
                puntaje += 2

        # Búsqueda en texto completo para PDFs y documentos largos
        texto_completo = item.get("texto_completo", "").lower()
        if texto_completo and palabras_consulta:
            coincidencias_palabras = sum(1 for p in palabras_consulta if p in texto_completo)
            if coincidencias_palabras >= 2:
                puntaje += coincidencias_palabras

        if puntaje > 0:
            coincidencias.append((puntaje, item))

    coincidencias.sort(key=lambda x: x[0], reverse=True)

    if not coincidencias:
        return (
            "⚠️ No se encontró una disposición específica en la base de reglamentos para tu consulta.\n\n"
            "Para trámites, excepciones o situaciones no contempladas en esta síntesis, te recomendamos consultar directamente "
            "con Bedelía o Secretaría Académica del IPES Paulo Freire."
        )

    # Devolver los 2 artículos o documentos más pertinentes
    seleccionados = [c[1]["contenido"] for c in coincidencias[:2]]
    return "\n\n---\n\n".join(seleccionados)
