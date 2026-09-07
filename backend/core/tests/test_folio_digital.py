"""
Numeracion automatica de libro y folio en las actas digitales.

Regla institucional: a partir de ahora, el acta que se guarda definitivamente
con las notas se numera sola. El libro es SIGI —marca de que es carga digital,
frente a los libros fisicos historicos ("1", "2", "II", "L2")— y el folio es un
correlativo continuo que no reinicia por anio.

La carga historica de actas en papel sigue pudiendo indicar su propio libro y
folio: solo se autogenera cuando el payload no los trae.
"""

import itertools
from datetime import date

import pytest
from django.db.utils import IntegrityError

from apps.estudiantes.api.actas_helpers import LIBRO_DIGITAL, generar_folio_digital
from core.models import ActaExamen, Materia, PlanDeEstudio, Profesorado

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia():
    prof = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-001/24", anio_inicio=2024)
    return Materia.objects.create(
        plan_de_estudio=plan, nombre="Pedagogia", anio_cursada=1, formato="ASI"
    )


_numero = itertools.count(1)


def _acta(materia, libro, folio, codigo, clave_registral=None):
    # numero es unico por (profesorado, anio_academico), asi que se va incrementando.
    return ActaExamen.objects.create(
        clave_registral=clave_registral,
        codigo=codigo,
        numero=next(_numero),
        anio_academico=2026,
        tipo="FIN",
        profesorado=materia.plan_de_estudio.profesorado,
        materia=materia,
        plan=materia.plan_de_estudio,
        anio_cursada=1,
        fecha=date(2026, 9, 7),
        libro=libro,
        folio=folio,
    )


class TestGeneracionDeFolio:
    def test_arranca_en_uno(self):
        assert generar_folio_digital() == "1"

    def test_es_correlativo(self, materia):
        _acta(materia, LIBRO_DIGITAL, "1", "A-1")
        assert generar_folio_digital() == "2"
        _acta(materia, LIBRO_DIGITAL, "2", "A-2")
        assert generar_folio_digital() == "3"

    def test_ignora_los_libros_historicos(self, materia):
        """Los folios en papel no deben mover el correlativo digital."""
        _acta(materia, "1", "500", "A-h1")
        _acta(materia, "II", "800", "A-h2")
        _acta(materia, "L2", "70", "A-h3")
        assert generar_folio_digital() == "1"

    def test_ignora_folios_no_numericos(self, materia):
        """Las equivalencias usan folios tipo '385/2026' y no deben romper el conteo."""
        _acta(materia, LIBRO_DIGITAL, "385/2026", "A-e1")
        _acta(materia, LIBRO_DIGITAL, "7", "A-e2")
        assert generar_folio_digital() == "8"

    def test_continua_desde_el_maximo_no_desde_la_cantidad(self, materia):
        """Si se borro un acta intermedia, el correlativo no debe retroceder ni repetir."""
        _acta(materia, LIBRO_DIGITAL, "1", "A-1")
        _acta(materia, LIBRO_DIGITAL, "9", "A-9")
        assert generar_folio_digital() == "10"

    def test_no_reinicia_por_anio(self, materia):
        """El correlativo es continuo: un acta de otro anio no vuelve a 1."""
        acta = _acta(materia, LIBRO_DIGITAL, "40", "A-40")
        acta.fecha = date(2027, 3, 1)
        acta.anio_academico = 2027
        acta.save()
        assert generar_folio_digital() == "41"


class TestLibroDigital:
    def test_el_libro_es_sigi(self):
        assert LIBRO_DIGITAL == "SIGI"

    def test_no_colisiona_con_los_libros_historicos(self, materia):
        """
        SIGI no se usa en el historico, por eso libro+folio identifica sin
        ambiguedad a un acta digital aunque el papel tenga folios repetidos.
        """
        _acta(materia, "1", "5", "A-h1")
        _acta(materia, "1", "5", "A-h2")  # duplicado historico real, permitido
        digital = _acta(materia, LIBRO_DIGITAL, generar_folio_digital(), "A-d1")

        assert digital.libro == LIBRO_DIGITAL
        assert ActaExamen.objects.filter(libro=LIBRO_DIGITAL, folio=digital.folio).count() == 1

    def test_cada_acta_digital_recibe_un_folio_distinto(self, materia):
        folios = []
        for i in range(5):
            folio = generar_folio_digital()
            _acta(materia, LIBRO_DIGITAL, folio, f"A-{i}")
            folios.append(folio)
        assert folios == ["1", "2", "3", "4", "5"]
        assert len(set(folios)) == len(folios)


class TestUnicidadRegistral:
    """
    La unicidad se aplica de ahora en adelante, no sobre el historico.

    MySQL no soporta indices unicos condicionales (un UniqueConstraint con
    condition se ignora en silencio), asi que no alcanza con declarar "unico
    cuando libro=SIGI". Se usa clave_registral: UNIQUE en la base, con NULL en
    las actas en papel —MySQL admite multiples NULL— y 'libro/folio' en las
    digitales.
    """

    def test_la_base_rechaza_dos_actas_con_la_misma_clave(self, materia):
        _acta(materia, LIBRO_DIGITAL, "1", "A-1", clave_registral="SIGI/1")
        with pytest.raises(IntegrityError):
            _acta(materia, LIBRO_DIGITAL, "1", "A-2", clave_registral="SIGI/1")

    def test_el_historico_puede_repetir_libro_y_folio(self, materia):
        """
        Los folios en papel estan repetidos en los datos reales (1348 grupos), asi
        que la restriccion no debe alcanzarlos: van con clave_registral en NULL.
        """
        _acta(materia, "1", "18", "A-h1")
        _acta(materia, "1", "18", "A-h2")
        _acta(materia, "1", "18", "A-h3")

        assert ActaExamen.objects.filter(libro="1", folio="18").count() == 3
        assert ActaExamen.objects.filter(clave_registral__isnull=True).count() == 3

    def test_digitales_y_papel_conviven(self, materia):
        _acta(materia, "2", "122", "A-h1")
        _acta(materia, "2", "122", "A-h2")
        digital = _acta(materia, LIBRO_DIGITAL, "1", "A-d1", clave_registral="SIGI/1")

        assert digital.clave_registral == "SIGI/1"
        assert ActaExamen.objects.exclude(clave_registral__isnull=True).count() == 1
