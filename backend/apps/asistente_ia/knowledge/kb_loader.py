"""Cargador dinámico de normativas y documentos institucionales (.pdf, .txt, .md).

Lee los archivos ubicados en la carpeta de documentos, extrae el texto e indexa
los artículos y secciones en la base de conocimiento del Asistente IA.
"""

import logging
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

            documentos.append(
                {
                    "id": f"doc_{archivo.stem.lower()}",
                    "titulo": nombre_limpio,
                    "fuente": f"Documento Oficial: {archivo.name}",
                    "keywords": [w.lower() for w in nombre_limpio.split() if len(w) > 3],
                    "contenido": f"📌 **Fuente Oficial:** *{archivo.name}*\n\n{texto[:3000]}",
                    "texto_completo": texto,
                }
            )

    _cache_documentos = documentos
    _cache_firma = firma
    logger.info("[ASISTENTE_KB] documentos indexados: %d", len(documentos))
    return documentos
