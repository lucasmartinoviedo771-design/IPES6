"""
Middlewares globales del sistema IPES6.
Contiene lógica transversal para todas las peticiones, como rastreo de auditoría y
normalización de metadatos de request.
"""

import uuid


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
        # Identificador único hexadecimal para esta petición específica
        request.request_id = uuid.uuid4().hex
        
        # Recupera la clave de sesión si existe (para trazas de usuario persistentes)
        request.audit_session_id = getattr(getattr(request, "session", None), "session_key", None)
        
        # Captura la IP de origen, considerando proxies (Nginx/Cloudflare)
        request.audit_ip = self._get_client_ip(request)
        
        response = self.get_response(request)
        return response

    @staticmethod
    def _get_client_ip(request):
        """
        Resuelve la IP real del cliente analizando encabezados de proxy.
        """
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            # En configuraciones con múltiples saltos, la primera IP es la original del cliente
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
