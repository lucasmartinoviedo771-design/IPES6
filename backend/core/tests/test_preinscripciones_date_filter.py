from datetime import date, timedelta

import pytest
from django.contrib.auth.models import User
from django.utils import timezone

from core.models import Estudiante, Persona, Preinscripcion, Profesorado

pytestmark = pytest.mark.django_db


class TestPreinscripcionesDateFilter:
    """Verifica que el filtrado por rango de fechas (desde/hasta) funcione correctamente en las preinscripciones."""

    @pytest.fixture(autouse=True)
    def setup_data(self):
        # Crear datos básicos de profesorado y estudiante
        self.prof = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4, activo=True)
        self.persona1 = Persona.objects.create(dni="111", nombre="Persona 1", apellido="Test")
        self.user1 = User.objects.create_user(username="111")
        self.estudiante1 = Estudiante.objects.create(user=self.user1, persona=self.persona1)

        self.persona2 = Persona.objects.create(dni="222", nombre="Persona 2", apellido="Test")
        self.user2 = User.objects.create_user(username="222")
        self.estudiante2 = Estudiante.objects.create(user=self.user2, persona=self.persona2)

        self.persona3 = Persona.objects.create(dni="333", nombre="Persona 3", apellido="Test")
        self.user3 = User.objects.create_user(username="333")
        self.estudiante3 = Estudiante.objects.create(user=self.user3, persona=self.persona3)

        # Crear preinscripciones con fechas de creación modificadas
        self.pre1 = Preinscripcion.objects.create(
            codigo="PRE-01", alumno=self.estudiante1, carrera=self.prof, anio=2026, activa=True
        )
        self.pre2 = Preinscripcion.objects.create(
            codigo="PRE-02", alumno=self.estudiante2, carrera=self.prof, anio=2026, activa=True
        )
        self.pre3 = Preinscripcion.objects.create(
            codigo="PRE-03", alumno=self.estudiante3, carrera=self.prof, anio=2026, activa=True
        )

        # Modificar created_at usando update ya que auto_now_add impide modificarlo con save()
        hoy = timezone.now()
        Preinscripcion.objects.filter(id=self.pre1.id).update(created_at=hoy - timedelta(days=5))
        Preinscripcion.objects.filter(id=self.pre2.id).update(created_at=hoy - timedelta(days=2))
        Preinscripcion.objects.filter(id=self.pre3.id).update(created_at=hoy)

    def test_filter_fecha_desde(self):
        """Filtra preinscripciones desde hace 3 días (debe retornar pre2 y pre3, excluyendo pre1)."""
        desde = date.today() - timedelta(days=3)
        qs = Preinscripcion.objects.filter(created_at__date__gte=desde)
        codigos = list(qs.values_list("codigo", flat=True))
        assert "PRE-02" in codigos
        assert "PRE-03" in codigos
        assert "PRE-01" not in codigos

    def test_filter_fecha_hasta(self):
        """Filtra preinscripciones hasta hace 1 día (debe retornar pre1 y pre2, excluyendo pre3)."""
        hasta = date.today() - timedelta(days=1)
        qs = Preinscripcion.objects.filter(created_at__date__lte=hasta)
        codigos = list(qs.values_list("codigo", flat=True))
        assert "PRE-01" in codigos
        assert "PRE-02" in codigos
        assert "PRE-03" not in codigos

    def test_filter_rango_completo(self):
        """Filtra preinscripciones en un rango que solo contenga a pre2 (desde hace 4 días hasta hace 1 día)."""
        desde = date.today() - timedelta(days=4)
        hasta = date.today() - timedelta(days=1)
        qs = Preinscripcion.objects.filter(created_at__date__gte=desde, created_at__date__lte=hasta)
        codigos = list(qs.values_list("codigo", flat=True))
        assert codigos == ["PRE-02"]
