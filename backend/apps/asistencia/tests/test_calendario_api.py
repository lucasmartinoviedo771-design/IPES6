import json
from datetime import date
import uuid

import pytest

from core.models import (
    Comision,
    Materia,
    PlanDeEstudio,
    Profesorado,
    StaffAsignacion,
    Turno,
    Docente,
)


pytestmark = pytest.mark.django_db


def _create_structure():
    turno, _ = Turno.objects.get_or_create(nombre="Turno Calendario")
    profesorado = Profesorado.objects.create(
        nombre=f"Profesorado CAL {uuid.uuid4().hex[:4]}",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    plan = PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion=f"RES-CAL-{uuid.uuid4().hex[:4]}",
        anio_inicio=2021,
        anio_fin=None,
        vigente=True,
    )
    materia = Materia.objects.create(
        plan_de_estudio=plan,
        nombre=f"Mat CAL {uuid.uuid4().hex[:4]}",
        anio_cursada=1,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )
    docente = Docente.objects.create(nombre="Doc", apellido="Calendario", dni=str(uuid.uuid4().int)[:8])
    comision = Comision.objects.create(
        materia=materia,
        anio_lectivo=2025,
        codigo=f"CAL-{uuid.uuid4().hex[:4]}",
        turno=turno,
        docente=docente,
    )
    return {"profesorado": profesorado, "plan": plan, "materia": materia, "comision": comision}


def _calendar_payload(comision, nombre="Suspensión"):
    today = date.today()
    return {
        "nombre": nombre,
        "tipo": "suspension",
        "subtipo": "general",
        "fecha_desde": today.isoformat(),
        "fecha_hasta": today.isoformat(),
        "turno_id": comision.turno_id,
        "profesorado_id": None,
        "plan_id": None,
        "comision_id": comision.id,
        "docente_id": None,
        "aplica_docentes": True,
        "aplica_estudiantes": True,
        "motivo": "Prueba",
        "activo": True,
    }


def test_bedel_cannot_create_event_outside_scope(authenticated_client):
    client, user = authenticated_client(username="bedel-create", roles=("bedel",))
    data1 = _create_structure()
    data2 = _create_structure()

    payload = _calendar_payload(data2["comision"])
    resp = client.post(
        "/api/asistencia/calendario/",
        data=json.dumps(payload),
        content_type="application/json",
    )
    assert resp.status_code == 403

    StaffAsignacion.objects.create(
        user=user,
        profesorado=data1["profesorado"],
        rol=StaffAsignacion.Rol.BEDEL,
    )

    payload_ok = _calendar_payload(data1["comision"])
    ok_resp = client.post(
        "/api/asistencia/calendario/",
        data=json.dumps(payload_ok),
        content_type="application/json",
    )
    assert ok_resp.status_code == 200


def test_bedel_list_only_sees_assigned_profesorado(authenticated_client):
    admin_client, _ = authenticated_client(username="admin-cal", roles=("admin",), is_staff=True)

    data1 = _create_structure()
    data2 = _create_structure()

    for idx, data in enumerate([data1, data2], start=1):
        payload = _calendar_payload(data["comision"], nombre=f"Evento {idx}")
        admin_resp = admin_client.post(
            "/api/asistencia/calendario/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert admin_resp.status_code == 200, admin_resp.json()

    bedel_client, bedel_user = authenticated_client(username="bedel-list", roles=("bedel",))

    StaffAsignacion.objects.create(
        user=bedel_user,
        profesorado=data1["profesorado"],
        rol=StaffAsignacion.Rol.BEDEL,
    )

    resp = bedel_client.get("/api/asistencia/calendario/")
    assert resp.status_code == 200
    nombres = {evento["nombre"] for evento in resp.json()}
    assert "Evento 1" in nombres
    assert "Evento 2" not in nombres
