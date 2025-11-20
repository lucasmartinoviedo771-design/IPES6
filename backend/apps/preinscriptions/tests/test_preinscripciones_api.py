from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from django.contrib.auth.models import Group, User
from ninja.errors import HttpError

from apps.preinscriptions.api import (
    _generar_codigo,
    activar_preinscripcion,
    agregar_carrera,
    confirmar_por_codigo,
    crear_o_actualizar,
    eliminar_preinscripcion,
    listar_por_alumno,
    observar,
    rechazar,
)
from apps.preinscriptions.schemas import ChecklistIn, PreinscripcionIn, AlumnoIn
from core.models import Estudiante, Preinscripcion, Profesorado, VentanaHabilitacion


def _active_window():
    today = date.today()
    return VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=5),
        activo=True,
    )


def _payload(carrera_id: int) -> PreinscripcionIn:
    alumno_data = AlumnoIn(
        dni="12345678",
        nombres="Prueba",
        apellido="Uno",
        fecha_nacimiento=date(2000, 1, 1),
        email="prueba1@example.com",
        telefono="1234",
        domicilio="Calle 123",
    )
    return PreinscripcionIn(
        carrera_id=carrera_id,
        foto_4x4_dataurl=None,
        alumno=alumno_data,
        captcha_token=None,
        honeypot=None,
    )


@pytest.mark.django_db
def test_crear_preinscripcion_exitoso(settings):
    settings.RECAPTCHA_SECRET_KEY = ""
    _active_window()
    carrera = Profesorado.objects.create(
        nombre="Profesorado Test",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )

    request = SimpleNamespace(META={"REMOTE_ADDR": "10.0.0.1"})
    payload = _payload(carrera.id)

    resp = crear_o_actualizar(request, payload)

    pre = Preinscripcion.objects.get(carrera=carrera, alumno__dni="12345678")
    assert resp.ok is True
    assert pre.estado == "Enviada"
    assert pre.codigo.startswith(f"PRE-{date.today().year}")
    assert pre.alumno.user.username == "12345678"


@pytest.mark.django_db
def test_crear_preinscripcion_rechaza_sin_ventana_activa(settings):
    settings.RECAPTCHA_SECRET_KEY = ""
    carrera = Profesorado.objects.create(
        nombre="Profesorado Sin Ventana",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    request = SimpleNamespace(META={"REMOTE_ADDR": "10.0.0.2"})
    payload = _payload(carrera.id)

    with pytest.raises(HttpError) as exc:
        crear_o_actualizar(request, payload)

    assert exc.value.status_code == 403
    assert "habilitado" in str(exc.value)


@pytest.mark.django_db
def test_confirmar_por_codigo_actualiza_estado_y_flags(django_user_model):
    user = django_user_model.objects.create_user(username="staff", password="admin123", is_staff=True)
    staff_request = SimpleNamespace(user=user)
    alumno_user = User.objects.create_user(username="12312312")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="12312312")
    carrera = Profesorado.objects.create(
        nombre="Profesorado Confirmacion",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    pre = Preinscripcion.objects.create(
        alumno=estudiante,
        carrera=carrera,
        anio=date.today().year,
        estado="Enviada",
        activa=True,
    )
    pre.codigo = _generar_codigo(pre.id)
    pre.save(update_fields=["codigo"])
    Group.objects.get_or_create(name="alumno")

    payload = ChecklistIn(curso_introductorio_aprobado=True)

    resp = confirmar_por_codigo(staff_request, pre.codigo, payload)

    pre.refresh_from_db()
    estudiante.refresh_from_db()
    alumno_user.refresh_from_db()
    assert resp.ok is True
    assert pre.estado == "Confirmada"
    assert estudiante.must_change_password is True
    assert estudiante.carreras.filter(id=carrera.id).exists()
    assert alumno_user.check_password(f"Pass{estudiante.dni}")


@pytest.mark.django_db
def test_observar_y_rechazar_cambian_estado(django_user_model):
    user = django_user_model.objects.create_user(username="staff2", password="admin123", is_staff=True)
    request = SimpleNamespace(user=user)
    alumno_user = User.objects.create_user(username="9999")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="9999")
    carrera = Profesorado.objects.create(nombre="Prof Obs", duracion_anios=4, activo=True, inscripcion_abierta=True)
    pre = Preinscripcion.objects.create(alumno=estudiante, carrera=carrera, anio=date.today().year, estado="Enviada", activa=True)
    pre.codigo = _generar_codigo(pre.id)
    pre.save(update_fields=["codigo"])

    resp_obs = observar(request, pre.codigo, motivo="falta doc")
    pre.refresh_from_db()
    assert resp_obs["ok"] is True
    assert pre.estado == "Observada"

    resp_rech = rechazar(request, pre.codigo, motivo="rechazo")
    pre.refresh_from_db()
    assert resp_rech["ok"] is True
    assert pre.estado == "Rechazada"


