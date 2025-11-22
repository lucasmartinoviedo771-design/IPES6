import pytest
from django.db import IntegrityError, transaction

from core.models import (
    Materia,
    PlanDeEstudio,
    Profesorado,
    RegularidadPlanillaLock,
)


@pytest.mark.django_db
def test_regularidad_lock_requires_complete_scope():
    profesorado = Profesorado.objects.create(
        nombre="Profesorado en Física",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion="RES-LOCK-1",
        anio_inicio=2024,
        vigente=True,
    )
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre="Física I",
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            RegularidadPlanillaLock.objects.create(materia=materia)

    lock = RegularidadPlanillaLock.objects.create(materia=materia, anio_virtual=2024)
    assert lock.pk is not None
