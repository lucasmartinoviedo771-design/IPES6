"""
Cierre de planilla con actas orales pendientes de conformidad.

Regla institucional: cada estudiante tiene 10 minutos para prestar conformidad
sobre su acta oral, contados desde que se guarda SU propia acta (el plazo es por
acta, no por mesa). La planilla no puede cerrarse mientras alguno siga dentro de
su plazo sin haber respondido.

El vencimiento es lazy: no hay proceso de fondo. Por eso el cierre vence primero
las actas cuyo plazo ya expiro; sin eso, un estudiante que nunca abre la
aplicacion dejaria la planilla trabada para siempre.
"""

from datetime import date, timedelta

import pytest
from django.contrib.auth.models import Group, User
from django.utils import timezone

from apps.estudiantes.api.actas_orales import (
    PLAZO_CONFORMIDAD,
    vencer_actas_orales_expiradas,
)
from apps.estudiantes.api.planillas_finales_api import gestionar_mesa_planilla_cierre
from core.models import (
    Estudiante,
    InscripcionMesa,
    Materia,
    MesaActaOral,
    MesaExamen,
    Persona,
    PlanDeEstudio,
    Profesorado,
)

pytestmark = pytest.mark.django_db


class _Req:
    def __init__(self, user):
        self.user = user
        self.headers = {}


class _Cierre:
    def __init__(self, accion):
        self.accion = accion


@pytest.fixture
def secretaria():
    user = User.objects.create_user(username="40000001")
    group, _ = Group.objects.get_or_create(name="secretaria")
    user.groups.add(group)
    return user


@pytest.fixture
def mesa():
    prof = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-001/24", anio_inicio=2024)
    materia = Materia.objects.create(plan_de_estudio=plan, nombre="Pedagogia", anio_cursada=1, formato="ASI")
    return MesaExamen.objects.create(materia=materia, tipo="FIN", fecha=date(2026, 9, 7))


def _inscribir(mesa, dni, apellido):
    persona = Persona.objects.create(dni=dni, nombre="Ana", apellido=apellido)
    user = User.objects.create_user(username=dni)
    estudiante = Estudiante.objects.create(persona=persona, user=user)
    return InscripcionMesa.objects.create(mesa=mesa, estudiante=estudiante)


def _acta(mesa, inscripcion, minutos_atras=0):
    return MesaActaOral.objects.create(
        inscripcion=inscripcion,
        mesa=mesa,
        fecha=date(2026, 9, 7),
        nota_final="8",
        estado_conformidad=MesaActaOral.EstadoConformidad.PENDIENTE,
        notificado_en=timezone.now() - timedelta(minutes=minutos_atras),
    )


def _cerrar(user, mesa):
    resultado = gestionar_mesa_planilla_cierre(_Req(user), mesa.id, _Cierre("cerrar"))
    if isinstance(resultado, tuple):
        return resultado[0], resultado[1].message
    return 200, resultado.message


