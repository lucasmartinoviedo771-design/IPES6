import pytest
import json
from datetime import datetime, date
from core.models import Profesorado, Preinscripcion, Estudiante, User, VentanaHabilitacion
from rest_framework_simplejwt.tokens import AccessToken

@pytest.fixture
def setup_data(db):
    # Create a user with admin access (staff)
    user = User.objects.create_user(username='adminuser_mgmt', password='adminpass', first_name='Admin', last_name='User', email='admin_mgmt@example.com', is_staff=True)
    
    # Create a regular user/estudiante for preinscription
    student_user = User.objects.create_user(username='student_mgmt', password='studentpass', first_name='Juan', last_name='Perez', email='juan_mgmt@example.com')
    estudiante = Estudiante.objects.create(user=student_user, dni='88888888', fecha_nacimiento=date(2000, 1, 1))
    
    # Create a carrera
    carrera = Profesorado.objects.create(nombre='Profesorado de Física', activo=True, inscripcion_abierta=True, duracion_anios=4)
    
    # Create active window for preinscription
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True
    )
    
    token = AccessToken.for_user(user)
    return {
        'admin_user': user,
        'estudiante': estudiante,
        'carrera': carrera,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    }

from datetime import timedelta

def test_update_preinscripcion_data(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-UPDATE-001'
    )
    
    payload = {
        "estudiante": {
            "dni": setup_data['estudiante'].dni,
            "nombres": "Updated Name",
            "apellido": "Updated Lastname",
            "fecha_nacimiento": "2000-01-01",
            "email": "updated@example.com",
            "telefono": "99999999",
            "domicilio": "Updated Address"
        },
        "datos_extra": {"updated": True}
    }
    
    response = client.put(
        f'/api/preinscripciones/by-code/{pre.codigo}',
        data=payload,
        content_type='application/json',
        **setup_data['auth_headers']
    )
    assert response.status_code == 200
    data = response.json()
    assert data['estudiante']['nombre'] == "Updated Name"
    assert data['estudiante']['email'] == "updated@example.com"
    
    pre.refresh_from_db()
    assert pre.estudiante.user.first_name == "Updated Name"
    assert pre.estudiante.user.email == "updated@example.com"

def test_manage_checklist(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-CHECKLIST-001'
    )
    
    # Initial GET should be empty/default
    response = client.get(f'/api/preinscripciones/{pre.id}/checklist', **setup_data['auth_headers'])
    assert response.status_code == 200
    data = response.json()
    assert data['dni_legalizado'] is False
    
    # Update checklist
    payload = {
        "dni_legalizado": True,
        "fotos_4x4": True,
        "folios_oficio": 2,
        "curso_introductorio_aprobado": True
    }
    
    response = client.put(
        f'/api/preinscripciones/{pre.id}/checklist',
        data=payload,
        content_type='application/json',
        **setup_data['auth_headers']
    )
    assert response.status_code == 200
    data = response.json()
    assert data['dni_legalizado'] is True
    assert data['curso_introductorio_aprobado'] is True
    
    # Verify persistence
    response = client.get(f'/api/preinscripciones/{pre.id}/checklist', **setup_data['auth_headers'])
    assert response.json()['dni_legalizado'] is True

def test_reactivate_preinscripcion(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Borrador',
        activa=False,
        codigo='PRE-REACTIVATE-001'
    )
    
    response = client.post(f'/api/preinscripciones/{pre.id}/activar', **setup_data['auth_headers'])
    assert response.status_code == 200
    
    pre.refresh_from_db()
    assert pre.activa is True
    assert pre.estado == 'Enviada'

def test_add_career_to_student(client, setup_data):
    # Create another career
    other_career = Profesorado.objects.create(nombre='Profesorado de Historia', activo=True, inscripcion_abierta=True, duracion_anios=4)
    
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Confirmada',
        codigo='PRE-ADD-CAREER-001',
        activa=True
    )
    
    payload = {
        "carrera_id": other_career.id,
        "anio": datetime.now().year
    }
    
    response = client.post(
        f'/api/preinscripciones/by-code/{pre.codigo}/carreras',
        data=payload,
        content_type='application/json',
        **setup_data['auth_headers']
    )
    assert response.status_code == 200
    data = response.json()
    assert data['ok'] is True
    
    # Verify new preinscription created
    new_pre_code = data['data']['codigo']
    assert new_pre_code != pre.codigo
    
    new_pre = Preinscripcion.objects.get(codigo=new_pre_code)
    assert new_pre.carrera == other_career
    assert new_pre.estudiante == setup_data['estudiante']
