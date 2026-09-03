from datetime import date, timedelta

import pytest
from django.contrib.auth.models import User
from ninja.errors import HttpError

from apps.metrics.analytics_api import _check_metrics_access
from core.models import (
    Bloque,
    Comision,
    Docente,
    Estudiante,
    EstudianteCarrera,
    HorarioCatedra,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Materia,
    MesaExamen,
    Persona,
    PlanDeEstudio,
    Profesorado,
    Regularidad,
    RiesgoAcademicoEstudiante,
    StaffAsignacion,
    Turno,
)

pytestmark = pytest.mark.django_db


class TestAnalyticsBackend:
    @pytest.fixture(autouse=True)
    def setup_data(self):
        # 1. Estructura académica básica
        self.prof = Profesorado.objects.create(nombre="Profesorado de Historia", activo=True, duracion_anios=4)
        self.plan = PlanDeEstudio.objects.create(
            profesorado=self.prof, resolucion="RES-100", anio_inicio=2020, vigente=True
        )
        self.materia_asi = Materia.objects.create(
            plan_de_estudio=self.plan, nombre="Historia Antigua", anio_cursada=1, formato="ASI", horas_semana=4
        )
        self.materia_pra = Materia.objects.create(
            plan_de_estudio=self.plan, nombre="Práctica Docente I", anio_cursada=1, formato="PRA", horas_semana=6
        )

        self.turno = Turno.objects.create(nombre="Vespertino")

        # 2. Docentes y Usuarios
        self.p_admin = Persona.objects.create(dni="11111111", nombre="Admin", apellido="General")
        self.u_admin = User.objects.create_user(username="11111111", is_superuser=True)
        StaffAsignacion.objects.create(user=self.u_admin, rol=StaffAsignacion.Rol.BEDEL)

        self.p_doc1 = Persona.objects.create(dni="22222222", nombre="Carlos", apellido="Docente")
        self.u_doc1 = User.objects.create_user(username="22222222")
        self.doc1 = Docente.objects.create(persona=self.p_doc1)

        self.p_doc2 = Persona.objects.create(dni="33333333", nombre="Laura", apellido="Suplente")
        self.u_doc2 = User.objects.create_user(username="33333333")
        self.doc2 = Docente.objects.create(persona=self.p_doc2)

        # 3. Estudiante
        self.p_est = Persona.objects.create(dni="44444444", nombre="Martin", apellido="Alumno")
        self.u_est = User.objects.create_user(username="44444444")
        self.est = Estudiante.objects.create(user=self.u_est, persona=self.p_est, anio_ingreso=2024)
        self.ec = EstudianteCarrera.objects.create(
            estudiante=self.est, profesorado=self.prof, anio_ingreso=2024, estado_academico="ACT"
        )

    def test_permission_docente_cannot_view_other_docente(self, rf):
        request = rf.get("/api/analytics/teachers/workload/")
        request.user = self.u_doc1

        # Docente 1 consultando a sí mismo: OK
        res = _check_metrics_access(request, target_docente_id=self.doc1.id)
        assert res.id == self.doc1.id

        # Docente 1 intentando consultar a Docente 2: 403 Forbidden
        with pytest.raises(HttpError) as exc_info:
            _check_metrics_access(request, target_docente_id=self.doc2.id)
        assert exc_info.value.status_code == 403

    def test_permission_admin_can_view_any_docente(self, rf):
        request = rf.get("/api/analytics/teachers/workload/")
        request.user = self.u_admin

        # Admin consultando Docente 2: permitido
        res = _check_metrics_access(request, target_docente_id=self.doc2.id)
        assert res.id == self.doc2.id

    def test_recursado_logic_semaforo(self):
        """Si tiene 2 cierres no aprobados en la misma materia, recursa por 3ra vez = ROJO."""
        from django.core.management import call_command

        # Simular 2 cierres fallidos en Historia Antigua
        Regularidad.objects.create(
            estudiante=self.est,
            materia=self.materia_asi,
            fecha_cierre=date(2024, 11, 30),
            situacion="DPA",
        )
        Regularidad.objects.create(
            estudiante=self.est,
            materia=self.materia_asi,
            fecha_cierre=date(2025, 11, 30),
            situacion="LBI",
        )

        # Inscripción activa para ciclo actual
        InscripcionMateriaEstudiante.objects.create(
            estudiante=self.est,
            materia=self.materia_asi,
            anio=2026,
            estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        )

        call_command("calcular_semaforo_riesgo", anio=2026)

        riesgo = RiesgoAcademicoEstudiante.objects.get(estudiante=self.est)
        assert riesgo.nivel_riesgo == RiesgoAcademicoEstudiante.NivelRiesgo.ROJO
        assert any("Recursando una misma materia por 3ra vez" in m for m in riesgo.motivos)

    def test_aplazos_diferenciados_semaforo(self):
        """2 aplazos en la MISMA materia = ROJO. 2 aplazos en materias distintas = AMARILLO."""
        from django.core.management import call_command

        InscripcionMateriaEstudiante.objects.create(
            estudiante=self.est,
            materia=self.materia_asi,
            anio=2026,
            estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA,
        )

        mesa1 = MesaExamen.objects.create(materia=self.materia_asi, tipo="FIN", fecha=date(2026, 3, 10))
        mesa2 = MesaExamen.objects.create(materia=self.materia_asi, tipo="FIN", fecha=date(2026, 7, 15))

        # 2 aplazos en la misma materia
        InscripcionMesa.objects.create(mesa=mesa1, estudiante=self.est, nota=4, condicion="DES")
        InscripcionMesa.objects.create(mesa=mesa2, estudiante=self.est, nota=2, condicion="DES")

        call_command("calcular_semaforo_riesgo", anio=2026)
        r = RiesgoAcademicoEstudiante.objects.get(estudiante=self.est)
        assert r.nivel_riesgo == RiesgoAcademicoEstudiante.NivelRiesgo.ROJO
        assert any("2 aplazos consecutivos en la misma materia" in m for m in r.motivos)
