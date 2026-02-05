import pytest
from datetime import date, timedelta
from django.utils import timezone
from core.models import (
    User, Estudiante, Profesorado, PlanDeEstudio, Materia, 
    Comision, Turno, InscripcionMateriaEstudiante, Regularidad,
    MesaExamen, InscripcionMesa, Docente
)
from rest_framework_simplejwt.tokens import AccessToken

@pytest.fixture
def setup_mesa_data(db):
    # Users
    student_user = User.objects.create_user(username='student_mesa', password='password')
    estudiante = Estudiante.objects.create(user=student_user, dni='11111111', estado_legajo=Estudiante.EstadoLegajo.COMPLETO)
    
    teacher_user = User.objects.create_user(username='teacher_mesa', password='password', is_staff=True)
    docente = Docente.objects.create(apellido='Teacher', nombre='Mesa', dni='22222222')
    
    # Career
    carrera = Profesorado.objects.create(nombre='Profesorado Mesa', activo=True, duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=carrera, resolucion='RES-MESA', anio_inicio=2024)
    
    # Subject
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre='Materia Mesa',
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL
    )
    
    token = AccessToken.for_user(student_user)
    
    return {
        'estudiante': estudiante,
        'materia': materia,
        'docente': docente,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    }

def test_enroll_regular_success(client, setup_mesa_data):
    # Setup Regularidad
    Regularidad.objects.create(
        estudiante=setup_mesa_data['estudiante'],
        materia=setup_mesa_data['materia'],
        situacion=Regularidad.Situacion.REGULAR,
        fecha_cierre=date.today() - timedelta(days=30),
        nota_final_cursada=8
    )
    
    # Create Regular Mesa
    mesa = MesaExamen.objects.create(
        materia=setup_mesa_data['materia'],
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.REGULAR,
        fecha=date.today() + timedelta(days=5),
        docente_presidente=setup_mesa_data['docente']
    )
    
    response = client.post(
        '/api/estudiantes/inscribir_mesa',
        data={
            "mesa_id": mesa.id,
            "dni": setup_mesa_data['estudiante'].dni
        },
        content_type='application/json',
        **setup_mesa_data['auth_headers']
    )
    
    assert response.status_code == 200
    assert InscripcionMesa.objects.filter(mesa=mesa, estudiante=setup_mesa_data['estudiante']).exists()

def test_enroll_regular_fail_no_regularity(client, setup_mesa_data):
    # No regularity created
    
    mesa = MesaExamen.objects.create(
        materia=setup_mesa_data['materia'],
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.REGULAR,
        fecha=date.today() + timedelta(days=5),
        docente_presidente=setup_mesa_data['docente']
    )
    
    response = client.post(
        '/api/estudiantes/inscribir_mesa',
        data={
            "mesa_id": mesa.id,
            "dni": setup_mesa_data['estudiante'].dni
        },
        content_type='application/json',
        **setup_mesa_data['auth_headers']
    )
    
    assert response.status_code == 400
    assert "No posee regularidad vigente" in response.json()['message']

def test_enroll_libre_success(client, setup_mesa_data):
    # No regularity, not enrolled
    
    mesa = MesaExamen.objects.create(
        materia=setup_mesa_data['materia'],
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.LIBRE,
        fecha=date.today() + timedelta(days=5),
        docente_presidente=setup_mesa_data['docente']
    )
    
    response = client.post(
        '/api/estudiantes/inscribir_mesa',
        data={
            "mesa_id": mesa.id,
            "dni": setup_mesa_data['estudiante'].dni
        },
        content_type='application/json',
        **setup_mesa_data['auth_headers']
    )
    
    assert response.status_code == 200
    assert InscripcionMesa.objects.filter(mesa=mesa, estudiante=setup_mesa_data['estudiante']).exists()

def test_enroll_libre_fail_if_regular(client, setup_mesa_data):
    # Setup Regularidad
    Regularidad.objects.create(
        estudiante=setup_mesa_data['estudiante'],
        materia=setup_mesa_data['materia'],
        situacion=Regularidad.Situacion.REGULAR,
        fecha_cierre=date.today() - timedelta(days=30),
        nota_final_cursada=8
    )
    
    mesa = MesaExamen.objects.create(
        materia=setup_mesa_data['materia'],
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.LIBRE,
        fecha=date.today() + timedelta(days=5),
        docente_presidente=setup_mesa_data['docente']
    )
    
    response = client.post(
        '/api/estudiantes/inscribir_mesa',
        data={
            "mesa_id": mesa.id,
            "dni": setup_mesa_data['estudiante'].dni
        },
        content_type='application/json',
        **setup_mesa_data['auth_headers']
    )
    
    assert response.status_code == 400
    assert "Tienes regularidad vigente" in response.json()['message']

def test_enroll_libre_fail_if_cursando(client, setup_mesa_data):
    # Setup Enrollment (Cursando)
    InscripcionMateriaEstudiante.objects.create(
        estudiante=setup_mesa_data['estudiante'],
        materia=setup_mesa_data['materia'],
        anio=date.today().year,
        estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA
    )
    
    mesa = MesaExamen.objects.create(
        materia=setup_mesa_data['materia'],
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.LIBRE,
        fecha=date.today() + timedelta(days=5),
        docente_presidente=setup_mesa_data['docente']
    )
    
    response = client.post(
        '/api/estudiantes/inscribir_mesa',
        data={
            "mesa_id": mesa.id,
            "dni": setup_mesa_data['estudiante'].dni
        },
        content_type='application/json',
        **setup_mesa_data['auth_headers']
    )
    
    assert response.status_code == 400
    assert "Estás cursando la materia actualmente" in response.json()['message']
