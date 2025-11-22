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

logger = logging.getLogger(__name__)

router = Router(tags=["preinscripciones:archivos"])


def require_auth(request):
    if not request.user.is_authenticated:
        raise HttpError(401, "No autenticado")


@router.get("{pid}/documentos", auth=JWTAuth())
def listar_documentos(request, pid: int, q: str | None = None):
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
            "creado_en": x.creado_en.isoformat(),
        }
        for x in qs
    ]
    return {"count": len(items), "results": items}


@router.post("{pid}/documentos", auth=JWTAuth())
def subir_documento(request, pid: int, file: UploadedFile = File(...), tipo: str = None):  # noqa: B008
    require_auth(request)

    logger.info(
        f"Subiendo documento para preinscripción {pid}, tipo {tipo}, archivo {file.name}, "
        f"tamaño {file.size}, content_type {file.content_type}"
    )

    ok, err = is_allowed(file, file.size)
    if not ok:
        logger.error(f"Archivo no permitido: {err}")
        raise HttpError(400, err or "Archivo no permitido")

    safe_name = get_valid_filename(file.name)

    try:
        obj = PreinscripcionArchivo.objects.create(
            preinscripcion_id=pid,
            tipo=tipo,
            archivo=file,
            nombre_original=safe_name,
            tamano=file.size,
            content_type=getattr(file, "content_type", "") or "",
            subido_por_id=request.user.id if request.user.is_authenticated else None,
        )
        logger.info(f"Archivo guardado con id {obj.id}")
    except Exception as e:
        logger.exception("Error guardando archivo en la base de datos")
        raise HttpError(500, "Error interno al guardar el archivo") from e

    return {"id": obj.id, "detail": "ok"}


@router.delete("{pid}/documentos/{doc_id}", auth=JWTAuth())
def borrar_documento(request, pid: int, doc_id: int):
    require_auth(request)
    try:
        obj = PreinscripcionArchivo.objects.get(id=doc_id, preinscripcion_id=pid)
    except PreinscripcionArchivo.DoesNotExist:
        raise HttpError(404, "No encontrado") from None

    obj.archivo.delete(save=False)
    obj.delete()
    return {"detail": "deleted"}


@router.get("{pid}/documentos/{doc_id}/download", auth=JWTAuth())
def descargar_documento(request, pid: int, doc_id: int):
    require_auth(request)
    try:
        obj = PreinscripcionArchivo.objects.get(id=doc_id, preinscripcion_id=pid)
    except PreinscripcionArchivo.DoesNotExist:
        raise HttpError(404, "No encontrado") from None

    if not obj.archivo:
        raise HttpError(404, "Archivo inexistente")
    return FileResponse(obj.archivo.open("rb"), as_attachment=True, filename=obj.nombre_original)
