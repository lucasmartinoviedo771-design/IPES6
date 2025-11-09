import json
from datetime import date, time
import uuid

import pytest
from django.contrib.auth import get_user_model

from core.models import (
    Comision,
    Docente,
    Estudiante,
    Materia,
    PlanDeEstudio,
    Profesorado,
    StaffAsignacion,
    Turno,
)
from apps.asistencia.models import AsistenciaAlumno, ClaseProgramada, Justificacion


pytestmark = pytest.mark.django_db


def _build_academic_structure():
    turno, _ = Turno.objects.get_or_create(nombre="Turno Test")
    profesorado = Profesorado.objects.create(
        nombre=f"Profesorado {uuid.uuid4().hex[:6]}",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion=f"RES-{uuid.uuid4().hex[:6]}",
        anio_inicio=2020,
        anio_fin=None,
        vigente=True,
    )
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre=f"Materia {uuid.uuid4().hex[:4]}",
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )
    docente = Docente.objects.create(nombre="Ana", apellido="Docente", dni="20000000")
    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=2025,
        codigo=f"C-{uuid.uuid4().hex[:4]}",
        turno=turno,
        docente=docente,
    )
    clase = ClaseProgramada.objects.create(
        comision=comision,
        fecha=date.today(),
        hora_inicio=time(8, 0),
        hora_fin=time(10, 0),
        docente=docente,
        docente_dni=docente.dni,
        docente_nombre=f"{docente.apellido}, {docente.nombre}",
    )
    user_model = get_user_model()
    alumno_user = user_model.objects.create_user("30000000", password="TestPass123!")
    estudiante = Estudiante.objects.create(user=alumno_user, dni="30000000")
    return {
        "profesorado": profesorado,
        "plan": plan,
        "materia": materia,
        "docente": docente,
        "comision": comision,
        "clase": clase,
        "estudiante": estudiante,
    }


def test_admin_flow_creates_and_approves_justificacion(authenticated_client):
    client, _user = authenticated_client(roles=("admin",), is_staff=True)
    data = _build_academic_structure()
    payload = {
        "tipo": "estudiante",
        "motivo": "Fiebre",
        "vigencia_desde": data["clase"].fecha.isoformat(),
        "vigencia_hasta": data["clase"].fecha.isoformat(),
        "origen": "posterior",
        "comision_id": data["comision"].id,
        "estudiante_id": data["estudiante"].id,
    }
    response = client.post(
        "/api/asistencia/alumnos/justificaciones",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 200
    justificacion_id = response.json()["id"]
    assert Justificacion.objects.filter(id=justificacion_id, estado=Justificacion.Estado.PENDIENTE).exists()

    list_response = client.get("/api/asistencia/alumnos/justificaciones")
    assert list_response.status_code == 200
    assert any(item["id"] == justificacion_id for item in list_response.json())

    approve_resp = client.post(f"/api/asistencia/alumnos/justificaciones/{justificacion_id}/aprobar")
    assert approve_resp.status_code == 200

    justificacion = Justificacion.objects.get(id=justificacion_id)
    assert justificacion.estado == Justificacion.Estado.APROBADA
    asistencia = AsistenciaAlumno.objects.get(clase=data["clase"], estudiante=data["estudiante"])
    assert asistencia.estado == AsistenciaAlumno.Estado.AUSENTE_JUSTIFICADA


def test_bedel_without_assignment_cannot_create(authenticated_client):
    client, user = authenticated_client(roles=("bedel",))
    data = _build_academic_structure()
    payload = {
        "tipo": "estudiante",
        "motivo": "Trámite",
        "vigencia_desde": data["clase"].fecha.isoformat(),
        "vigencia_hasta": data["clase"].fecha.isoformat(),
        "origen": "posterior",
        "comision_id": data["comision"].id,
        "estudiante_id": data["estudiante"].id,
    }
    response = client.post(
        "/api/asistencia/alumnos/justificaciones",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert response.status_code == 403

    StaffAsignacion.objects.create(
        user=user,
        profesorado=data["profesorado"],
        rol=StaffAsignacion.Rol.BEDEL,
    )
    ok_response = client.post(
        "/api/asistencia/alumnos/justificaciones",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert ok_response.status_code == 200
