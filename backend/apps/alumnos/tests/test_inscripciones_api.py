import json
from datetime import time

import pytest
from freezegun import freeze_time
from model_bakery import baker

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client_with_estudiante(authenticated_client):
    from core.models import Estudiante
    client, user = authenticated_client(username="testuser", roles=("alumno",))
    estudiante = baker.make(Estudiante, user=user, dni=user.username)
    return client, estudiante


def test_inscripcion_materia_success(authenticated_client_with_estudiante):
    client, estudiante = authenticated_client_with_estudiante
    from core.models import Estudiante, Materia, InscripcionMateriaAlumno
    materia = baker.make(Materia)

    payload = {
        "materia_id": materia.id,
        "dni": estudiante.dni,
    }

    response = client.post(
        "/api/alumnos/inscripcion-materia",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Inscripción a materia registrada"
    assert InscripcionMateriaAlumno.objects.filter(estudiante=estudiante, materia=materia).exists()


def test_inscripcion_materia_unmet_prerequisites(authenticated_client_with_estudiante):
    client, estudiante = authenticated_client_with_estudiante
    from core.models import Materia, Correlatividad
    materia_requerida = baker.make(Materia)
    materia_a_inscribir = baker.make(Materia)
    baker.make(
        "Correlatividad",
        materia_origen=materia_a_inscribir,
        materia_correlativa=materia_requerida,
        tipo=Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR,
    )

    payload = {
        "materia_id": materia_a_inscribir.id,
        "dni": estudiante.dni,
    }

    response = client.post(
        "/api/alumnos/inscripcion-materia",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 400
    response_data = response.json()
    assert response_data["ok"] is False
    assert response_data["message"] == "Correlatividades no cumplidas para cursar"


@freeze_time("2025-11-05")
def test_inscripcion_materia_schedule_conflict(client):
    password = "testpassword"
    from django.contrib.auth.models import Group, User
    from core.models import Estudiante
    user = baker.make(User, username="testuser")
    user.set_password(password)
    user.save()
    baker.make(Group, name="alumno")
    user.groups.add(Group.objects.get(name="alumno"))

    response = client.post(
        "/api/auth/login",
        data=json.dumps({"login": "testuser", "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 200

    estudiante = baker.make(Estudiante, user=user, dni=user.username)

    from core.models import Estudiante, Turno, Bloque, Materia, HorarioCatedra, HorarioCatedraDetalle, InscripcionMateriaAlumno
    turno = baker.make(Turno)
    bloque = baker.make(Bloque, turno=turno, hora_desde=time(8, 0), hora_hasta=time(10, 0))

    materia1 = baker.make(Materia)
    horario1 = baker.make(HorarioCatedra, espacio=materia1, turno=turno)
    baker.make(HorarioCatedraDetalle, horario_catedra=horario1, bloque=bloque)

    materia2 = baker.make(Materia)
    horario2 = baker.make(HorarioCatedra, espacio=materia2, turno=turno)
    baker.make(HorarioCatedraDetalle, horario_catedra=horario2, bloque=bloque)

    # Inscribir en la primera materia
    baker.make(InscripcionMateriaAlumno, estudiante=estudiante, materia=materia1, anio=2025)

    payload = {
        "materia_id": materia2.id,
        "dni": estudiante.dni,
    }

    response = client.post(
        "/api/alumnos/inscripcion-materia",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 400
    response_data = response.json()
    assert response_data["ok"] is False
    assert response_data["message"] == "Superposición horaria con otra materia inscripta"


def test_list_materias_inscriptas(client):
    password = "testpassword"
    from django.contrib.auth.models import Group, User
    from core.models import Estudiante, Materia, InscripcionMateriaAlumno
    user = baker.make(User, username="testuser")
    user.set_password(password)
    user.save()
    baker.make(Group, name="alumno")
    user.groups.add(Group.objects.get(name="alumno"))

    response = client.post(
        "/api/auth/login",
        data=json.dumps({"login": "testuser", "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 200

    estudiante = baker.make(Estudiante, user=user, dni=user.username)
    materia1 = baker.make(Materia)
    materia2 = baker.make(Materia)
    baker.make(InscripcionMateriaAlumno, estudiante=estudiante, materia=materia1, anio=2025)
    baker.make(InscripcionMateriaAlumno, estudiante=estudiante, materia=materia2, anio=2025)

    response = client.get(f"/api/alumnos/materias-inscriptas?dni={estudiante.dni}")

    assert response.status_code == 200
    response_data = response.json()
    assert len(response_data) == 2
    assert response_data[0]["materia_id"] == materia2.id
    assert response_data[1]["materia_id"] == materia1.id


def test_cancelar_inscripcion_materia(client):
    password = "testpassword"
    from django.contrib.auth.models import Group, User
    from core.models import Estudiante, Materia, InscripcionMateriaAlumno
    user = baker.make(User, username="testuser")
    user.set_password(password)
    user.save()
    baker.make(Group, name="admin")
    user.groups.add(Group.objects.get(name="admin"))

    response = client.post(
        "/api/auth/login",
        data=json.dumps({"login": "testuser", "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 200

    estudiante = baker.make(Estudiante, user=user, dni=user.username)
    materia = baker.make(Materia)
    inscripcion = baker.make(
        InscripcionMateriaAlumno,
        estudiante=estudiante,
        materia=materia,
        anio=2025,
        estado="CONF",
    )

    payload = {
        "dni": estudiante.dni,
    }

    response = client.post(
        f"/api/alumnos/inscripcion-materia/{inscripcion.id}/cancelar",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 200
    response_data = response.json()
    assert response_data["ok"] is True
    assert response_data["message"] == "Inscripción cancelada exitosamente."
    inscripcion.refresh_from_db()
    assert inscripcion.estado == "ANUL"
