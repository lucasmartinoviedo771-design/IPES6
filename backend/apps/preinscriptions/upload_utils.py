import mimetypes
import os

ALLOWED_EXTS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_MIMES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_BYTES = 10 * 1024 * 1024  # 10MB

def is_allowed(filename: str, content_type: str, size: int) -> tuple[bool, str | None]:
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTS:
        return False, f"Extensión no permitida: {ext}"

    if content_type and content_type not in ALLOWED_MIMES:
        return False, f"Tipo de archivo no permitido: {content_type}"

    if size > MAX_BYTES:
        return False, f"Archivo supera el máximo de {MAX_BYTES // (1024*1024)}MB"

    return True, None
