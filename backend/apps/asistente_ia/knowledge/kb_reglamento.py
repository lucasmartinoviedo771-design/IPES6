"""Base de conocimiento institucional del Asistente IA de IPES6.

El conocimiento proviene ÚNICAMENTE de los documentos que la institución carga en
`knowledge/documentos/` (reglamento académico, disposiciones, calendario). El
cargador los parte en fragmentos y esta búsqueda devuelve el pasaje pertinente,
citando el archivo y el artículo.

No se escriben normas acá. Hubo una lista embebida con seis "artículos"
redactados a mano que contradecía el Régimen Académico —decía 75% de asistencia
cuando el Art. 24°.d fija 80%/65%, y 5 años de validez de la regularidad cuando
el Art. 17°.a fija 2— y citaba resoluciones inexistentes. Ganaba la búsqueda por
palabras clave y tapaba al reglamento real, de modo que el asistente respondía
con datos falsos y apariencia de fuente oficial. Se eliminó: una sola fuente de
verdad, la que la institución cargó y puede actualizar sin tocar código.
"""

# Se conserva la constante vacía para no romper importaciones. Si alguna vez
# hiciera falta contenido propio, va como documento en knowledge/documentos/,
# no acá.
CONOCIMIENTO_INSTITUCIONAL: list[dict] = []


import math
import re
import unicodedata
from collections import Counter

from apps.asistente_ia.knowledge.kb_loader import cargar_documentos_adicionales

# Palabras demasiado comunes para discriminar: aparecen en casi todos los
# artículos y hacían ganar al fragmento equivocado por puro volumen.
_VACIAS = {
    "para",
    "como",
    "cual",
    "cuales",
    "cuando",
    "cuanto",
    "cuantos",
    "cuanta",
    "cuantas",
    "donde",
    "porque",
    "puedo",
    "tengo",
    "quiero",
    "necesito",
    "debo",
    "hacer",
    "pasa",
    "sobre",
    "esta",
    "este",
    "unos",
    "unas",
    "alguna",
    "alguno",
    "materia",
    "alumno",
    "alumnos",
    "estudiante",
    "estudiantes",
}


# Índice de vocabulario: traduce cómo pregunta un estudiante a cómo lo escribe
# la norma. El reglamento dice "inasistencias" y el estudiante escribe "faltas";
# dice "regular" 41 veces y "regularidad" solo 5. Sin esta traducción la búsqueda
# no encuentra el artículo aunque esté bien indexado.
#
# Es un índice de términos, no de artículos: no fija "asistencia -> Art. 24", así
# que sigue sirviendo si mañana cambia la numeración del reglamento.
SINONIMOS = {
    "falta": ["inasistencia", "asistencia"],
    "faltas": ["inasistencias", "asistencia"],
    "faltar": ["inasistencia"],
    "ausencia": ["inasistencia", "ausente"],
    "presentismo": ["asistencia"],
    "regularidad": ["regular", "regularizado", "regularizacion"],
    "regularizar": ["regular", "regularizado"],
    "vencimiento": ["vigencia", "validez"],
    "vence": ["vigencia", "validez"],
    "caduca": ["vigencia", "validez"],
    "promocionar": ["promocion", "promocional", "promocionar"],
    "promociono": ["promocion", "promocional"],
    "recursar": ["recursar", "cursada"],
    "justificar": ["justificada", "justificacion", "justifique"],
    "certificado": ["certificado", "constancia", "analitico"],
    "analitico": ["analitico", "certificado"],
    "correlativa": ["correlatividades", "correlativas"],
    "correlativas": ["correlatividades"],
    "nota": ["calificacion", "nota"],
    "notas": ["calificaciones", "calificacion"],
    "aprobar": ["aprobacion", "aprobado", "acreditacion"],
    "desaprobar": ["desaprobado", "desaprobados"],
    "rendir": ["examen", "mesa", "rendir"],
    "final": ["examen final", "final", "mesa"],
    "libre": ["libre", "libres"],
    "equivalencia": ["equivalencia", "equivalencias"],
    "residencia": ["residencia", "pedagogica"],
    "titulo": ["titulo", "certificado"],
    "inscribirme": ["inscripcion", "inscribirse"],
    "anotarme": ["inscripcion", "inscribirse"],
    "tramite": ["tramite", "solicitud"],
    "plazo": ["plazo", "termino", "fecha"],
}


LARGO_RAIZ = 6


def _raiz(palabra: str) -> str:
    """
    Raíz aproximada por truncamiento.

    Evita mantener una entrada por cada forma verbal: "promociona",
    "promocionar" y "promoción" comparten la raíz "promoc", y así encuentran el
    artículo aunque el diccionario no las liste una por una. Se trunca a 6
    caracteres porque raíces más cortas empiezan a confundir palabras distintas
    ("comisión" con "comunidad").
    """
    return palabra[:LARGO_RAIZ] if len(palabra) > LARGO_RAIZ else palabra


