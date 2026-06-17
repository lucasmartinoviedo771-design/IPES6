import pytest
from django.contrib.auth.models import User

from core.models import Estudiante, Persona

pytestmark = pytest.mark.django_db


class TestPersonaFuenteDeVerdad:
    def test_signal_no_copia_nombre_a_user(self):
        persona = Persona.objects.create(dni="30111222", nombre="Juan", apellido="Perez")
        user = User.objects.create_user(username="30111222")
        Estudiante.objects.create(user=user, persona=persona)

        # Al actualizar Persona, la señal sync_user_from_persona no debe cambiar first_name/last_name en User
        persona.nombre = "Juan Carlos"
        persona.apellido = "Perez Gomez"
        persona.save()

        user.refresh_from_db()
        assert user.first_name == ""  # la señal NO debe haberlo llenado
        assert user.last_name == ""
        # Pero sí debe mantener sincronizado el username/DNI si cambia
        assert user.username == "30111222"

    def test_properties_leen_de_persona_no_de_user(self):
        persona = Persona.objects.create(dni="30333444", nombre="Ana", apellido="Gomez")
        user = User.objects.create_user(username="30333444", first_name="SUCIO", last_name="VIEJO")
        est = Estudiante.objects.create(user=user, persona=persona)

        # Las properties de Estudiante deben priorizar la Persona, no el User
        assert est.nombre == "Ana"
        assert est.apellido == "Gomez"

    def test_guard_seguro_sin_persona(self):
        user = User.objects.create_user(username="30555666")
        est = Estudiante.objects.create(user=user, persona=None)

        # No debe levantar AttributeError si persona es None
        assert est.nombre == ""
        assert est.apellido == ""
        assert est.email == ""
