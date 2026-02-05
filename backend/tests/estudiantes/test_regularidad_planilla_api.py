from decimal import Decimal
from datetime import date
from types import SimpleNamespace

import pytest
from django.contrib.auth.models import User

from apps.estudiantes import carga_notas_api
from core.models import (
    Comision,
    Estudiante,
    InscripcionMateriaEstudiante,
    Materia,
    PlanDeEstudio,
    Profesorado,
    Regularidad,
    RegularidadPlanillaLock,
)


def _create_materia(nombre="Química I"):
    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Química",
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
def test_guardar_planilla_regularidad_creates_regularidad_records():
    staff = User.objects.create(username="staff", is_staff=True)
    estudiante = Estudiante.objects.create(user=User.objects.create(username="estudiante1"), dni="4000")
    materia = _create_materia()
    comision = Comision.objects.create(materia=materia, anio_lectivo=2024, codigo="COM-1", turno_id=1)
    inscripcion = InscripcionMateriaEstudiante.objects.create(
        estudiante=estudiante,
        materia=materia,
        comision=comision,
        anio=2024,
    )

    estudiante_payload = carga_notas_api.RegularidadEstudianteIn(
        inscripcion_id=inscripcion.id,
        situacion="APROBADO",
        nota_tp=8.5,
        nota_final=9,
        asistencia=90,
        excepcion=False,
        observaciones="",
    )
    payload = carga_notas_api.RegularidadCargaIn(
        comision_id=comision.id,
        fecha_cierre=date(2024, 6, 30),
        estudiantes=[estudiante_payload],
        observaciones_generales=None,
    )

    request = SimpleNamespace(user=staff)
    status, response = carga_notas_api.guardar_planilla_regularidad(request, payload)

    assert status == 200
    assert response.ok is True
    reg = Regularidad.objects.get(inscripcion=inscripcion)
    assert reg.nota_final_cursada == 9
    assert reg.asistencia_porcentaje == 90
    assert reg.nota_trabajos_practicos == Decimal("8.5")


@pytest.mark.django_db
def test_guardar_planilla_regularidad_rejects_unknown_inscripcion():
    staff = User.objects.create(username="staff2", is_staff=True)
    materia = _create_materia("Química II")
    comision = Comision.objects.create(materia=materia, anio_lectivo=2024, codigo="COM-2", turno_id=1)

    estudiante_payload = carga_notas_api.RegularidadEstudianteIn(
        inscripcion_id=9999,
        situacion="APROBADO",
    )
    payload = carga_notas_api.RegularidadCargaIn(
        comision_id=comision.id,
        fecha_cierre=date(2024, 7, 1),
        estudiantes=[estudiante_payload],
    )

    request = SimpleNamespace(user=staff)
    status, response = carga_notas_api.guardar_planilla_regularidad(request, payload)

    assert status == 400
    assert "situacion" in response.message.lower()


@pytest.mark.django_db
def test_gestionar_regularidad_cierre_creates_lock_and_reopen():
    staff = User.objects.create(username="staff3", is_staff=True)
    materia = _create_materia("Física I")
    comision = Comision.objects.create(materia=materia, anio_lectivo=2024, codigo="COM-3", turno_id=1)

    request = SimpleNamespace(user=staff)
    payload_cerrar = carga_notas_api.RegularidadCierreIn(comision_id=comision.id, accion="cerrar")
    response_cerrar = carga_notas_api.gestionar_regularidad_cierre(request, payload_cerrar)

    assert response_cerrar.ok is True
    assert RegularidadPlanillaLock.objects.filter(comision=comision).exists()

    payload_reabrir = carga_notas_api.RegularidadCierreIn(comision_id=comision.id, accion="reabrir")
    response_reabrir = carga_notas_api.gestionar_regularidad_cierre(request, payload_reabrir)

    assert response_reabrir.ok is True
    assert not RegularidadPlanillaLock.objects.filter(comision=comision).exists()