def _expandir(palabras: list[str]) -> list[str]:
    """Suma los términos que usa la norma para lo que preguntó el estudiante."""
    expandidas = list(palabras)
    for p in palabras:
        # Sinónimos por palabra exacta y por raíz, para cubrir las conjugaciones.
        for clave in (p, _raiz(p)):
            for sinonimo in SINONIMOS.get(clave, []):
                expandidas.extend(sinonimo.split())
        # Plural simple: "inasistencias" también debe encontrar "inasistencia".
        if len(p) > 4 and p.endswith("s"):
            expandidas.append(p[:-1])
    # Sin duplicados, conservando el orden.
    return list(dict.fromkeys(expandidas))


def _sin_tildes(texto: str) -> str:
    """Minúsculas y sin acentos: 'Pedagógica' y 'pedagogica' deben coincidir."""
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii")
    return texto.lower()


def buscar_en_reglamento(consulta: str) -> str:
    """
    Busca el pasaje pertinente entre los documentos institucionales cargados.

    La comparación ignora acentos y mayúsculas: sin eso, una consulta escrita sin
    tildes —lo habitual— no encontraba "Residencia Pedagógica" y terminaba
    devolviendo el artículo equivocado.
    """
    consulta_norm = _sin_tildes(consulta)
    coincidencias = []

    todos_los_items = list(CONOCIMIENTO_INSTITUCIONAL)
    try:
        adicionales = cargar_documentos_adicionales()
        todos_los_items.extend(adicionales)
    except Exception:
        pass

    palabras_consulta = _expandir([w for w in re.findall(r"\b\w+\b", consulta_norm) if len(w) > 3 and w not in _VACIAS])

    # Ranking BM25, el estándar para buscar texto por relevancia. Resuelve dos
    # cosas que los intentos artesanales no lograban: pesa cada palabra por lo
    # rara que sea (una que aparece en todos los artículos no distingue nada) y
    # normaliza por longitud, para que un artículo largo no gane sólo por tener
    # más texto donde acertar.
    K1, B = 1.5, 0.75

    # Se indexa por raíz para que "inasistencias" en el texto responda a
    # "inasistencia" en la consulta, sin necesidad de listar cada variante.
    palabras_por_item = [
        [_raiz(w) for w in re.findall(r"\b\w+\b", _sin_tildes(it.get("texto_completo", "")))] for it in todos_los_items
    ]
    largos = [len(p) for p in palabras_por_item]
    largo_promedio = (sum(largos) / len(largos)) if largos else 1.0
    total = max(len(todos_los_items), 1)

    palabras_consulta = list(dict.fromkeys(_raiz(p) for p in palabras_consulta))
    frecuencias = [Counter(p) for p in palabras_por_item]
    en_cuantos = {p: sum(1 for f in frecuencias if p in f) for p in palabras_consulta}

    for indice, item in enumerate(todos_los_items):
        puntaje = 0.0
        frec, largo = frecuencias[indice], largos[indice] or 1

        for palabra in palabras_consulta:
            apariciones = frec.get(palabra, 0)
            if not apariciones:
                continue
            df = en_cuantos.get(palabra, 0)
            idf = math.log(1 + (total - df + 0.5) / (df + 0.5))
            puntaje += idf * (apariciones * (K1 + 1)) / (apariciones + K1 * (1 - B + B * largo / largo_promedio))

        # El número de artículo mencionado en el título ayuda poco, pero un
        # acierto en el nombre del documento sí orienta ("disposicion", "libre").
        for kw in item.get("keywords", []):
            if re.search(r"\b" + re.escape(_sin_tildes(kw)) + r"\b", consulta_norm):
                puntaje += 0.5

        if puntaje > 0:
            coincidencias.append((puntaje, item))

    coincidencias.sort(key=lambda x: x[0], reverse=True)

    if not coincidencias:
        return (
            "⚠️ No se encontró una disposición específica en la base de reglamentos para tu consulta.\n\n"
            "Para trámites, excepciones o situaciones no contempladas en esta síntesis, te recomendamos consultar directamente "
            "con Bedelía o Secretaría Académica del IPES Paulo Freire."
        )

    # Se devuelven los 4 pasajes más pertinentes, no el primero: ninguna búsqueda
    # por palabras acierta siempre en el puesto 1, y el artículo correcto suele
    # quedar segundo o tercero. Con varios pasajes a la vista el modelo elige el
    # que responde y cita el artículo; son ~7000 caracteres, holgados para el
    # contexto y sin impacto real en el costo.
    seleccionados = [c[1]["contenido"] for c in coincidencias[:4]]
    return "\n\n---\n\n".join(seleccionados)
