import json

import pytest

from core.models import (
    CorrelatividadVersion,
    Materia,
    PlanDeEstudio,
    Profesorado,
)

pytestmark = pytest.mark.django_db


def _create_profesorado_with_plan() -> PlanDeEstudio:
    profesorado = Profesorado.objects.create(
        nombre="Profesorado Test",
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )
    idx = PlanDeEstudio.objects.count() + 1
    return PlanDeEstudio.objects.create(
        profesorado=profesorado,
        resolucion=f"R-2020-{idx}",
        anio_inicio=2020,
        anio_fin=None,
        vigente=True,
    )


def _create_materia(plan: PlanDeEstudio, nombre: str, anio: int) -> Materia:
    return Materia.objects.create(
        plan_de_estudio=plan,
        nombre=nombre,
        anio_cursada=anio,
        horas_semana=4,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
        tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
    )


def test_crear_version_exitosa_registra_nueva_version(authenticated_client):
    client, _user = authenticated_client(is_staff=True, roles=("admin",))
    plan = _create_profesorado_with_plan()
    version_inicial = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Default 2020-2022",
        descripcion="Versión inicial",
        cohorte_desde=2020,
        cohorte_hasta=None,
        activo=True,
    )

    payload = {
        "nombre": "Default 2023+",
        "descripcion": "Actualización 2023",
        "cohorte_desde": 2023,
        "cohorte_hasta": None,
        "vigencia_desde": None,
        "vigencia_hasta": None,
        "activo": True,
        "duplicar_version_id": None,
    }

    response = client.post(
        f"/api/planes/{plan.id}/correlatividades/versiones",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 200
    version_inicial.refresh_from_db()
    assert version_inicial.cohorte_hasta == 2022
    data = response.json()
    assert data["nombre"] == "Default 2023+"
    assert data["cohorte_desde"] == 2023


def test_crear_version_recorta_version_superpuesta(authenticated_client):
    client, _user = authenticated_client(is_staff=True, roles=("admin",))
    plan = _create_profesorado_with_plan()
    CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Default 2020-2022",
        descripcion="Versión 2020-2022",
        cohorte_desde=2020,
        cohorte_hasta=2022,
        activo=True,
    )

    payload = {
        "nombre": "Solapada",
        "descripcion": "Debe fallar",
        "cohorte_desde": 2021,
        "cohorte_hasta": 2024,
        "vigencia_desde": None,
        "vigencia_hasta": None,
        "activo": True,
        "duplicar_version_id": None,
    }

    response = client.post(
        f"/api/planes/{plan.id}/correlatividades/versiones",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 200
    data = response.json()
    assert data["cohorte_desde"] == 2021
    assert data["cohorte_hasta"] == 2024
    version_anterior = CorrelatividadVersion.objects.get(nombre="Default 2020-2022")
    assert version_anterior.cohorte_hasta == 2020


def test_matrix_filtra_por_version_según_cohorte(authenticated_client):
    client, _user = authenticated_client(is_staff=True, roles=("admin",))
    plan = _create_profesorado_with_plan()
    materia_principal = _create_materia(plan, "Didáctica II", 2)
    correlativa_antigua = _create_materia(plan, "Pedagogía", 1)
    correlativa_nueva = _create_materia(plan, "Prácticas Integradas", 2)

    version_2020 = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Plan 2020-2022",
        cohorte_desde=2020,
        cohorte_hasta=2022,
        activo=True,
    )
    version_2023 = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Plan 2023+",
        cohorte_desde=2023,
        cohorte_hasta=None,
        activo=True,
    )

    payload_antiguo = {
        "regular_para_cursar": [correlativa_antigua.id],
        "aprobada_para_cursar": [],
        "aprobada_para_rendir": [],
    }
    payload_nuevo = {
        "regular_para_cursar": [],
        "aprobada_para_cursar": [correlativa_nueva.id],
        "aprobada_para_rendir": [],
    }

    response_old = client.post(
        f"/api/materias/{materia_principal.id}/correlatividades?version_id={version_2020.id}",
        data=json.dumps(payload_antiguo),
        content_type="application/json",
    )
    assert response_old.status_code == 200

    response_new = client.post(
        f"/api/materias/{materia_principal.id}/correlatividades?version_id={version_2023.id}",
        data=json.dumps(payload_nuevo),
        content_type="application/json",
    )
    assert response_new.status_code == 200

    matrix_2021 = client.get(f"/api/planes/{plan.id}/correlatividades_matrix?cohorte=2021")
    assert matrix_2021.status_code == 200
    row_2021 = next(row for row in matrix_2021.json() if row["id"] == materia_principal.id)
    assert row_2021["regular_para_cursar"] == [correlativa_antigua.id]
    assert row_2021["aprobada_para_cursar"] == []

    matrix_2024 = client.get(f"/api/planes/{plan.id}/correlatividades_matrix?cohorte=2024")
    assert matrix_2024.status_code == 200
    row_2024 = next(row for row in matrix_2024.json() if row["id"] == materia_principal.id)
    assert row_2024["regular_para_cursar"] == []
    assert row_2024["aprobada_para_cursar"] == [correlativa_nueva.id]


def test_actualizar_version_recorta_rango_previo(authenticated_client):
    client, _user = authenticated_client(is_staff=True, roles=("admin",))
    plan = _create_profesorado_with_plan()
    version_prev = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Versión 2020+",
        descripcion="Base",
        cohorte_desde=2020,
        cohorte_hasta=2023,
        activo=True,
    )
    version_objetivo = CorrelatividadVersion.objects.create(
        plan_de_estudio=plan,
        profesorado=plan.profesorado,
        nombre="Versión nueva",
        descripcion="",
        cohorte_desde=2024,
        cohorte_hasta=None,
        activo=True,
    )

    payload = {
        "nombre": "Versión nueva",
        "descripcion": "",
        "cohorte_desde": 2023,
        "cohorte_hasta": None,
        "vigencia_desde": None,
        "vigencia_hasta": None,
        "activo": True,
    }

    response = client.put(
        f"/api/correlatividades/versiones/{version_objetivo.id}",
        data=json.dumps(payload),
        content_type="application/json",
    )

    assert response.status_code == 200
    version_prev.refresh_from_db()
    assert version_prev.cohorte_hasta == 2022
    version_objetivo.refresh_from_db()
    assert version_objetivo.cohorte_desde == 2023
