import threading
import uuid

from core.client_ip import get_client_ip

_thread_locals = threading.local()


def get_current_request():
    return getattr(_thread_locals, "request", None)


class AuditRequestMiddleware:
    """
    Middleware encargado de inyectar identificadores únicos de traza en cada petición.
    Facilita la correlación de logs y registros de auditoría durante el ciclo de vida
    de la request.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        """
        Inyecta request_id, audit_session_id y audit_ip en el objeto de petición.
        """
        _thread_locals.request = request
        # Identificador único hexadecimal para esta petición específica
        request.request_id = uuid.uuid4().hex

        # Recupera la clave de sesión si existe (para trazas de usuario persistentes)
        request.audit_session_id = getattr(getattr(request, "session", None), "session_key", None)

        # Captura la IP de origen, considerando proxies (Nginx/Cloudflare)
        request.audit_ip = self._get_client_ip(request)

        try:
            response = self.get_response(request)
        finally:
            if hasattr(_thread_locals, "request"):
                del _thread_locals.request
        return response

    @staticmethod
    def _get_client_ip(request):
        """Resuelve la IP real del cliente. Ver core/client_ip.py."""
        return get_client_ip(request)
