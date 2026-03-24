"""
API para la gestión de archivos y documentación de Preinscripciones.
Permite la subida, listado, descarga y eliminación de documentos adjuntos
(DNI, Títulos, Partidas de Nacimiento) necesarios para el legajo del aspirante.
"""

import logging
from django.db.models import Q
from django.http import FileResponse
from django.utils.text import get_valid_filename
from ninja import File, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from core.auth_ninja import JWTAuth
from .models_uploads import PreinscripcionArchivo
from .upload_utils import is_allowed
from apps.common.date_utils import format_datetime

logger = logging.getLogger(__name__)

# Definición del router con tag específico para la documentación OpenAPI
router = Router(tags=["preinscripciones:archivos"])


def require_auth(request):
    """Verificación rápida de autenticación para endpoints protegidos."""
    if not request.user.is_authenticated:
        raise HttpError(401, "No se ha proporcionado una sesión válida.")


@router.get("{pid}/documentos", auth=JWTAuth())
def listar_documentos(request, pid: int, q: str | None = None):
    """
    Lista todos los documentos asociados a una solicitud de preinscripción.
    Soporta filtrado por tipo de documento o nombre original del archivo.
    """
    require_auth(request)
    qs = PreinscripcionArchivo.objects.filter(preinscripcion_id=pid).order_by("-creado_en")
    
    if q:
        qs = qs.filter(Q(tipo__icontains=q) | Q(nombre_original__icontains=q))
        
    items = [
        {
            "id": x.id,
            "tipo": x.tipo,
            "nombre_original": x.nombre_original,
            "tamano": x.tamano,
            "content_type": x.content_type,
            "url": request.build_absolute_uri(x.archivo.url) if x.archivo else None,
            "creado_en": format_datetime(x.creado_en),
        }
        for x in qs
    ]
    return {"count": len(items), "results": items}


@router.post("{pid}/documentos", auth=JWTAuth())
def subir_documento(request, pid: int, file: UploadedFile = File(...), tipo: str = None):  # noqa: B008
    """
    Carga un nuevo archivo para el expediente del aspirante.
    Realiza validaciones de extensión y tamaño antes de persistir en el almacenamiento.
    """
    require_auth(request)

    logger.info(
        f"Iniciando subida para preinscripción {pid}: {file.name} ({file.size} bytes), tipo: {tipo}"
    )

    # Validación de seguridad: extensión y límites de tamaño configurados
    ok, err = is_allowed(file, file.size)
    if not ok:
        logger.error(f"Rechazo de archivo por política de seguridad: {err}")
        raise HttpError(400, err or "El formato de archivo no está permitido.")

    # Normalización del nombre para evitar inyectores de path
    safe_name = get_valid_filename(file.name)

    try:
        obj = PreinscripcionArchivo.objects.create(
            preinscripcion_id=pid,
            tipo=tipo,
            archivo=file,
            nombre_original=safe_name,
            tamano=file.size,
            content_type=getattr(file, "content_type", "") or "",
            subido_por_id=request.user.id,
        )
        logger.info(f"Documento almacenado exitosamente con ID {obj.id}")
    except Exception as e:
        logger.exception("Fallo crítico al persistir documento en base de datos.")
        raise HttpError(500, "No se pudo guardar el archivo debido a un error interno.") from e

    return {"id": obj.id, "detail": "Subida exitosa."}


@router.delete("{pid}/documentos/{doc_id}", auth=JWTAuth())
def borrar_documento(request, pid: int, doc_id: int):
    """
    Elimina un documento y su correspondiente archivo físico en el servidor.
    Esta acción es irreversible.
    """
    require_auth(request)
    try:
        obj = PreinscripcionArchivo.objects.get(id=doc_id, preinscripcion_id=pid)
    except PreinscripcionArchivo.DoesNotExist:
        raise HttpError(404, "El documento solicitado no existe.") from None

    # Borrado físico del archivo en el sistema de archivos / S3
    obj.archivo.delete(save=False)
    # Borrado del registro en base de datos
    obj.delete()
    return {"detail": "Documento eliminado correctamente."}


@router.get("{pid}/documentos/{doc_id}/download", auth=JWTAuth())
def descargar_documento(request, pid: int, doc_id: int):
    """
    Inicia la descarga de un documento específico.
    Retorna un FileResponse con las cabeceras de adjunto (Content-Disposition: attachment).
    """
    require_auth(request)
    try:
        obj = PreinscripcionArchivo.objects.get(id=doc_id, preinscripcion_id=pid)
    except PreinscripcionArchivo.DoesNotExist:
        raise HttpError(404, "El documento solicitado no existe.") from None

    if not obj.archivo:
        raise HttpError(404, "El archivo físico no se encuentra disponible.")
        
    return FileResponse(
        obj.archivo.open("rb"), 
        as_attachment=True, 
        filename=obj.nombre_original
    )
