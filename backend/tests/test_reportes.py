import pytest
from datetime import date, timedelta
from core.models import (
    User, Estudiante, Profesorado, PlanDeEstudio, Materia, 
    InscripcionMateriaAlumno, Regularidad, Correlatividad,
    MesaExamen
)
from rest_framework_simplejwt.tokens import AccessToken

@pytest.fixture
def setup_reporte_data(db):
    # Admin User
    admin_user = User.objects.create_user(username='admin_report', password='password', is_superuser=True)
    token = AccessToken.for_user(admin_user)
    
    # Student
    student_user = User.objects.create_user(username='student_report', password='password')
    estudiante = Estudiante.objects.create(user=student_user, dni='33333333')
    
    # Career
    carrera = Profesorado.objects.create(nombre='Profesorado Reporte', activo=True, duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=carrera, resolucion='RES-REP', anio_inicio=2024)
    
    # Subjects
    materia_a = Materia.objects.create(
        plan_de_estudio=plan, nombre='Materia A', anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA, regimen=Materia.TipoCursada.ANUAL
    )
    materia_b = Materia.objects.create(
        plan_de_estudio=plan, nombre='Materia B', anio_cursada=2,
        formato=Materia.FormatoMateria.ASIGNATURA, regimen=Materia.TipoCursada.ANUAL
    )
    
    # Correlativity: B requires A (Regular para Cursar)
    Correlatividad.objects.create(
        materia_origen=materia_b,
        materia_correlativa=materia_a,
        tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR
    )
    
    return {
        'estudiante': estudiante,
        'materia_a': materia_a,
        'materia_b': materia_b,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    }

def test_reporte_correlativas_caidas_empty(client, setup_reporte_data):
    # Scenario: Student enrolled in B, has A regular (valid)
    
    Regularidad.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_a'],
        situacion=Regularidad.Situacion.REGULAR,
        fecha_cierre=date.today() - timedelta(days=100) # Valid
    )
    
    InscripcionMateriaAlumno.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_b'],
        anio=date.today().year,
        estado=InscripcionMateriaAlumno.Estado.CONFIRMADA
    )
    
    response = client.get(
        '/api/alumnos/reportes/correlativas-caidas',
        **setup_reporte_data['auth_headers']
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0

def test_reporte_correlativas_caidas_expired(client, setup_reporte_data):
    # Scenario: Student enrolled in B, has A regular (expired > 2 years)
    
    Regularidad.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_a'],
        situacion=Regularidad.Situacion.REGULAR,
        fecha_cierre=date.today() - timedelta(days=800) # Expired (> 2 years)
    )
    
    InscripcionMateriaAlumno.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_b'],
        anio=date.today().year,
        estado=InscripcionMateriaAlumno.Estado.CONFIRMADA
    )
    
    response = client.get(
        '/api/alumnos/reportes/correlativas-caidas',
        **setup_reporte_data['auth_headers']
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['materia_actual'] == 'Materia B'
    assert data[0]['materia_correlativa'] == 'Materia A'
    assert "Regularidad vencida" in data[0]['motivo']

def test_reporte_correlativas_caidas_missing(client, setup_reporte_data):
    # Scenario: Student enrolled in B, has NO regularity for A
    
    InscripcionMateriaAlumno.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_b'],
        anio=date.today().year,
        estado=InscripcionMateriaAlumno.Estado.CONFIRMADA
    )
    
    response = client.get(
        '/api/alumnos/reportes/correlativas-caidas',
        **setup_reporte_data['auth_headers']
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['motivo'] == "Sin regularidad registrada"

def test_reporte_correlativas_caidas_approved(client, setup_reporte_data):
    # Scenario: Student enrolled in B, has A approved (should be OK)
    
    Regularidad.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_a'],
        situacion=Regularidad.Situacion.APROBADO,
        fecha_cierre=date.today() - timedelta(days=800) # Date doesn't matter if approved
    )
    
    InscripcionMateriaAlumno.objects.create(
        estudiante=setup_reporte_data['estudiante'],
        materia=setup_reporte_data['materia_b'],
        anio=date.today().year,
        estado=InscripcionMateriaAlumno.Estado.CONFIRMADA
    )
    
    response = client.get(
        '/api/alumnos/reportes/correlativas-caidas',
        **setup_reporte_data['auth_headers']
    )
    
    assert response.status_code == 200
    assert len(response.json()) == 0
