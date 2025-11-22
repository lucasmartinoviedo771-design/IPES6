import pytest
from datetime import datetime, time, timedelta
from rest_framework_simplejwt.tokens import AccessToken
from core.models import (
    Profesorado, PlanDeEstudio, Materia, Estudiante, User, 
    InscripcionMateriaAlumno, Correlatividad, Regularidad,
    Turno, Bloque, HorarioCatedra, HorarioCatedraDetalle,
    VentanaHabilitacion
)

@pytest.fixture
def setup_error_scenarios(db):
    # Create student user
    user = User.objects.create_user(username='student_error', password='password', first_name='Student', last_name='Error', email='student_error@example.com')
    estudiante = Estudiante.objects.create(user=user, dni='22222222', curso_introductorio_aprobado=True)
    
    # Create career and plan
    carrera = Profesorado.objects.create(nombre='Profesorado de Error', activo=True, inscripcion_abierta=True, duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=carrera, resolucion='RES-ERROR', anio_inicio=2024, vigente=True)
    
    # Create Turno and Bloque for schedule conflict
    turno = Turno.objects.create(nombre='Noche')
    bloque = Bloque.objects.create(turno=turno, dia=1, hora_desde=time(18, 0), hora_hasta=time(22, 0)) # Monday 18-22
    
    token = AccessToken.for_user(user)
    
    return {
        'student_user': user,
        'estudiante': estudiante,
        'plan': plan,
        'turno': turno,
        'bloque': bloque,
        'auth_headers': {'HTTP_AUTHORIZATION': f'Bearer {token}'}
    }

def test_enrollment_schedule_conflict(client, setup_error_scenarios):
    # Create a generic active window to allow reaching schedule check
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='1C_ANUALES'
    )

    # Subject 1
    materia1 = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia 1',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    # Schedule for Subject 1
    hc1 = HorarioCatedra.objects.create(
        espacio=materia1,
        turno=setup_error_scenarios['turno'],
        anio_cursada=datetime.now().year
    )
    HorarioCatedraDetalle.objects.create(horario_catedra=hc1, bloque=setup_error_scenarios['bloque'])
    
    # Subject 2 (Same schedule)
    materia2 = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia 2',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    # Schedule for Subject 2
    hc2 = HorarioCatedra.objects.create(
        espacio=materia2,
        turno=setup_error_scenarios['turno'],
        anio_cursada=datetime.now().year
    )
    HorarioCatedraDetalle.objects.create(horario_catedra=hc2, bloque=setup_error_scenarios['bloque'])
    
    # Enroll in Subject 1
    InscripcionMateriaAlumno.objects.create(
        estudiante=setup_error_scenarios['estudiante'],
        materia=materia1,
        anio=datetime.now().year,
        estado='CONF'
    )
    
    # Try to enroll in Subject 2
    payload = {"materia_id": materia2.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    assert response.status_code == 400
    assert "Superposición horaria" in response.json()['message']

def test_enrollment_missing_correlatives(client, setup_error_scenarios):
    # Create a generic active window
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='1C_ANUALES'
    )

    # Subject A (Prerequisite)
    materia_a = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia A',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    
    # Subject B (Target)
    materia_b = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia B',
        anio_cursada=2,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    
    # Define Correlativity: B requires A regularized
    Correlatividad.objects.create(
        materia_origen=materia_b,
        materia_correlativa=materia_a,
        tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR
    )
    
    # Try to enroll in B without A
    payload = {"materia_id": materia_b.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    assert response.status_code == 400
    assert "Correlatividades no cumplidas" in response.json()['message']
    assert "Regular en Materia A" in response.json()['data']['faltantes'][0]

def test_enrollment_edi_without_intro(client, setup_error_scenarios):
    # Create a generic active window
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='1C_ANUALES'
    )

    # EDI Subject
    materia_edi = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='EDI 1',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL 
    )
    
    # Ensure student has NOT approved intro course (default)
    setup_error_scenarios['estudiante'].curso_introductorio_aprobado = False
    setup_error_scenarios['estudiante'].save()
    assert not setup_error_scenarios['estudiante'].curso_introductorio_aprobado
    
    payload = {"materia_id": materia_edi.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    # This assertion should now PASS (200 OK) as enrollment is allowed without intro course
    assert response.status_code == 200, "Should allow EDI enrollment even if Intro Course is not approved"
    # The response structure might be just the data or ApiResponse, let's check status code primarily
    # If it returns 200, it means success.
    assert response.json()['message'] == "Inscripción a materia registrada"

def test_enrollment_wrong_semester_window(client, setup_error_scenarios):
    # Create an active window for 1st Semester + Annuals
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='1C_ANUALES'
    )

    # Subject 2nd Semester (Should be blocked)
    materia_2c = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia 2C',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.SEGUNDO_CUATRIMESTRE,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    
    payload = {"materia_id": materia_2c.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    # This assertion is expected to FAIL if the validation is missing
    assert response.status_code == 400, "Should block enrollment for 2nd semester subject when window is 1C_ANUALES"
    assert "no corresponde al periodo de inscripción habilitado" in response.json().get('message', '')

def test_enrollment_correct_semester_window(client, setup_error_scenarios):
    # Create an active window for 2nd Semester
    today = datetime.now().date()
    VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MATERIAS,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=10),
        activo=True,
        periodo='2C'
    )

    # Subject 2nd Semester (Should be allowed)
    materia_2c = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia 2C OK',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.SEGUNDO_CUATRIMESTRE,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    
    payload = {"materia_id": materia_2c.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    assert response.status_code == 200, "Should allow enrollment for 2nd semester subject when window is 2C"

def test_enrollment_no_active_window(client, setup_error_scenarios):
    # Ensure NO active window exists
    VentanaHabilitacion.objects.all().delete()
    
    # Subject
    materia = Materia.objects.create(
        plan_de_estudio=setup_error_scenarios['plan'],
        nombre='Materia Test',
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL
    )
    
    payload = {"materia_id": materia.id}
    response = client.post(
        '/api/alumnos/inscripcion-materia',
        data=payload,
        content_type='application/json',
        **setup_error_scenarios['auth_headers']
    )
    
    # This assertion is expected to FAIL if the system allows enrollment without a window
    assert response.status_code == 400, "Should block enrollment if NO window is active"
    assert "No hay un periodo de inscripción a materias activo" in response.json().get('message', '')
