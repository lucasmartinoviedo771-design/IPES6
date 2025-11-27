from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from itertools import count
from types import SimpleNamespace

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from ninja.errors import HttpError

from apps.alumnos.api.curso_intro_api import (
    curso_intro_auto_inscripcion,
    curso_intro_cerrar_registro,
    curso_intro_registrar_asistencia,
)
from apps.alumnos.schemas import (
    CursoIntroAsistenciaIn,
    CursoIntroAutoInscripcionIn,
    CursoIntroCierreIn,
)
from core.models import (
    CursoIntroductorioCohorte,
    CursoIntroductorioRegistro,
    Estudiante,
    Profesorado,
    Turno,
    VentanaHabilitacion,
)


_dni_sequence = count(5000)


def _build_request(user: User) -> SimpleNamespace:
    return SimpleNamespace(user=user, audit_session_id=None, request_id=None, audit_ip=None)


def _create_profesorado(nombre: str = "Profesorado Test") -> Profesorado:
    return Profesorado.objects.create(
        nombre=nombre,
        duracion_anios=4,
        activo=True,
        inscripcion_abierta=True,
    )


def _create_estudiante(username: str = "est_ci", dni: str | None = None) -> tuple[User, Estudiante]:
    user = User.objects.create_user(username=username, password="test123")
    dni_value = dni or f"{next(_dni_sequence):08d}"
    estudiante = Estudiante.objects.create(user=user, dni=dni_value[:10])
    return user, estudiante


def _create_cohorte_activa(profesorado: Profesorado, turno_nombre: str = "Manana") -> tuple[CursoIntroductorioCohorte, Turno]:
    today = timezone.now().date()
    ventana = VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.CURSO_INTRODUCTORIO,
        desde=today - timedelta(days=1),
        hasta=today + timedelta(days=5),
        activo=True,
    )
    turno = Turno.objects.create(nombre=turno_nombre)
    cohorte = CursoIntroductorioCohorte.objects.create(
        nombre=f"Cohorte {today.year}",
        anio_academico=today.year,
        profesorado=profesorado,
        turno=turno,
        ventana_inscripcion=ventana,
    )
    return cohorte, turno


def _create_registro_base() -> tuple[CursoIntroductorioRegistro, Estudiante, Profesorado]:
    profesorado = _create_profesorado("Profesorado Ciencias")
    cohorte, turno = _create_cohorte_activa(profesorado, turno_nombre="Tarde")
    _, estudiante = _create_estudiante(username="est_registro")
    estudiante.asignar_profesorado(profesorado)
    registro = CursoIntroductorioRegistro.objects.create(
        estudiante=estudiante,
        cohorte=cohorte,
        profesorado=profesorado,
        turno=turno,
    )
    return registro, estudiante, profesorado


@pytest.mark.django_db
def test_curso_intro_auto_inscripcion_crea_registro_activo():
    user, estudiante = _create_estudiante("est_auto", "4500")
    profesorado = _create_profesorado("Profesorado Matematica")
    estudiante.asignar_profesorado(profesorado)
    cohorte, turno = _create_cohorte_activa(profesorado, turno_nombre="Manana")

    payload = CursoIntroAutoInscripcionIn(
        cohorte_id=cohorte.id,
        profesorado_id=profesorado.id,
        turno_id=turno.id,
    )

    response = curso_intro_auto_inscripcion(_build_request(user), payload)

    registro = CursoIntroductorioRegistro.objects.get(id=response.id)
    assert response.cohorte_id == cohorte.id
    assert response.estudiante_id == estudiante.id
    assert registro.profesorado_id == profesorado.id
    assert registro.turno_id == turno.id


@pytest.mark.django_db
def test_curso_intro_auto_inscripcion_rechaza_cohorte_fuera_de_ventana():
    user, estudiante = _create_estudiante("est_inactivo", "4501")
    profesorado = _create_profesorado("Profesorado Historia")
    estudiante.asignar_profesorado(profesorado)
    today = timezone.now().date()
    ventana = VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.CURSO_INTRODUCTORIO,
        desde=today - timedelta(days=10),
        hasta=today - timedelta(days=5),
        activo=False,
    )
    turno = Turno.objects.create(nombre="Noche")
    cohorte = CursoIntroductorioCohorte.objects.create(
        nombre="Fuera de ventana",
        anio_academico=today.year,
        profesorado=profesorado,
        turno=turno,
        ventana_inscripcion=ventana,
    )
    payload = CursoIntroAutoInscripcionIn(cohorte_id=cohorte.id, profesorado_id=profesorado.id)

    with pytest.raises(HttpError) as exc:
        curso_intro_auto_inscripcion(_build_request(user), payload)

    assert exc.value.status_code == 400
    assert "habilitada" in str(exc.value)


@pytest.mark.django_db
def test_curso_intro_registrar_asistencia_actualiza_porcentaje():
    registro, _, _ = _create_registro_base()
    staff = User.objects.create(username="staff_asistencia", is_staff=True)
    payload = CursoIntroAsistenciaIn(asistencias_totales=85)

    response = curso_intro_registrar_asistencia(_build_request(staff), registro.id, payload)

    registro.refresh_from_db()
    assert registro.asistencias_totales == 85
    assert response.asistencias_totales == 85


@pytest.mark.django_db
def test_curso_intro_registrar_asistencia_valida_rango():
    registro, _, _ = _create_registro_base()
    staff = User.objects.create(username="staff_asistencia_2", is_staff=True)
    payload = SimpleNamespace(asistencias_totales=150)

    with pytest.raises(HttpError) as exc:
        curso_intro_registrar_asistencia(_build_request(staff), registro.id, payload)

    assert exc.value.status_code == 400
    assert "asistencia" in str(exc.value).lower()


@pytest.mark.django_db
def test_curso_intro_cierre_aprueba_registro_y_bandera_estudiante():
    registro, estudiante, _ = _create_registro_base()
    staff = User.objects.create(username="staff_cierre", is_staff=True)
    payload = CursoIntroCierreIn(
        nota_final=9,
        asistencias_totales=95,
        resultado=CursoIntroductorioRegistro.Resultado.APROBADO,
        observaciones="Excelente desempeno",
    )

    response = curso_intro_cerrar_registro(_build_request(staff), registro.id, payload)

    registro.refresh_from_db()
    estudiante.refresh_from_db()
    assert registro.resultado == CursoIntroductorioRegistro.Resultado.APROBADO
    assert registro.nota_final == Decimal("9.00")
    assert registro.resultado_por == staff
    assert registro.resultado_at is not None
    assert estudiante.curso_introductorio_aprobado is True
    assert response.resultado == CursoIntroductorioRegistro.Resultado.APROBADO
    assert response.asistencias_totales == 95


@pytest.mark.django_db
def test_curso_intro_cierre_rechaza_nota_fuera_de_rango():
    registro, _, _ = _create_registro_base()
    staff = User.objects.create(username="staff_cierre_2", is_staff=True)
    payload = SimpleNamespace(
        nota_final=0,
        asistencias_totales=80,
        resultado=CursoIntroductorioRegistro.Resultado.APROBADO,
        observaciones=None,
    )

    with pytest.raises(HttpError) as exc:
        curso_intro_cerrar_registro(_build_request(staff), registro.id, payload)

    assert exc.value.status_code == 400
    assert "nota" in str(exc.value).lower()
