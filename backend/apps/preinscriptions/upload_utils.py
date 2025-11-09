import os

import magic

ALLOWED_EXTS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_BYTES = 10 * 1024 * 1024  # 10MB


def is_allowed(file_obj, size: int) -> tuple[bool, str | None]:
    """Valida un archivo comprobando su contenido real (magic bytes) y su tamaño.
    """
    # 1. Validar tamaño primero, es la comprobación más barata.
    if size > MAX_BYTES:
        return False, f"El archivo supera el máximo de {MAX_BYTES // (1024*1024)}MB"

    # 2. Validar tipo de contenido real usando python-magic
    try:
        # Leer los primeros bytes para la detección
        file_obj.seek(0)
        buffer = file_obj.read(2048)
        file_obj.seek(0)  # Resetear el puntero para futuras lecturas

        actual_mime = magic.from_buffer(buffer, mime=True)
    except Exception:
        # En un escenario real, se podría loggear la excepción e
        return False, "No se pudo determinar el tipo de archivo."

    if actual_mime not in ALLOWED_MIMES:
        return False, f"Tipo de archivo no permitido según su contenido: {actual_mime}"

    # 3. (Opcional) Comprobar la extensión como una capa extra.
    filename = getattr(file_obj, "name", "")
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTS:
        return False, f"Extensión no permitida: {ext}"

    return True, None
