import pytest
from datetime import date
from django.contrib.auth.models import User
from unittest.mock import patch
from core.models import (
    Estudiante, Profesorado, PlanDeEstudio, Materia, Regularidad, 
    RegularidadPlantilla, RegularidadFormato, ActaExamen, ActaExamenAlumno
)
from apps.alumnos.services.cursada import estudiante_tiene_materia_aprobada
from apps.primera_carga.services import crear_planilla_regularidad
from apps.alumnos.api.actas import crear_acta_examen, ActaCreateLocal as ActaCreateIn, ActaAlumnoLocal as ActaAlumnoIn
from apps.alumnos.services.equivalencias_disposicion import registrar_disposicion_equivalencia

@pytest.mark.django_db
def test_estudiante_tiene_materia_aprobada():
    user = User.objects.create(username="testuser", first_name="Test", last_name="Student")
    estudiante = Estudiante.objects.create(dni="12345678", user=user)
    profesorado = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, resolucion="RES-123", anio_inicio=2023)
    materia = Materia.objects.create(nombre="Materia 1", plan_de_estudio=plan, anio_cursada=1, formato="ASI")

    # Inicialmente no tiene aprobada
    assert not estudiante_tiene_materia_aprobada(estudiante, materia)

    # 1. Regularidad Aprobada
    Regularidad.objects.create(
        estudiante=estudiante, materia=materia, fecha_cierre=date(2024, 12, 1), 
        situacion=Regularidad.Situacion.APROBADO
    )
    assert estudiante_tiene_materia_aprobada(estudiante, materia)
    
    # Limpiar
    Regularidad.objects.all().delete()
    assert not estudiante_tiene_materia_aprobada(estudiante, materia)

    # 2. Acta Aprobada
    acta = ActaExamen.objects.create(
        codigo="ACTA-001", fecha=date(2024, 12, 1), profesorado=profesorado, 
        materia=materia, plan=plan, tipo=ActaExamen.Tipo.REGULAR
    )
    ActaExamenAlumno.objects.create(
        acta=acta, numero_orden=1, dni=estudiante.dni, apellido_nombre="Test", 
        calificacion_definitiva="7"
    )
    assert estudiante_tiene_materia_aprobada(estudiante, materia)

@pytest.mark.django_db
@patch("apps.primera_carga.services.ensure_profesorado_access")
def test_crear_planilla_regularidad_prevent_duplicate(mock_ensure_access):
    # Setup
    user = User.objects.create(username="admin", is_staff=True)
    estudiante = Estudiante.objects.create(dni="11111111", user=user)
    profesorado = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, resolucion="RES-123", anio_inicio=2023)
    materia = Materia.objects.create(nombre="Materia 1", plan_de_estudio=plan, anio_cursada=1, formato="MOD")
    formato = RegularidadFormato.objects.create(nombre="Formato 1", slug="fmt1")
    plantilla = RegularidadPlantilla.objects.create(
        formato=formato, dictado=RegularidadPlantilla.Dictado.ANUAL, nombre="Plantilla 1"
    )

    # Simular que ya aprobó
    Regularidad.objects.create(
        estudiante=estudiante, materia=materia, fecha_cierre=date(2023, 12, 1), 
        situacion=Regularidad.Situacion.PROMOCIONADO
    )

    # Intentar cargar otra promoción
    filas = [{
        "dni": "11111111", 
        "apellido_nombre": "Student 1", 
        "situacion": "PROMOCION", 
        "nota_final": 9,
        "asistencia": 90
    }]
    
    result = crear_planilla_regularidad(
        user=user, profesorado_id=profesorado.id, materia_id=materia.id, 
        plantilla_id=plantilla.id, dictado="ANUAL", fecha=date(2024, 12, 1), 
        filas=filas
    )

    # Debe tener warning y NO haber creado nueva regularidad (o al menos no duplicada)
    assert result["regularidades_registradas"] == 0
    assert len(result["warnings"]) == 1
    assert "ya tiene aprobada la materia" in result["warnings"][0]

@pytest.mark.django_db
def test_crear_acta_examen_prevent_duplicate():
    # Setup
    user = User.objects.create(username="admin", is_staff=True)
    estudiante = Estudiante.objects.create(dni="22222222", user=user)
    profesorado = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, resolucion="RES-123", anio_inicio=2023)
    materia = Materia.objects.create(nombre="Materia 1", plan_de_estudio=plan, anio_cursada=1, formato="ASI")

    # Simular que ya aprobó
    Regularidad.objects.create(
        estudiante=estudiante, materia=materia, fecha_cierre=date(2023, 12, 1), 
        situacion=Regularidad.Situacion.APROBADO
    )

    payload = ActaCreateIn(
        profesorado_id=profesorado.id,
        materia_id=materia.id,
        tipo=ActaExamen.Tipo.REGULAR,
        fecha=date(2024, 12, 1),
        folio="FOL-001",
        docentes=[],
        alumnos=[
            ActaAlumnoIn(
                numero_orden=1, dni="22222222", apellido_nombre="Student 2", 
                calificacion_definitiva="8", permiso_examen="REG"
            )
        ]
    )

    # Mock request
    request = type('Request', (), {})()
    request.user = user

    # Ejecutar
    status, response = crear_acta_examen(request, payload)

    assert status == 400
    assert response.ok is False
    assert "ya tiene aprobada la materia" in response.message

@pytest.mark.django_db
def test_registrar_disposicion_equivalencia_prevent_duplicate():
    user = User.objects.create(username="admin")
    estudiante = Estudiante.objects.create(dni="33333333", user=user)
    profesorado = Profesorado.objects.create(nombre="Profesorado Test", duracion_anios=4)
    # Asignar carrera al estudiante
    # Estudiante.carreras is a ManyToManyField through EstudianteCarrera or similar?
    # Checking models.py line 287: carreras = models.ManyToManyField(Profesorado, through="EstudianteCarrera", ...)
    # So I can use add() if the through model doesn't have required fields, or I need to create the through model instance.
    # Let's try add() first, if it fails I'll check EstudianteCarrera.
    estudiante.carreras.add(profesorado)
    
    plan = PlanDeEstudio.objects.create(profesorado=profesorado, resolucion="RES-123", anio_inicio=2023)
    materia = Materia.objects.create(nombre="Materia 1", plan_de_estudio=plan, anio_cursada=1, formato="ASI")

    # Simular que ya aprobó
    Regularidad.objects.create(
        estudiante=estudiante, materia=materia, fecha_cierre=date(2023, 12, 1), 
        situacion=Regularidad.Situacion.PROMOCIONADO
    )

    detalles = [{"materia_id": materia.id, "nota": "8"}]

    with pytest.raises(ValueError, match="ya figura como aprobada"):
        registrar_disposicion_equivalencia(
            estudiante=estudiante, profesorado=profesorado, plan=plan,
            numero_disposicion="DISPO-001", fecha_disposicion=date(2024, 12, 1),
            observaciones="", detalles_payload=detalles, origen="primera_carga",
            usuario=user, validar_correlatividades=False
        )
