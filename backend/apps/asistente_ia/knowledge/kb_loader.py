"""Cargador dinámico de normativas y documentos institucionales (.pdf, .txt, .md).

Lee los archivos ubicados en la carpeta de documentos, extrae el texto e indexa
los artículos y secciones en la base de conocimiento del Asistente IA.
"""

import logging
import re
from pathlib import Path

logger = logging.getLogger(__name__)

DOCUMENTOS_DIR = Path(__file__).resolve().parent / "documentos"

# Caché en memoria del proceso. Sin esto se releían y parseaban todos los PDF en
# cada consulta al reglamento, que es la herramienta más usada del asistente.
# La firma es el conjunto de (nombre, tamaño, fecha de modificación) de los
# archivos: si alguien agrega, cambia o borra un documento, la firma cambia y se
# recarga sola, sin reiniciar el servidor.
_cache_documentos: list[dict] | None = None
_cache_firma: tuple | None = None


def _firma_directorio() -> tuple:
    if not DOCUMENTOS_DIR.exists():
        return ()
    entradas = []
    for archivo in sorted(DOCUMENTOS_DIR.iterdir()):
        try:
            st = archivo.stat()
            entradas.append((archivo.name, st.st_size, int(st.st_mtime)))
        except OSError:
            continue
    return tuple(entradas)


def extraer_texto_de_archivo(ruta_archivo: Path) -> str:
    """Extrae el contenido textual según el tipo de archivo (.pdf, .txt, .md)."""
    sufijo = ruta_archivo.suffix.lower()

    if sufijo in [".txt", ".md"]:
        # cp1252 antes que latin-1: los documentos exportados desde Word suelen
        # venir en esa codificación, y latin-1 los lee igual pero convierte las
        # comillas tipográficas en caracteres basura. Eso ensucia justo las
        # definiciones entrecomilladas del reglamento, que son las que más se
        # buscan. latin-1 queda como último recurso porque nunca falla.
        for codificacion in ("utf-8", "cp1252", "latin-1"):
            try:
                return ruta_archivo.read_text(encoding=codificacion)
            except UnicodeDecodeError:
                continue
            except Exception as e:  # noqa: BLE001
                logger.error("Error leyendo archivo de texto %s: %s", ruta_archivo.name, e)
                return ""
        return ""

    if sufijo == ".pdf":
        try:
            import pypdf

            reader = pypdf.PdfReader(str(ruta_archivo))
            paginas = []
            for page in reader.pages:
                texto_pagina = page.extract_text() or ""
                if texto_pagina.strip():
                    paginas.append(texto_pagina.strip())
            return "\n\n".join(paginas)
        except Exception as e:
            logger.error("Error extrayendo texto del PDF %s: %s", ruta_archivo.name, e)
            return ""

    return ""


# Un fragmento apunta a entrar completo en el contexto del modelo sin desplazar
# al resto de la conversación. ~1800 caracteres son unas 450 palabras: alcanza
# para un artículo con su inciso y no dispara el costo por consulta.
TAMANIO_FRAGMENTO = 1800
SOLAPE = 200

# "Art. 23°.-", "Artículo 5º:", "ARTICULO 12 -", "Art 7°".
# La parte "ículo" es opcional: el reglamento abrevia "Art." casi siempre.
_PATRON_ARTICULO = re.compile(r"(?im)^\s*(art(?:[íi]culo)?s?\.?\s*N?[°ºo]?\s*(\d{1,3}))\s*[°º]?\s*[.:\-]")

# Encabezados de los manuales de uso: "## Cargar notas", "### Errores frecuentes"
# y también títulos en mayúsculas sostenidas, que es como suelen escribirse.
_PATRON_ENCABEZADO = re.compile(r"(?m)^\s{0,3}(?:#{1,4}\s+(.+?)|([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,.:()/-]{6,70}))\s*$")


def _titulo_del_fragmento(texto: str, orden: int) -> str:
    """
    Referencia legible del fragmento: el artículo, el título de sección, o el orden.

    En las normas se usa el número de artículo. Un fragmento puede agrupar varios
    artículos cortos, y rotularlo solo con el primero era engañoso: el que
    contiene los requisitos de Residencia (Art. 19) aparecía como "Art. 18".

    En los manuales de uso no hay artículos sino encabezados ("## Cargar notas").
    Sin esto la cita decía "manual-docente.txt (parte 4)", que no le dice nada a
    quien la lee; con el encabezado dice de qué procedimiento se trata.
    """
    numeros = [m.group(2) for m in _PATRON_ARTICULO.finditer(texto)]
    if numeros:
        if len(numeros) == 1:
            return f"Art. {numeros[0]}"
        return f"Art. {numeros[0]} a {numeros[-1]}"

    # El patrón tiene dos alternativas (markdown y mayúsculas): se toma la que casó.
    encabezados = [(m.group(1) or m.group(2) or "").strip(" #*:").strip() for m in _PATRON_ENCABEZADO.finditer(texto)]
    encabezados = [t for t in encabezados if 3 < len(t) <= 70]
    if encabezados:
        if len(encabezados) == 1:
            return encabezados[0]
        return f"{encabezados[0]} (y {len(encabezados) - 1} más)"

    return f"parte {orden}"


