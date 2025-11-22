import os

from django.conf import settings
from django.http import FileResponse, Http404


def serve_media(request, path):
    file_path = os.path.join(settings.MEDIA_ROOT, path)
    if os.path.exists(file_path):
        with open(file_path, "rb") as f:
            return FileResponse(f)
    else:
        raise Http404
