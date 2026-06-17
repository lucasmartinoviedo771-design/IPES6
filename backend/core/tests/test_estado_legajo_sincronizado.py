"""
Anti-drift: EstudianteCarrera.estado_legajo debe reflejar la condición documental
real después de cualquier edición de legajo.

La Etapa 5 del listado de estudiantes filtra por esta columna en SQL.
Si algún camino de escritura deja de llamar a _recalcular_estado_legajo_ec,
el filtro devuelve resultados incorrectos silenciosamente.
Este test convierte esa dependencia implícita en una garantía verificable.
"""

import pytest
from django.contrib.auth.models import User

from apps.estudiantes.api.helpers.estudiante_admin import _recalcular_estado_legajo_ec
from core.models import Estudiante, EstudianteCarrera, Persona

pytestmark = pytest.mark.django_db


def _crear_setup(dni="50111222"):
    """Crea estudiante + carrera + EstudianteCarrera con legajo vacío (PEN)."""
    from core.models import Profesorado

    persona = Persona.objects.create(dni=dni, nombre="Test", apellido="Drift")
    user = User.objects.create_user(username=dni)
    est = Estudiante.objects.create(user=user, persona=persona)
    prof = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    ec = EstudianteCarrera.objects.create(estudiante=est, profesorado=prof)
    return est, ec


class TestEstadoLegajoSincronizado:
    """
    Garantiza que estado_legajo == COM cuando la documentación está completa
    y == PEN cuando está vacía, después de llamar a _recalcular_estado_legajo_ec.
    """

    def test_legajo_vacio_es_pendiente(self):
        _, ec = _crear_setup("50111223")
        _recalcular_estado_legajo_ec(ec)
        ec.refresh_from_db()
        assert ec.estado_legajo == EstudianteCarrera.EstadoLegajo.PENDIENTE

    def test_legajo_completo_pasa_a_completo(self):
        _, ec = _crear_setup("50111224")
        # Documentación mínima para "Regular": dni + fotos + salud + 1 folio + título
        ec.dni_legalizado = True
        ec.fotos_4x4 = True
        ec.certificado_salud = True
        ec.folios_oficio = 1
        ec.titulo_secundario_legalizado = True
        ec.save(
            update_fields=[
                "dni_legalizado",
                "fotos_4x4",
                "certificado_salud",
                "folios_oficio",
                "titulo_secundario_legalizado",
            ]
        )
        _recalcular_estado_legajo_ec(ec)
        ec.refresh_from_db()
        assert ec.estado_legajo == EstudianteCarrera.EstadoLegajo.COMPLETO

    def test_legajo_parcial_es_incompleto(self):
        """Algunos docs presentes pero sin título → Condicional → INC."""
        _, ec = _crear_setup("50111225")
        ec.dni_legalizado = True
        ec.fotos_4x4 = True
        ec.save(update_fields=["dni_legalizado", "fotos_4x4"])
        _recalcular_estado_legajo_ec(ec)
        ec.refresh_from_db()
        assert ec.estado_legajo == EstudianteCarrera.EstadoLegajo.INCOMPLETO

    def test_columna_se_actualiza_en_bd(self):
        """Verifica que el cambio persiste en base (no solo en memoria)."""
        _, ec = _crear_setup("50111226")
        ec_pk = ec.pk
        ec.dni_legalizado = True
        ec.fotos_4x4 = True
        ec.certificado_salud = True
        ec.folios_oficio = 1
        ec.titulo_secundario_legalizado = True
        ec.save(
            update_fields=[
                "dni_legalizado",
                "fotos_4x4",
                "certificado_salud",
                "folios_oficio",
                "titulo_secundario_legalizado",
            ]
        )
        _recalcular_estado_legajo_ec(ec)

        # Leer desde BD con una instancia fresca
        ec_fresh = EstudianteCarrera.objects.get(pk=ec_pk)
        assert ec_fresh.estado_legajo == EstudianteCarrera.EstadoLegajo.COMPLETO
