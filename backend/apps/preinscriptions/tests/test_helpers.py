from types import SimpleNamespace
from datetime import date, timedelta

import pytest
from ninja.errors import HttpError
from django.core.cache import cache

from apps.preinscriptions import api as pre_api
from core.models import VentanaHabilitacion


@pytest.mark.django_db
def test_ventana_preinscripcion_activa_returns_latest():
    today = date.today()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
        desde=today - timedelta(days=10),
        hasta=today - timedelta(days=5),
        activo=True,
    )
    activa = VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=5),
        activo=True,
    )

    result = pre_api._ventana_preinscripcion_activa()

    assert result == activa


@pytest.mark.django_db
def test_check_rate_limit_blocks_after_threshold(settings):
    cache.clear()
    settings.PREINS_RATE_LIMIT_PER_HOUR = 2

    request = SimpleNamespace(META={"REMOTE_ADDR": "10.0.0.1"})

    pre_api._check_rate_limit(request)
    pre_api._check_rate_limit(request)

    with pytest.raises(HttpError):
        pre_api._check_rate_limit(request)
