from types import SimpleNamespace

import pytest
from django.contrib.auth.models import User

from apps.carreras.comisiones_api import create_comision
from apps.carreras.schemas import ComisionIn
from core.models import Comision, Docente, Materia, Persona, PlanDeEstudio, Profesorado, Turno

pytestmark = pytest.mark.django_db


def _fake_request():
    user = User.objects.create_superuser(username="admin_test", password="x")
    return SimpleNamespace(user=user, headers={})


def _make_materia():
    profesorado = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, resolucion="R-TEST-1", anio_inicio=2020)
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre="Materia Test",
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
    )
    turno = Turno.objects.create(nombre="Turno Test")
    return materia, turno


def _make_docente(dni):
    persona = Persona.objects.create(nombre="Nombre", apellido="Apellido", dni=dni)
    return Docente.objects.create(persona=persona)


class TestReemplazoDocenteComision:
    """
    Cuando un docente titular pasa a Licencia y se agrega un suplente para la
    misma materia/año/código, create_comision debe reutilizar la comisión
    existente en vez de crear una nueva -de lo contrario, los estudiantes ya
    inscriptos (atados al id de la comisión vieja) quedan separados del grupo.
    """

    def test_reutiliza_comision_en_licencia(self):
        materia, turno = _make_materia()
        titular = _make_docente("11111111")
        suplente = _make_docente("22222222")

        original = Comision.objects.create(
            materia=materia,
            anio_lectivo=2026,
            codigo="A",
            turno=turno,
            docente=titular,
            estado=Comision.Estado.LICENCIA,
            rol=Comision.Rol.TITULAR,
            orden=1,
        )

        payload = ComisionIn(
            materia_id=materia.id,
            anio_lectivo=2026,
            codigo="A",
            turno_id=turno.id,
            docente_id=suplente.id,
            rol="SUP",
            estado="ABI",
            orden=2,
        )
        out = create_comision(_fake_request(), payload)

        assert out.id == original.id
        assert Comision.objects.filter(materia=materia, anio_lectivo=2026, codigo="A").count() == 1

        original.refresh_from_db()
        assert original.docente_id == suplente.id
        assert original.estado == "ABI"
        assert original.rol == "SUP"

    def test_reutiliza_comision_cerrada(self):
        materia, turno = _make_materia()
        titular = _make_docente("33333333")
        suplente = _make_docente("44444444")

        original = Comision.objects.create(
            materia=materia,
            anio_lectivo=2026,
            codigo="A",
            turno=turno,
            docente=titular,
            estado=Comision.Estado.CERRADA,
            rol=Comision.Rol.TITULAR,
            orden=1,
        )

        payload = ComisionIn(
            materia_id=materia.id,
            anio_lectivo=2026,
            codigo="A",
            turno_id=turno.id,
            docente_id=suplente.id,
            rol="SUP",
            estado="ABI",
            orden=2,
        )
        create_comision(_fake_request(), payload)

        assert Comision.objects.filter(materia=materia, anio_lectivo=2026, codigo="A").count() == 1

    def test_no_reutiliza_si_hay_mas_de_una_vacante(self):
        """Con más de una comisión vacante para la misma materia/año/código,
        no hay forma de saber cuál reusar sin ambigüedad: se crea una nueva."""
        materia, turno = _make_materia()
        docente_a = _make_docente("55555555")
        docente_b = _make_docente("66666666")
        entrante = _make_docente("77777777")

        Comision.objects.create(
            materia=materia,
            anio_lectivo=2026,
            codigo="A",
            turno=turno,
            docente=docente_a,
            estado=Comision.Estado.LICENCIA,
            rol=Comision.Rol.TITULAR,
            orden=1,
        )
        Comision.objects.create(
            materia=materia,
            anio_lectivo=2026,
            codigo="A",
            turno=turno,
            docente=docente_b,
            estado=Comision.Estado.CERRADA,
            rol=Comision.Rol.SUPLENTE,
            orden=2,
        )

        payload = ComisionIn(
            materia_id=materia.id,
            anio_lectivo=2026,
            codigo="A",
            turno_id=turno.id,
            docente_id=entrante.id,
            rol="SUP",
            estado="ABI",
            orden=3,
        )
        create_comision(_fake_request(), payload)

        assert Comision.objects.filter(materia=materia, anio_lectivo=2026, codigo="A").count() == 3

    def test_crea_nueva_si_no_hay_vacante_co_ensenanza(self):
        """Docentes co-enseñando simultáneamente (ambos Abiertos): no hay
        vacante, así que cada uno mantiene su propia comisión."""
        materia, turno = _make_materia()
        titular = _make_docente("88888888")
        co_titular = _make_docente("99999999")

        Comision.objects.create(
            materia=materia,
            anio_lectivo=2026,
            codigo="A",
            turno=turno,
            docente=titular,
            estado=Comision.Estado.ABIERTA,
            rol=Comision.Rol.TITULAR,
            orden=1,
        )

        payload = ComisionIn(
            materia_id=materia.id,
            anio_lectivo=2026,
            codigo="A",
            turno_id=turno.id,
            docente_id=co_titular.id,
            rol="TIT",
            estado="ABI",
            orden=2,
        )
        create_comision(_fake_request(), payload)

        assert Comision.objects.filter(materia=materia, anio_lectivo=2026, codigo="A").count() == 2
