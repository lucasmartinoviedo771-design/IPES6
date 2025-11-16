import uuid


class AuditRequestMiddleware:
    """
    Agrega identificadores de request y session a cada petición para facilitar
    la trazabilidad en los registros de auditoría.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = uuid.uuid4().hex
        request.audit_session_id = getattr(getattr(request, "session", None), "session_key", None)
        request.audit_ip = self._get_client_ip(request)
        response = self.get_response(request)
        return response

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            # Puede contener una lista "ip1, ip2"
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")