@pytest.mark.django_db
def test_eliminar_y_activar_togglea_activa_y_estado(django_user_model):
    user = django_user_model.objects.create_user(username="staff3", password="admin123", is_staff=True)
    request = SimpleNamespace(user=user)
    alumno_user = User.objects.create_user(username="8888")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="8888")
    carrera = Profesorado.objects.create(nombre="Prof Toggle", duracion_anios=4, activo=True, inscripcion_abierta=True)
    pre = Preinscripcion.objects.create(alumno=estudiante, carrera=carrera, anio=date.today().year, estado="Enviada", activa=True)

    status, _ = eliminar_preinscripcion(request, pre.id)
    pre.refresh_from_db()
    assert status == 204
    assert pre.activa is False
    assert pre.estado == "Borrador"

    pre.codigo = _generar_codigo(pre.id)
    pre.save(update_fields=["codigo"])
    pre.estado = "Borrador"
    pre.save(update_fields=["estado"])

    activated = activar_preinscripcion(request, pre.id)
    pre.refresh_from_db()
    assert activated.id == pre.id
    assert pre.activa is True
    assert pre.estado == "Enviada"


@pytest.mark.django_db
def test_agregar_carrera_crea_nueva_preinscripcion_y_bloquea_duplicado(django_user_model):
    user = django_user_model.objects.create_user(username="staff4", password="admin123", is_staff=True)
    request = SimpleNamespace(user=user)
    alumno_user = User.objects.create_user(username="7777")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="7777")
    carrera_actual = Profesorado.objects.create(nombre="Prof A", duracion_anios=4, activo=True, inscripcion_abierta=True)
    carrera_nueva = Profesorado.objects.create(nombre="Prof B", duracion_anios=4, activo=True, inscripcion_abierta=True)
    pre = Preinscripcion.objects.create(alumno=estudiante, carrera=carrera_actual, anio=date.today().year, estado="Enviada", activa=True)
    pre.codigo = _generar_codigo(pre.id)
    pre.save(update_fields=["codigo"])

    resp = agregar_carrera(request, pre.codigo, SimpleNamespace(carrera_id=carrera_nueva.id, anio=None))
    assert resp.ok is True
    creada = Preinscripcion.objects.get(carrera=carrera_nueva, alumno=estudiante)
    assert creada.estado == "Enviada"
    assert creada.codigo.startswith(f"PRE-{date.today().year}")

    status_dup, api_resp = agregar_carrera(request, pre.codigo, SimpleNamespace(carrera_id=carrera_nueva.id, anio=None))
    assert status_dup == 400
    assert api_resp.ok is False


@pytest.mark.django_db
def test_listar_por_alumno_devuelve_historico_ordered(django_user_model):
    user = django_user_model.objects.create_user(username="staff5", password="admin123", is_staff=True)
    request = SimpleNamespace(user=user)
    alumno_user = User.objects.create_user(username="6666")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="6666")
    carrera = Profesorado.objects.create(nombre="Prof Hist", duracion_anios=4, activo=True, inscripcion_abierta=True)
    pre1 = Preinscripcion.objects.create(alumno=estudiante, carrera=carrera, anio=2024, estado="Enviada", activa=True)
    pre2 = Preinscripcion.objects.create(alumno=estudiante, carrera=carrera, anio=2025, estado="Confirmada", activa=True)
    pre1.codigo = _generar_codigo(pre1.id)
    pre2.codigo = _generar_codigo(pre2.id)
    Preinscripcion.objects.bulk_update([pre1, pre2], ["codigo"])

    listado = listar_por_alumno(request, estudiante.dni)

    assert len(listado) == 2
    assert listado[0]["codigo"] == pre2.codigo  # más reciente por anio/created_at
    assert listado[1]["codigo"] == pre1.codigo
