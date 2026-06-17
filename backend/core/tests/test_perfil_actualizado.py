import pytest
from django.contrib.auth.models import User

from core.models import Estudiante, Persona

pytestmark = pytest.mark.django_db


class TestPerfilActualizadoColumna:
    """El flag perfil_actualizado vive en una columna propia (no en datos_extra)."""

    def _crear_estudiante(self, dni="40111222"):
        persona = Persona.objects.create(dni=dni, nombre="Test", apellido="User")
        user = User.objects.create_user(username=dni)
        return Estudiante.objects.create(user=user, persona=persona)

    def test_default_es_false(self):
        est = self._crear_estudiante()
        assert est.perfil_actualizado is False

    def test_se_persiste_como_columna(self):
        est = self._crear_estudiante()
        est.perfil_actualizado = True
        est.save(update_fields=["perfil_actualizado"])
        est.refresh_from_db()
        assert est.perfil_actualizado is True

    def test_no_depende_de_datos_extra(self):
        """Marcar el perfil no debe escribir el flag dentro de datos_extra."""
        est = self._crear_estudiante()
        est.perfil_actualizado = True
        est.save(update_fields=["perfil_actualizado"])
        est.refresh_from_db()
        assert "perfil_actualizado" not in (est.datos_extra or {})
