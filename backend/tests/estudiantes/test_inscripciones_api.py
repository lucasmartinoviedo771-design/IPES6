from types import SimpleNamespace
from datetime import datetime

import pytest
from django.contrib.auth.models import User

from apps.estudiantes.api.inscripciones_materias_api import (
    inscripcion_materia,
    cancelar_inscripcion_materia,
)
from apps.estudiantes.schemas import InscripcionMateriaIn, CancelarInscripcionIn
from core.models import (
    Estudiante,
    Profesorado,
    PlanDeEstudio,
    Materia,
    Correlatividad,
    InscripcionMateriaEstudiante,
)


def _create_materia(nombre="Álgebra I"):
    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Matemática",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion=f"RES-{nombre}",
        anio_inicio=2024,
        vigente=True,
    )
    return Materia.objects.create(
        plan_de_estudio=plan,
        nombre=nombre,
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )


@pytest.mark.django_db
def test_inscripcion_materia_success_creates_record():
    user = User.objects.create(username="est1")
    estudiante = Estudiante.objects.create(user=user, dni="1000")
    materia = _create_materia()

    request = SimpleNamespace(user=user)
    payload = InscripcionMateriaIn(materia_id=materia.id, dni=estudiante.dni)

    response = inscripcion_materia(request, payload)

    assert response["message"] == "Inscripción a materia registrada"
    assert InscripcionMateriaEstudiante.objects.filter(estudiante=estudiante, materia=materia).exists()


@pytest.mark.django_db
def test_inscripcion_materia_rejects_missing_correlativas():
    user = User.objects.create(username="est2")
    estudiante = Estudiante.objects.create(user=user, dni="2000")
    materia = _create_materia("Análisis I")
    correlativa = _create_materia("Precalculo")

    Correlatividad.objects.create(
        materia_origen=materia,
        materia_correlativa=correlativa,
        tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR,
    )

    request = SimpleNamespace(user=user)
    payload = InscripcionMateriaIn(materia_id=materia.id, dni=estudiante.dni)

    status, response = inscripcion_materia(request, payload)

    assert status == 400
    assert response.message.startswith("Correlatividades no cumplidas")


@pytest.mark.django_db
def test_cancelar_inscripcion_materia_changes_state():
    staff = User.objects.create(username="staff", is_staff=True)
    estudiante_user = User.objects.create(username="est3")
    estudiante = Estudiante.objects.create(user=estudiante_user, dni="3000")
    materia = _create_materia("Lógica")
    inscripcion = InscripcionMateriaEstudiante.objects.create(
        estudiante=estudiante,
        materia=materia,
        anio=datetime.now().year,
        estado=InscripcionMateriaEstudiante.Estado.PENDIENTE,
    )

    request = SimpleNamespace(user=staff)
    payload = CancelarInscripcionIn(dni=estudiante.dni)

    response = cancelar_inscripcion_materia(request, inscripcion.id, payload)

    inscripcion.refresh_from_db()
    assert response.ok is True
    assert inscripcion.estado == InscripcionMateriaEstudiante.Estado.ANULADA
