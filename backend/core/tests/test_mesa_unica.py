"""
Una sola mesa por materia, fecha y modalidad.

Nada impedia crear dos mesas identicas el mismo dia. Cuando pasaba, el acta
quedaba colgada de cualquiera de las dos —el backend la elegia por
materia+fecha+modalidad— y se cerraba la planilla de la mesa equivocada,
dejando la correcta sin notas y sin ningun aviso.

La materia ya pertenece a un plan de un profesorado, asi que materia_id alcanza
para distinguir la Pedagogia de Primaria de la de Inicial (hay 32 materias con
ese nombre, una por plan).

Lo que si es legitimo y debe seguir permitido:
  - una mesa regular y una libre de la misma materia el mismo dia (92 casos
    reales en la base);
  - el 1° y el 2° llamado, que siempre caen en fechas distintas.
"""

from datetime import date

import pytest
from django.db import transaction
from django.db.utils import IntegrityError

from core.models import Materia, MesaExamen, PlanDeEstudio, Profesorado

pytestmark = pytest.mark.django_db

FECHA = date(2026, 12, 15)


@pytest.fixture
def materia():
    prof = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-001/24", anio_inicio=2024)
    return Materia.objects.create(
        plan_de_estudio=plan, nombre="Pedagogia", anio_cursada=1, formato="ASI"
    )


@pytest.fixture
def otra_materia():
    """Misma materia por nombre, otro profesorado: es otra fila y otro materia_id."""
    prof = Profesorado.objects.create(nombre="Otro Profesorado", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-002/24", anio_inicio=2024)
    return Materia.objects.create(
        plan_de_estudio=plan, nombre="Pedagogia", anio_cursada=1, formato="ASI"
    )


def _mesa(materia, modalidad="REG", fecha=FECHA):
    return MesaExamen.objects.create(materia=materia, tipo="EXT", modalidad=modalidad, fecha=fecha)


class TestMesaUnica:
    def test_rechaza_dos_mesas_identicas(self, materia):
        _mesa(materia)
        with pytest.raises(IntegrityError), transaction.atomic():
            _mesa(materia)

    def test_permite_regular_y_libre_el_mismo_dia(self, materia):
        """Caso legitimo y frecuente: cambia la condicion para rendir."""
        _mesa(materia, modalidad="REG")
        _mesa(materia, modalidad="LIB")
        assert MesaExamen.objects.filter(materia=materia, fecha=FECHA).count() == 2

    def test_permite_primer_y_segundo_llamado(self, materia):
        """Los llamados se distinguen por fecha."""
        _mesa(materia, fecha=date(2026, 12, 15))
        _mesa(materia, fecha=date(2026, 12, 22))
        assert MesaExamen.objects.filter(materia=materia).count() == 2

    def test_no_confunde_la_misma_materia_de_otro_profesorado(self, materia, otra_materia):
        """
        Hay 32 materias llamadas 'Pedagogia', una por plan. La restriccion es por
        materia_id, asi que cada profesorado puede tener la suya el mismo dia.
        """
        _mesa(materia)
        _mesa(otra_materia)
        assert MesaExamen.objects.filter(fecha=FECHA).count() == 2

    def test_la_restriccion_no_depende_del_tipo_de_mesa(self, materia):
        """
        Ordinaria/extraordinaria/especial no forman parte de la clave: dos mesas
        de la misma materia, fecha y modalidad siguen siendo la misma mesa.
        """
        MesaExamen.objects.create(materia=materia, tipo="EXT", modalidad="REG", fecha=FECHA)
        with pytest.raises(IntegrityError), transaction.atomic():
            MesaExamen.objects.create(materia=materia, tipo="FIN", modalidad="REG", fecha=FECHA)
