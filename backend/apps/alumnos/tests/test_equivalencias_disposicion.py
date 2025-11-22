from datetime import date

import pytest
from django.contrib.auth.models import User

from apps.alumnos.services.equivalencias_disposicion import (
    registrar_disposicion_equivalencia,
    resolver_contexto_equivalencia,
)
from core.models import (
    Estudiante,
    Materia,
    PlanDeEstudio,
    Profesorado,
)


@pytest.mark.django_db
def test_resolver_contexto_equivalencia_requires_student_enrollment():
    user = User.objects.create(username="12345678", first_name="Ana", last_name="Test")
    estudiante = Estudiante.objects.create(user=user, dni="12345678")

    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Matemática",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion="RES-1",
        anio_inicio=2022,
        vigente=True,
    )

    with pytest.raises(ValueError, match="inscripto"):
        resolver_contexto_equivalencia(dni=estudiante.dni, profesorado_id=profesorado.id, plan_id=plan.id)

    estudiante.asignar_profesorado(profesorado, anio_ingreso=2024)

    est_ctx, prof_ctx, plan_ctx = resolver_contexto_equivalencia(
        dni=estudiante.dni,
        profesorado_id=profesorado.id,
        plan_id=plan.id,
    )

    assert est_ctx == estudiante
    assert prof_ctx == profesorado
    assert plan_ctx == plan


@pytest.mark.django_db
def test_registrar_disposicion_generates_detail_and_acta():
    user = User.objects.create(username="5678", first_name="Juan")
    estudiante = Estudiante.objects.create(user=user, dni="5678")

    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Física",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion="RES-LOCK-2",
        anio_inicio=2023,
        vigente=True,
    )
    estudiante.asignar_profesorado(profesorado, anio_ingreso=2023)
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre="Física I",
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )

    result = registrar_disposicion_equivalencia(
        estudiante=estudiante,
        profesorado=profesorado,
        plan=plan,
        numero_disposicion="D-1",
        fecha_disposicion=date(2024, 1, 2),
        observaciones="",
        detalles_payload=[{"materia_id": materia.id, "nota": "10"}],
        origen="manual",
        usuario=None,
        validar_correlatividades=False,
    )

    assert result.disposicion.numero_disposicion == "D-1"
    assert len(result.detalles) == 1
    assert materia.actas_examen.count() == 1


@pytest.mark.django_db
def test_registrar_disposicion_with_materia_from_other_plan_raises():
    user = User.objects.create(username="8899", first_name="Flor")
    estudiante = Estudiante.objects.create(user=user, dni="8899")

    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Historia",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion="RES-HIS-1",
        anio_inicio=2023,
        vigente=True,
    )
    estudiante.asignar_profesorado(profesorado, anio_ingreso=2023)
    other_plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion="RES-HIS-2",
        anio_inicio=2024,
        vigente=True,
    )
    materia = Materia.objects.create(
        plan_de_estudio=other_plan,
        nombre="Historia II",
        anio_cursada=2,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )

    with pytest.raises(ValueError, match="no pertenece"):
        registrar_disposicion_equivalencia(
            estudiante=estudiante,
            profesorado=profesorado,
            plan=plan,
            numero_disposicion="D-2",
            fecha_disposicion=date(2024, 5, 5),
            observaciones="",
            detalles_payload=[{"materia_id": materia.id, "nota": "9"}],
            origen="manual",
            usuario=None,
            validar_correlatividades=False,
        )
