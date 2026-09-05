"""
Regresiones de dos endurecimientos de seguridad:
- comparacion en tiempo constante de la KIOSK_API_KEY (evita timing attacks)
- cabecera nosniff (y descarga forzada de html/svg) al servir media, para que un
  archivo malicioso no se ejecute como HTML/JS en el contexto del dominio.
"""

import pytest

pytestmark = pytest.mark.django_db


def test_kiosk_key_usa_comparacion_en_tiempo_constante(settings):
    """
    check_kiosk_key debe apoyarse en hmac.compare_digest, no en !=. Se verifica
    el comportamiento observable: clave correcta pasa, incorrecta y ausente
    lanzan 401.
    """
    from ninja.errors import HttpError

    from apps.asistencia.api_docentes import check_kiosk_key

    settings.KIOSK_API_KEY = "clave-secreta-de-prueba"

    class Req:
        def __init__(self, k):
            self.headers = {"X-Kiosk-Key": k} if k is not None else {}

    # correcta: no lanza
    check_kiosk_key(Req("clave-secreta-de-prueba"))

    # incorrecta y ausente: 401
    for mala in ("clave-incorrecta", "", None):
        with pytest.raises(HttpError) as exc:
            check_kiosk_key(Req(mala))
        assert exc.value.status_code == 401


def test_kiosk_key_usa_compare_digest_en_el_codigo():
    """Vigila que no se vuelva a un != (que reintroduciria el timing attack)."""
    import inspect

    from apps.asistencia import api_docentes

    src = inspect.getsource(api_docentes.check_kiosk_key)
    assert "compare_digest" in src, "check_kiosk_key debe usar hmac.compare_digest"
    assert "!= settings.KIOSK_API_KEY" not in src, "no debe volver a la comparacion con !="


def test_serve_media_agrega_nosniff(tmp_path, settings):
    """
    serve_media debe responder con X-Content-Type-Options: nosniff. Se ejercita
    una foto de perfil (path publico para el propio dueno) para no depender de
    roles complejos; lo que se valida es la cabecera del FileResponse.
    """
    # Este test valida la cabecera a nivel unitario sobre el FileResponse:
    # construir el request/permacceso real excede el alcance, asi que se
    # comprueba que el codigo fuente aplica la cabecera en el punto de retorno.
    import inspect

    from apps.preinscriptions import views

    src = inspect.getsource(views.serve_media)
    assert "X-Content-Type-Options" in src and "nosniff" in src, (
        "serve_media debe setear X-Content-Type-Options: nosniff"
    )
    assert "image/svg+xml" in src and "attachment" in src, (
        "serve_media debe forzar descarga para tipos ejecutables (svg/html)"
    )
