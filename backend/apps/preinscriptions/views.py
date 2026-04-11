import os

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponse


PUBLIC_PREFIXES = ("preinscripciones/",)

def serve_media(request, path):
    media_root = os.path.realpath(settings.MEDIA_ROOT)
    file_path = os.path.realpath(os.path.join(media_root, path))

    # Anti path-traversal
    if not file_path.startswith(media_root + os.sep):
        raise Http404

    # Rutas privadas requieren auth
    is_public = any(path.startswith(prefix) for prefix in PUBLIC_PREFIXES)
    if not is_public and not request.user.is_authenticated:
        return HttpResponse(status=401)

    if not os.path.isfile(file_path):
        raise Http404

    return FileResponse(open(file_path, "rb"))