def _partir_por_tamanio(bloque: str) -> list[str]:
    """
    Parte un bloque largo respetando los límites de palabra.

    Cortar por posición dejaba fragmentos que empezaban a mitad de palabra
    ("uivalencia de unidades curriculares"), que confunden a quien lee la cita.
    Se retrocede hasta el espacio anterior, salvo que quede demasiado corto.
    """
    partes: list[str] = []
    inicio = 0
    while inicio < len(bloque):
        fin = min(inicio + TAMANIO_FRAGMENTO, len(bloque))
        if fin < len(bloque):
            corte = bloque.rfind(" ", inicio + TAMANIO_FRAGMENTO // 2, fin)
            if corte != -1:
                fin = corte
        parte = bloque[inicio:fin].strip()
        if parte:
            partes.append(parte)
        if fin >= len(bloque):
            break
        # El solape también arranca en un límite de palabra.
        retroceso = max(inicio + 1, fin - SOLAPE)
        espacio = bloque.find(" ", retroceso)
        inicio = (espacio + 1) if espacio != -1 and espacio < fin else fin
    return partes


def fragmentar(texto: str) -> list[str]:
    """
    Parte un documento en bloques que quepan en el contexto del modelo.

    Se corta por artículo cuando el documento los tiene (es la unidad natural de
    una norma y permite citar "Art. 23"). Los artículos muy largos se subdividen
    por tamaño, y los muy cortos se agrupan para no generar cientos de fragmentos
    de dos líneas. Cuando no hay artículos —el calendario, por ejemplo— se corta
    por tamaño con un solape que evita perder una fecha justo en el borde.
    """
    texto = (texto or "").strip()
    if not texto:
        return []

    cortes = [m.start() for m in _PATRON_ARTICULO.finditer(texto)]
    if len(cortes) >= 3:
        bloques = []
        for i, inicio in enumerate(cortes):
            fin = cortes[i + 1] if i + 1 < len(cortes) else len(texto)
            bloques.append(texto[inicio:fin].strip())
        if cortes[0] > 0:
            # Todo lo anterior al primer artículo (visto, considerandos, encabezado).
            bloques.insert(0, texto[: cortes[0]].strip())
    else:
        bloques = [p.strip() for p in re.split(r"\n\s*\n", texto) if p.strip()] or [texto]

    fragmentos: list[str] = []
    acumulado = ""
    for bloque in bloques:
        # Un bloque más largo que el tamaño objetivo se parte con solape.
        if len(bloque) > TAMANIO_FRAGMENTO:
            if acumulado:
                fragmentos.append(acumulado.strip())
                acumulado = ""
            fragmentos.extend(_partir_por_tamanio(bloque))
            continue
        # Los bloques chicos se agrupan hasta llenar el fragmento.
        if len(acumulado) + len(bloque) + 2 > TAMANIO_FRAGMENTO:
            fragmentos.append(acumulado.strip())
            acumulado = bloque
        else:
            acumulado = f"{acumulado}\n\n{bloque}" if acumulado else bloque
    if acumulado.strip():
        fragmentos.append(acumulado.strip())

    return [f for f in fragmentos if f]


def cargar_documentos_adicionales() -> list[dict]:
    """
    Escanea la carpeta 'documentos/' y devuelve una lista de fragmentos documentales
    estructurados listos para ser consumidos por el motor de búsqueda institucional.
    """
    global _cache_documentos, _cache_firma

    if not DOCUMENTOS_DIR.exists():
        return []

    firma = _firma_directorio()
    if _cache_documentos is not None and firma == _cache_firma:
        return _cache_documentos

    documentos = []
    for archivo in DOCUMENTOS_DIR.iterdir():
        if archivo.name.startswith(".") or archivo.name.lower().startswith("readme"):
            continue

        if archivo.suffix.lower() in [".pdf", ".txt", ".md"]:
            texto = extraer_texto_de_archivo(archivo)
            if not texto.strip():
                continue

            # Nombre legible del archivo sin extensión
            nombre_limpio = archivo.stem.replace("_", " ").replace("-", " ")
            keywords_doc = [w.lower() for w in nombre_limpio.split() if len(w) > 3]

            # Cada fragmento se indexa por separado. Antes el documento entraba
            # como un solo item y se devolvían sus primeros 3000 caracteres: la
            # búsqueda acertaba el documento pero mostraba el encabezado en vez
            # del artículo consultado. Con el reglamento (63.829 caracteres) eso
            # dejaba fuera casi todo el articulado.
            for orden, fragmento in enumerate(fragmentar(texto), start=1):
                referencia = _titulo_del_fragmento(fragmento, orden)
                documentos.append(
                    {
                        "id": f"doc_{archivo.stem.lower()}_{orden}",
                        "titulo": f"{nombre_limpio} — {referencia}",
                        "fuente": f"Documento Oficial: {archivo.name}",
                        "keywords": keywords_doc,
                        "contenido": (f"📌 **Fuente Oficial:** *{archivo.name}* ({referencia})\n\n{fragmento}"),
                        # La búsqueda puntúa sobre el fragmento, no sobre el
                        # documento entero: así gana el pasaje pertinente.
                        "texto_completo": fragmento,
                    }
                )

    _cache_documentos = documentos
    _cache_firma = firma
    logger.info("[ASISTENTE_KB] fragmentos indexados: %d", len(documentos))
    return documentos
