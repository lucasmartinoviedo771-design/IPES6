"""
Configuracion de pytest para los tests de core.

El punto importante acá es el caché: los tests corren contra la misma instancia
de Redis que usa la aplicación, así que sin aislamiento el estado que deja una
corrida contamina la siguiente y los tests dejan de ser reproducibles.

Eso no es hipotético. El test que verifica que un usuario sin permisos no puede
leer métricas pasaba con Redis vacío y fallaba con Redis poblado, porque el
endpoint devolvía una respuesta cacheada por otro usuario. El bug era real y
estaba en producción, pero el test tenía que fallar por el bug, no según el
estado en que hubiera quedado el caché.
"""

import os
import re

import pytest


@pytest.fixture(autouse=True)
def _cache_aislado(request, settings):
    """
    Por defecto los tests corren sin caché: cada lectura es un miss, que es lo
    que se quiere cuando el caché no es el objeto de la prueba.

    Un test que necesite comportamiento real de caché pide la fixture
    `cache_real`, y en ese caso esta no lo pisa.
    """
    if "cache_real" in request.fixturenames or "cache_redis" in request.fixturenames:
        return
    settings.CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}


@pytest.fixture
def cache_real(settings):
    """
    Caché en memoria, aislado por test, para las pruebas que verifican el
    comportamiento del caching en sí (que un HIT no saltee permisos, TTL,
    invalidación). Se usa LocMemCache y no Redis para no depender de un
    servicio externo ni ensuciar la base que usa la aplicación.
    """
    settings.CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "test-cache-aislado",
        }
    }
    from django.core.cache import cache

    cache.clear()
    yield cache
    cache.clear()


@pytest.fixture
def cache_redis(settings):
    """
    Redis real sobre una base aislada (la 15), para los tests que necesitan
    borrado por patron: LocMemCache no implementa delete_pattern, asi que con
    `cache_real` la invalidacion por evento no se puede verificar.

    Se salta el test si no hay Redis disponible, para no romper la suite en un
    entorno que no lo levante.
    """
    url = os.getenv("REDIS_URL", "redis://redis:6379/1")
    url_test = re.sub(r"/\d+$", "/15", url)

    settings.CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": url_test,
            "KEY_PREFIX": "ipes6test",
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }
    from django.core.cache import cache

    try:
        cache.clear()
    except Exception:  # noqa: BLE001
        pytest.skip("Redis no disponible para tests de invalidacion")

    yield cache
    cache.clear()
