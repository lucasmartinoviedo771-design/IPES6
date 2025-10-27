"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

# Keep GLib from probing UWP handlers when WeasyPrint loads on Windows
os.environ["GIO_USE_VFS"] = "local"
os.environ.setdefault("GIO_USE_VOLUME_MONITOR", "local")

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

application = get_asgi_application()