class TestCierreConActasPendientes:
    def test_bloquea_mientras_el_estudiante_esta_en_plazo(self, secretaria, mesa):
        insc = _inscribir(mesa, "40000010", "BATTISTESA")
        _acta(mesa, insc, minutos_atras=1)

        status, mensaje = _cerrar(secretaria, mesa)
        assert status == 400
        assert "BATTISTESA" in mensaje
        mesa.refresh_from_db()
        assert mesa.planilla_cerrada_en is None

    def test_el_plazo_corre_por_estudiante_no_por_mesa(self, secretaria, mesa):
        """
        Dos actas guardadas en momentos distintos: la vieja vence y la reciente
        sigue en plazo. La planilla no cierra, y solo se nombra a quien falta.
        """
        vieja = _inscribir(mesa, "40000011", "VENCIDA")
        reciente = _inscribir(mesa, "40000012", "ENPLAZO")
        acta_vieja = _acta(mesa, vieja, minutos_atras=11)
        _acta(mesa, reciente, minutos_atras=1)

        status, mensaje = _cerrar(secretaria, mesa)
        assert status == 400
        assert "ENPLAZO" in mensaje
        assert "VENCIDA" not in mensaje

        acta_vieja.refresh_from_db()
        assert acta_vieja.estado_conformidad == MesaActaOral.EstadoConformidad.TIMEOUT

    def test_cierra_cuando_todos_vencieron(self, secretaria, mesa):
        """Sin esto, un estudiante que nunca abre la app trabaria la planilla para siempre."""
        insc = _inscribir(mesa, "40000013", "VENCIDA")
        acta = _acta(mesa, insc, minutos_atras=11)

        status, _ = _cerrar(secretaria, mesa)
        assert status == 200
        acta.refresh_from_db()
        assert acta.estado_conformidad == MesaActaOral.EstadoConformidad.TIMEOUT
        mesa.refresh_from_db()
        assert mesa.planilla_cerrada_en is not None

    def test_cierra_cuando_el_estudiante_presto_conformidad(self, secretaria, mesa):
        insc = _inscribir(mesa, "40000014", "CONFORME")
        acta = _acta(mesa, insc, minutos_atras=1)
        acta.estado_conformidad = MesaActaOral.EstadoConformidad.CONFORME
        acta.respondido_en = timezone.now()
        acta.save()

        status, _ = _cerrar(secretaria, mesa)
        assert status == 200
        mesa.refresh_from_db()
        assert mesa.planilla_cerrada_en is not None

    def test_mesa_sin_actas_orales_cierra_normalmente(self, secretaria, mesa):
        _inscribir(mesa, "40000015", "SINACTA")
        status, _ = _cerrar(secretaria, mesa)
        assert status == 200

    def test_no_vence_antes_de_tiempo(self, secretaria, mesa):
        """Justo por debajo del plazo el estudiante conserva su derecho a responder."""
        insc = _inscribir(mesa, "40000016", "CASI")
        acta = _acta(mesa, insc, minutos_atras=9)

        status, _ = _cerrar(secretaria, mesa)
        assert status == 400
        acta.refresh_from_db()
        assert acta.estado_conformidad == MesaActaOral.EstadoConformidad.PENDIENTE


class TestVencimientoDeActas:
    def test_plazo_es_de_diez_minutos(self):
        assert timedelta(minutes=10) == PLAZO_CONFORMIDAD

    def test_vence_solo_las_expiradas(self, mesa):
        vencida = _acta(mesa, _inscribir(mesa, "40000020", "UNA"), minutos_atras=11)
        vigente = _acta(mesa, _inscribir(mesa, "40000021", "OTRA"), minutos_atras=2)

        cerradas = vencer_actas_orales_expiradas(MesaActaOral.objects.filter(mesa=mesa))
        assert cerradas == 1

        vencida.refresh_from_db()
        vigente.refresh_from_db()
        assert vencida.estado_conformidad == MesaActaOral.EstadoConformidad.TIMEOUT
        assert vigente.estado_conformidad == MesaActaOral.EstadoConformidad.PENDIENTE

    def test_no_toca_las_ya_respondidas(self, mesa):
        acta = _acta(mesa, _inscribir(mesa, "40000022", "RESPONDIO"), minutos_atras=30)
        acta.estado_conformidad = MesaActaOral.EstadoConformidad.CONFORME
        acta.save()

        assert vencer_actas_orales_expiradas(MesaActaOral.objects.filter(mesa=mesa)) == 0
        acta.refresh_from_db()
        assert acta.estado_conformidad == MesaActaOral.EstadoConformidad.CONFORME

    def test_acta_sin_notificado_en_arranca_el_plazo(self, mesa):
        """No se da por vencida de entrada: se le empieza a contar el plazo."""
        acta = _acta(mesa, _inscribir(mesa, "40000023", "SINFECHA"), minutos_atras=0)
        MesaActaOral.objects.filter(id=acta.id).update(notificado_en=None)

        vencer_actas_orales_expiradas(MesaActaOral.objects.filter(mesa=mesa))
        acta.refresh_from_db()
        assert acta.notificado_en is not None
        assert acta.estado_conformidad == MesaActaOral.EstadoConformidad.PENDIENTE
