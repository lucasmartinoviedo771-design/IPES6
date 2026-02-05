import json
import pytest
from datetime import datetime, date, timedelta
from rest_framework_simplejwt.tokens import AccessToken
from core.models import Profesorado, Preinscripcion, Estudiante, User, VentanaHabilitacion
from apps.preinscriptions.schemas import PreinscripcionIn, EstudianteIn

# We will use the 'client' fixture provided by pytest-django

@pytest.fixture
def setup_data(db):
    # Create a user with admin access (staff)
    user = User.objects.create_user(username='adminuser', password='adminpass', first_name='Admin', last_name='User', email='admin@example.com', is_staff=True)
    
    # Create a regular user/estudiante for preinscription
    student_user = User.objects.create_user(username='student', password='studentpass', first_name='Juan', last_name='Perez', email='juan@example.com')
    estudiante = Estudiante.objects.create(user=student_user, dni='12345678', fecha_nacimiento=date(2000, 1, 1))
    
    # Create a carrera
    carrera = Profesorado.objects.create(nombre='Profesorado de Matemática', activo=True, inscripcion_abierta=True, duracion_anios=4)
    
    # Create active window for preinscription
    today = datetime.now().date()
    ventana = VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True
    )

    # Generate token for admin user
    token = AccessToken.for_user(user)
    
    return {
        'admin_user': user,
        'student_user': student_user,
        'estudiante': estudiante,
        'carrera': carrera,
        'ventana': ventana,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    }

def test_create_preinscripcion(client, setup_data):
    # Public endpoint, no auth needed
    payload = {
        "carrera_id": setup_data['carrera'].id,
        "foto_4x4_dataurl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
        "estudiante": {
            "dni": "87654321",
            "nombres": "Nuevo",
            "apellido": "Estudiante",
            "fecha_nacimiento": "2005-05-05",
            "email": "nuevo@example.com",
            "telefono": "1122334455",
            "domicilio": "Calle Falsa 123"
        },
        "datos_extra": {},
        "honeypot": None
    }
    
    response = client.post('/api/preinscripciones', data=payload, content_type='application/json')
    assert response.status_code == 200
    data = response.json()
    assert data.get('ok') is True
    assert 'data' in data
    assert 'codigo' in data['data']

def test_list_preinscripciones(client, setup_data):
    # Create a preinscription manually
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-TEST-001'
    )
    
    response = client.get('/api/preinscripciones/', **setup_data['auth_headers'])
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]['codigo'] == pre.codigo

def test_get_preinscripcion_by_code(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-TEST-CODE'
    )
    
    response = client.get(f'/api/preinscripciones/by-code/{pre.codigo}', **setup_data['auth_headers'])
    assert response.status_code == 200
    data = response.json()
    assert data['codigo'] == pre.codigo

def test_confirm_preinscripcion(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-CONFIRM-001'
    )
    
    response = client.post(f'/api/preinscripciones/by-code/{pre.codigo}/confirmar', data={}, content_type='application/json', **setup_data['auth_headers'])
    assert response.status_code == 200
    data = response.json()
    assert data['ok'] is True
    
    pre.refresh_from_db()
    assert pre.estado == 'Confirmada'

def test_reject_preinscripcion(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-REJECT-001'
    )
    
    response = client.post(f'/api/preinscripciones/by-code/{pre.codigo}/rechazar', **setup_data['auth_headers'])
    assert response.status_code == 200
    
    pre.refresh_from_db()
    assert pre.estado == 'Rechazada'

def test_observe_preinscripcion(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-OBSERVE-001'
    )
    
    response = client.post(f'/api/preinscripciones/by-code/{pre.codigo}/observar', **setup_data['auth_headers'])
    assert response.status_code == 200
    
    pre.refresh_from_db()
    assert pre.estado == 'Observada'

def test_change_carrera(client, setup_data):
    new_carrera = Profesorado.objects.create(nombre='Arquitectura', activo=True, duracion_anios=5)
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Enviada',
        codigo='PRE-CHANGE-001'
    )
    
    # Note: cambiar-carrera expects query param carrera_id
    response = client.post(f'/api/preinscripciones/by-code/{pre.codigo}/cambiar-carrera?carrera_id={new_carrera.id}', **setup_data['auth_headers'])
    assert response.status_code == 200
    
    pre.refresh_from_db()
    assert pre.carrera.id == new_carrera.id

def test_delete_preinscripcion(client, setup_data):
    pre = Preinscripcion.objects.create(
        estudiante=setup_data['estudiante'],
        carrera=setup_data['carrera'],
        anio=datetime.now().year,
        estado='Borrador',
        codigo='PRE-DELETE-001'
    )
    
    response = client.delete(f'/api/preinscripciones/{pre.id}', **setup_data['auth_headers'])
    assert response.status_code == 204
    
    pre.refresh_from_db()
    # Logic says it sets active=False and state=Borrador
    assert pre.activa is False
