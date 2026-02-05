import pytest
from datetime import datetime, timedelta
from rest_framework_simplejwt.tokens import AccessToken
from core.models import Profesorado, PlanDeEstudio, Materia, Estudiante, User, InscripcionMateriaEstudiante, VentanaHabilitacion

@pytest.fixture
def setup_enrollment_data(db):
    # Create student user
    user = User.objects.create_user(username='student_enroll', password='password', first_name='Student', last_name='Enroll', email='student@example.com')
    # Approve intro course to pass validation
    estudiante = Estudiante.objects.create(user=user, dni='11111111', curso_introductorio_aprobado=True)
    
    # Create admin user
    admin = User.objects.create_user(username='admin_enroll', password='password', is_staff=True)
    
    # Create career and plan
    carrera = Profesorado.objects.create(nombre='Profesorado de Test', activo=True, inscripcion_abierta=True, duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=carrera, resolucion='RES-TEST', anio_inicio=2024, vigente=True)
    
    # Create subject (Annual)
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre='Introducción al Test',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )

    # Create active window for enrollment
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='1C_ANUALES'
    )
    
    token = AccessToken.for_user(user)
    admin_token = AccessToken.for_user(admin)
    
    return {
        'student_user': user,
        'estudiante': estudiante,
        'materia': materia,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'},
        'admin_auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {admin_token}'}
    }

def test_enroll_subject_success(client, setup_enrollment_data):
    payload = {
        "materia_id": setup_enrollment_data['materia'].id
    }
    
    response = client.post(
        '/api/estudiantes/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_enrollment_data['auth_headers']
    )
    
    assert response.status_code == 200
    assert response.json()['message'] == "Inscripción a materia registrada"
    
    assert InscripcionMateriaEstudiante.objects.filter(
        estudiante=setup_enrollment_data['estudiante'],
        materia=setup_enrollment_data['materia']
    ).exists()

def test_list_enrolled_subjects(client, setup_enrollment_data):
    # First enroll
    InscripcionMateriaEstudiante.objects.create(
        estudiante=setup_enrollment_data['estudiante'],
        materia=setup_enrollment_data['materia'],
        anio=datetime.now().year
    )
    
    response = client.get(
        '/api/estudiantes/materias-inscriptas',
        **setup_enrollment_data['auth_headers']
    )
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['materia_id'] == setup_enrollment_data['materia'].id
    assert data[0]['estado'] == 'CONF'  # Default state is CONFIRMADA

def test_cancel_enrollment(client, setup_enrollment_data):
    # Create enrollment
    inscripcion = InscripcionMateriaEstudiante.objects.create(
        estudiante=setup_enrollment_data['estudiante'],
        materia=setup_enrollment_data['materia'],
        anio=datetime.now().year,
        estado='PEND'
    )
    
    payload = {
        "dni": setup_enrollment_data['estudiante'].dni
    }
    
    response = client.post(
        f'/api/estudiantes/cancelar-inscripcion?inscripcion_id={inscripcion.id}',
        data=payload,
        content_type='application/json',
        **setup_enrollment_data['admin_auth_headers']
    )
    
    assert response.status_code == 200
    assert response.json()['ok'] is True
    
    inscripcion.refresh_from_db()
    assert inscripcion.estado == 'ANUL'
