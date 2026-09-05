"""
Resolución de la IP del cliente detrás de Cloudflare + nginx.

Contexto: el 100% de los eventos de AuditLog en producción registraban
172.18.0.1, el gateway de Docker. Ni la lectura del último elemento de
X-Forwarded-For (middleware y login) ni la del primero (preinscripciones)
devolvían la IP real.
"""

import pytest

from core.client_ip import get_client_ip


class Req:
    def __init__(self, **headers):
        self.META = {"REMOTE_ADDR": headers.pop("remote_addr", "172.18.0.1")}
        for k, v in headers.items():
            self.META[k] = v


def test_prefiere_cf_connecting_ip():
    """Con Cloudflare adelante es la única fuente que el cliente no controla."""
    r = Req(
        HTTP_CF_CONNECTING_IP="203.0.113.55",
        HTTP_X_FORWARDED_FOR="1.2.3.4, 203.0.113.55, 172.18.0.1",
    )
    assert get_client_ip(r) == "203.0.113.55"


def test_ignora_el_xff_falsificado_por_el_cliente():
    """
    nginx usa $proxy_add_x_forwarded_for, que agrega al valor recibido: si el
    cliente manda X-Forwarded-For, su valor queda primero. Cloudflare, en cambio,
    reescribe CF-Connecting-IP en cada request.
    """
    r = Req(
        HTTP_CF_CONNECTING_IP="203.0.113.55",
        HTTP_X_FORWARDED_FOR="6.6.6.6, 203.0.113.55, 172.18.0.1",
    )
    assert get_client_ip(r) == "203.0.113.55", "no debe creerle al encabezado que puso el cliente"


def test_no_devuelve_el_ultimo_salto_interno():
    """La regresión concreta: antes esto devolvía 172.18.0.1."""
    r = Req(
        HTTP_CF_CONNECTING_IP="203.0.113.55",
        HTTP_X_FORWARDED_FOR="203.0.113.55, 172.18.0.1",
    )
    ip = get_client_ip(r)
    assert ip != "172.18.0.1"
    assert not ip.startswith("172."), "una IP interna de Docker no identifica a nadie"


def test_sin_cloudflare_cae_a_xff():
    r = Req(HTTP_X_FORWARDED_FOR="203.0.113.55, 172.18.0.1")
    assert get_client_ip(r) == "203.0.113.55"


def test_indice_de_xff_configurable(settings):
    """Si cambia la cantidad de proxies, se ajusta por settings y no tocando código."""
    settings.CLIENT_IP_XFF_INDEX = -1
    r = Req(HTTP_X_FORWARDED_FOR="203.0.113.55, 10.0.0.9")
    assert get_client_ip(r) == "10.0.0.9"


def test_sin_encabezados_usa_remote_addr():
    assert get_client_ip(Req(remote_addr="198.51.100.3")) == "198.51.100.3"


def test_no_explota_sin_nada():
    r = Req(remote_addr="")
    assert get_client_ip(r) == ""


@pytest.mark.parametrize("xff", ["", "   ", ",,,"])
def test_xff_vacio_o_malformado(xff):
    r = Req(HTTP_X_FORWARDED_FOR=xff, remote_addr="198.51.100.3")
    assert get_client_ip(r) == "198.51.100.3"
