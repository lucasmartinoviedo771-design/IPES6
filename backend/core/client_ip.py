"""
Resolución de la IP real del cliente.

Punto único: antes esto estaba resuelto tres veces con criterios distintos
(`core/middleware.py`, `apps/management/auth_api.py` y
`apps/preinscriptions/services/rate_limiting.py`), y ninguna de las tres devolvía
la IP correcta en la infraestructura actual.

El síntoma medido: el 100% de los eventos de `AuditLog` en producción registraban
`172.18.0.1`, el gateway de la red Docker. Es decir que el registro de auditoría
no permitía rastrear nada, y que el rate limit por IP metía a todos los usuarios
en el mismo balde.

La causa es la cadena de proxies. `X-Forwarded-For` se va acumulando en cada
salto, así que el último elemento es el proxy inmediatamente anterior a Django
—dentro de Docker— y no el cliente. Y el primer elemento tampoco sirve: lo puede
poner el propio cliente, porque nginx usa `$proxy_add_x_forwarded_for`, que
agrega al valor recibido en lugar de reemplazarlo.
"""

from django.conf import settings

# Cloudflare sobrescribe este encabezado en cada request con la IP real del
# visitante, descartando lo que haya mandado el cliente.
CF_HEADER = "HTTP_CF_CONNECTING_IP"


def get_client_ip(request) -> str:
    """
    Devuelve la IP del cliente, o cadena vacía si no se puede determinar.

    Orden de preferencia:

    1. `CF-Connecting-IP`. Es la fuente confiable con Cloudflare adelante.

       **Condición para que valga:** el origen tiene que aceptar tráfico
       únicamente desde los rangos de Cloudflare (firewall, o `allow`/`deny` en
       nginx). Si el servidor responde a conexiones directas, cualquiera que
       averigüe su IP puede mandar este encabezado con el valor que quiera y
       falsear su identidad en la auditoría.

    2. `X-Forwarded-For`, tomando la posición que indique
       `CLIENT_IP_XFF_INDEX` (por defecto 0, que es donde Cloudflare deja la IP
       del visitante). Se usa solo si no hay encabezado de Cloudflare.

    3. `REMOTE_ADDR`, que detrás de un proxy es la IP del proxy. Último recurso.
    """
    cf_ip = request.META.get(CF_HEADER, "").strip()
    if cf_ip:
        return cf_ip

    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        ips = [ip.strip() for ip in xff.split(",") if ip.strip()]
        if ips:
            idx = getattr(settings, "CLIENT_IP_XFF_INDEX", 0)
            try:
                return ips[idx]
            except IndexError:
                return ips[0]

    return request.META.get("REMOTE_ADDR", "") or ""
