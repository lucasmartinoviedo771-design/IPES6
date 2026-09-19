"""
Pruebas de regresión para Auditoría de Seguridad - Lote 2 (F09, F10, F11, F12):
- F09: Control de acceso a documentación de legajos y preinscripciones (admin_documentacion_api.py, api_uploads.py).
- F10: Autoservicio de perfil del estudiante - aislamiento estricto de campos personales (perfil_api.py, schemas).
- F11: Marcación docente en Kiosco - protección contra invocación por estudiantes o terceros (api_docentes.py).
- F12: Actas orales y consulta de historial académico - restricción por titularidad y carrera (actas_orales.py, user_utils.py).
"""

from datetime import date, time
from unittest.mock import patch

import pytest
from django.conf import settings
from django.contrib.auth.models import Group, User
from ninja.errors import HttpError

from apps.asistencia.api_docentes import kiosk_marcar_bulk, marcar_docente_presente
from apps.asistencia.cargos_models import Cargo, CargoDocente, HorarioCargo
from apps.asistencia.models import ClaseProgramada
from apps.asistencia.schemas import DocenteMarcarPresenteIn, KioskBulkItemIn, KioskBulkMarcarIn
from apps.common.errors import AppError
from apps.estudiantes.api.actas_orales import descargar_acta_oral_pdf, listar_actas_orales, obtener_acta_oral
from apps.estudiantes.api.admin_documentacion_api import admin_list_estudiantes_documentacion
from apps.estudiantes.api.helpers.user_utils import _ensure_estudiante_access
from apps.estudiantes.api.perfil_api import estudiante_update_perfil_completar
from apps.estudiantes.schemas import PerfilEstudianteUpdateIn
from apps.preinscriptions.api_uploads import check_preins_access
from core.models import (
    Comision,
    Docente,
    Estudiante,
    EstudianteCarrera,
    InscripcionMesa,
    Materia,
    MesaActaOral,
    MesaExamen,
    Persona,
    PlanDeEstudio,
    Preinscripcion,
    Profesorado,
    StaffAsignacion,
    Turno,
    UserProfile,
)

pytestmark = pytest.mark.django_db


class DummyRequest:
    def __init__(self, user, get_params=None, headers=None):
        self.user = user
        self.GET = get_params or {}
        self.COOKIES = {}
        self.headers = headers or {}

    def build_absolute_uri(self, location=""):
        return f"http://testserver{location}"


@pytest.fixture
def lote2_setup():
    # Grupos / Roles
    g_admin, _ = Group.objects.get_or_create(name="admin")
    g_sec, _ = Group.objects.get_or_create(name="secretaria")
    g_bedel, _ = Group.objects.get_or_create(name="bedel")
    g_docente, _ = Group.objects.get_or_create(name="docente")
    g_estudiante, _ = Group.objects.get_or_create(name="estudiante")
    g_kiosk, _ = Group.objects.get_or_create(name="kiosk")

    # Carreras
    carrera_a = Profesorado.objects.create(nombre="Profesorado en Inglés", duracion_anios=4)
    carrera_b = Profesorado.objects.create(nombre="Profesorado en Primaria", duracion_anios=4)

    # Planes
    plan_a = PlanDeEstudio.objects.create(profesorado=carrera_a, resolucion="RES-ING-2020", anio_inicio=2020, vigente=True)
    plan_b = PlanDeEstudio.objects.create(profesorado=carrera_b, resolucion="RES-PRI-2020", anio_inicio=2020, vigente=True)

    # Materias
    mat_a = Materia.objects.create(
        plan_de_estudio=plan_a,
        nombre="Lengua Inglesa I",
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
    )
    mat_b = Materia.objects.create(
        plan_de_estudio=plan_b,
        nombre="Didáctica General",
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
    )

    turno = Turno.objects.create(nombre="Vespertino")

    # Usuarios staff
    u_admin = User.objects.create_user(username="admin_lote2", email="admin@ipes.edu.ar")
    u_admin.groups.add(g_admin)

    u_bedel_a = User.objects.create_user(username="bedel_lote2_a", email="bedel_a@ipes.edu.ar")
    u_bedel_a.groups.add(g_bedel)
    StaffAsignacion.objects.create(user=u_bedel_a, profesorado=carrera_a, rol=StaffAsignacion.Rol.BEDEL)

    u_bedel_b = User.objects.create_user(username="bedel_lote2_b", email="bedel_b@ipes.edu.ar")
    u_bedel_b.groups.add(g_bedel)
    StaffAsignacion.objects.create(user=u_bedel_b, profesorado=carrera_b, rol=StaffAsignacion.Rol.BEDEL)

    u_kiosk = User.objects.create_user(username="kiosk_terminal", email="kiosk@ipes.edu.ar")
    u_kiosk.groups.add(g_kiosk)

    # Docente A (Presidente en Mesa A)
    p_doc_a = Persona.objects.create(dni="28111222", nombre="María", apellido="DocenteA", email="doc_a@ipes.edu.ar")
    u_doc_a = User.objects.create_user(username="28111222", email="doc_a@ipes.edu.ar")
    u_doc_a.groups.add(g_docente)
    doc_perfil_a = Docente.objects.create(persona=p_doc_a)
    UserProfile.objects.create(user=u_doc_a, persona=p_doc_a)

    # Docente B (sin cátedra en Mat A ni tribunal)
    p_doc_b = Persona.objects.create(dni="28333444", nombre="Carlos", apellido="DocenteB", email="doc_b@ipes.edu.ar")
    u_doc_b = User.objects.create_user(username="28333444", email="doc_b@ipes.edu.ar")
    u_doc_b.groups.add(g_docente)
    doc_perfil_b = Docente.objects.create(persona=p_doc_b)
    UserProfile.objects.create(user=u_doc_b, persona=p_doc_b)

    # Estudiante A (en Carrera A)
    p_est_a = Persona.objects.create(dni="46000001", nombre="Ana", apellido="EstudianteA", email="est_a@ipes.edu.ar")
    u_est_a = User.objects.create_user(username="46000001", email="est_a@ipes.edu.ar")
    u_est_a.groups.add(g_estudiante)
    est_a = Estudiante.objects.create(user=u_est_a, persona=p_est_a)
    UserProfile.objects.create(user=u_est_a, persona=p_est_a)
    EstudianteCarrera.objects.create(
        estudiante=est_a, profesorado=carrera_a, anio_ingreso=2025, estado_academico="REG"
    )

    # Estudiante B (en Carrera B)
    p_est_b = Persona.objects.create(dni="46000002", nombre="Bruno", apellido="EstudianteB", email="est_b@ipes.edu.ar")
    u_est_b = User.objects.create_user(username="46000002", email="est_b@ipes.edu.ar")
    u_est_b.groups.add(g_estudiante)
    est_b = Estudiante.objects.create(user=u_est_b, persona=p_est_b)
    UserProfile.objects.create(user=u_est_b, persona=p_est_b)
    EstudianteCarrera.objects.create(
        estudiante=est_b, profesorado=carrera_b, anio_ingreso=2025, estado_academico="REG"
    )

    # Preinscripcion de Estudiante A en Carrera A
    preins_a = Preinscripcion.objects.create(
        carrera=carrera_a,
        alumno=est_a,
        codigo="PRE-ING-001",
        anio=2026,
        estado="Enviada",
    )

    # Preinscripcion de Estudiante B en Carrera B
    preins_b = Preinscripcion.objects.create(
        carrera=carrera_b,
        alumno=est_b,
        codigo="PRE-PRI-002",
        anio=2026,
        estado="Enviada",
    )

    # Mesa de examen en Mat A (con Docente A como presidente)
    mesa_a = MesaExamen.objects.create(
        materia=mat_a,
        tipo=MesaExamen.Tipo.FINAL,
        modalidad=MesaExamen.Modalidad.REGULAR,
        fecha=date(2026, 11, 20),
        docente_presidente=doc_perfil_a,
    )

    # Inscripción de Estudiante A a Mesa A y Acta Oral
    insc_mesa_a = InscripcionMesa.objects.create(
        mesa=mesa_a,
        estudiante=est_a,
        estado=InscripcionMesa.Estado.INSCRIPTO,
    )
    acta_oral_a = MesaActaOral.objects.create(
        mesa=mesa_a,
        inscripcion=insc_mesa_a,
        fecha=date(2026, 11, 20),
        nota_final="8",
        observaciones="Excelente examen oral",
        estado_conformidad=MesaActaOral.EstadoConformidad.PENDIENTE,
    )

    # Clase programada y cargo para docente A
    cargo = Cargo.objects.create(
        codigo_cargo="CARG-DOC-01",
        nombre="Profesor Adjunto",
        tipo_cargo=Cargo.TipoCargo.HORAS_CATEDRA,
    )
    cargo_doc = CargoDocente.objects.create(docente=doc_perfil_a, cargo=cargo, activo=True)
    horario_cargo = HorarioCargo.objects.create(
        cargo=cargo,
        dia_semana=0,
        hora_inicio=time(18, 0),
        hora_fin=time(20, 0),
    )
    comision_a = Comision.objects.create(
        materia=mat_a, anio_lectivo=2026, codigo="A", turno=turno, docente=doc_perfil_a
    )
    clase_a = ClaseProgramada.objects.create(
        comision=comision_a,
        docente=doc_perfil_a,
        fecha=date.today(),
        hora_inicio=time(18, 0),
        hora_fin=time(20, 0),
        estado=ClaseProgramada.Estado.PROGRAMADA,
    )

    return {
        "admin": u_admin,
        "bedel_a": u_bedel_a,
        "bedel_b": u_bedel_b,
        "kiosk_user": u_kiosk,
        "doc_a": u_doc_a,
        "doc_b": u_doc_b,
        "doc_perfil_a": doc_perfil_a,
        "est_a": est_a,
        "est_b": est_b,
        "u_est_a": u_est_a,
        "u_est_b": u_est_b,
        "preins_a": preins_a,
        "preins_b": preins_b,
        "mesa_a": mesa_a,
        "insc_mesa_a": insc_mesa_a,
        "acta_oral_a": acta_oral_a,
        "cargo_doc": cargo_doc,
        "horario_cargo": horario_cargo,
        "clase_a": clase_a,
    }


# ==============================================================================
# F09: Control de Acceso a Documentación de Legajos y Preinscripciones
# ==============================================================================


def test_f09_docente_cannot_list_student_documentation(lote2_setup):
    """Docente sin rol administrativo no puede listar la documentación de legajos."""
    data = lote2_setup
    req = DummyRequest(user=data["doc_a"])
    with pytest.raises(AppError) as exc_info:
        admin_list_estudiantes_documentacion(req)
    assert exc_info.value.status_code == 403


def test_f09_docente_cannot_download_preinscripcion_documents(lote2_setup):
    """Docente no puede acceder a documentos de preinscripción."""
    data = lote2_setup
    req = DummyRequest(user=data["doc_a"])
    with pytest.raises(HttpError) as exc_info:
        check_preins_access(req, data["preins_a"].id)
    assert exc_info.value.status_code == 403


def test_f09_bedel_scope_on_preinscripcion_access(lote2_setup):
    """Bedel solo puede acceder a preinscripciones de su carrera asignada."""
    data = lote2_setup
    req_a = DummyRequest(user=data["bedel_a"])
    req_b = DummyRequest(user=data["bedel_b"])

    # Bedel A accede a Preins A (su carrera)
    p_ok = check_preins_access(req_a, data["preins_a"].id)
    assert p_ok.id == data["preins_a"].id

    # Bedel A no puede acceder a Preins B (otra carrera)
    with pytest.raises(HttpError) as exc_info:
        check_preins_access(req_a, data["preins_b"].id)
    assert exc_info.value.status_code == 403

    # Bedel B accede a Preins B (su carrera)
    p_b_ok = check_preins_access(req_b, data["preins_b"].id)
    assert p_b_ok.id == data["preins_b"].id


def test_f09_student_can_only_access_own_preinscripcion(lote2_setup):
    """Estudiante solo puede acceder a su propia preinscripción."""
    data = lote2_setup
    req_est_a = DummyRequest(user=data["u_est_a"])
    req_est_b = DummyRequest(user=data["u_est_b"])

    # Estudiante A accede a la suya
    p_a = check_preins_access(req_est_a, data["preins_a"].id)
    assert p_a.id == data["preins_a"].id

    # Estudiante B intenta acceder a la de A -> 403
    with pytest.raises(HttpError) as exc_info:
        check_preins_access(req_est_b, data["preins_a"].id)
    assert exc_info.value.status_code == 403


# ==============================================================================
# F10: Autoservicio de Perfil del Estudiante
# ==============================================================================


def test_f10_student_can_update_personal_fields(lote2_setup):
    """El estudiante puede actualizar sus campos legítimos de contacto/salud/trabajo."""
    data = lote2_setup
    req = DummyRequest(user=data["u_est_a"])

    payload = PerfilEstudianteUpdateIn(
        domicilio="Av. San Martín 450",
        telefono="2901-554433",
        trabaja=True,
        empleador="Comercio Fueguino",
    )
    detail = estudiante_update_perfil_completar(req, payload)
    assert detail.domicilio == "Av. San Martín 450"
    assert detail.telefono == "2901-554433"


def test_f10_schema_excludes_administrative_fields():
    """El schema PerfilEstudianteUpdateIn no debe poseer campos administrativos."""
    fields = PerfilEstudianteUpdateIn.model_fields.keys()
    forbidden = {
        "dni",
        "cuil",
        "email",
        "nombre",
        "apellido",
        "activo",
        "estado_legajo",
        "must_change_password",
        "carreras_update",
        "documentacion",
        "curso_introductorio_aprobado",
        "libreta_entregada",
        "anio_ingreso",
        "observaciones",
    }
    for field in forbidden:
        assert field not in fields, f"Campo administrativo '{field}' expuesto en PerfilEstudianteUpdateIn"


# ==============================================================================
# F11: Marcación Docente en Kiosco
# ==============================================================================


def test_f11_student_cannot_mark_teacher_attendance(lote2_setup):
    """Una cuenta de estudiante autenticada no puede marcar asistencia docente en kiosco."""
    data = lote2_setup
    req = DummyRequest(user=data["u_est_a"])

    # 1. Kiosk bulk marcar
    bulk_payload = KioskBulkMarcarIn(
        dni=data["doc_perfil_a"].dni,
        items=[KioskBulkItemIn(id=data["horario_cargo"].id, es_cargo=True)],
    )
    with pytest.raises(HttpError) as exc_info:
        kiosk_marcar_bulk(req, bulk_payload)
    assert exc_info.value.status_code == 403

    # 2. Marcar presente individual
    pres_payload = DocenteMarcarPresenteIn(dni=data["doc_perfil_a"].dni)
    with pytest.raises(HttpError) as exc_info:
        marcar_docente_presente(req, data["clase_a"].id, pres_payload)
    assert exc_info.value.status_code == 403


def test_f11_kiosk_key_and_kiosk_role_can_mark_attendance(lote2_setup):
    """Terminal con X-Kiosk-Key o usuario con rol kiosk pueden invocar la marcación."""
    data = lote2_setup

    with patch.object(settings, "KIOSK_API_KEY", "secret-kiosk-token-123"):
        # 1. Invocación con X-Kiosk-Key correcto
        req_key = DummyRequest(
            user=data["u_est_a"],  # cualquier usuario con la clave de terminal
            headers={"X-Kiosk-Key": "secret-kiosk-token-123"},
        )
        bulk_payload = KioskBulkMarcarIn(
            dni=data["doc_perfil_a"].dni,
            items=[KioskBulkItemIn(id=data["horario_cargo"].id, es_cargo=True)],
        )
        resp_key = kiosk_marcar_bulk(req_key, bulk_payload)
        assert resp_key.estado_general in ("PRESENTE", "TARDE")

        # 2. Invocación con usuario con rol kiosk
        req_kiosk_role = DummyRequest(user=data["kiosk_user"])
        resp_role = kiosk_marcar_bulk(req_kiosk_role, bulk_payload)
        assert resp_role.estado_general in ("PRESENTE", "TARDE")


# ==============================================================================
# F12: Actas Orales y Consulta de Historial Académico
# ==============================================================================


def test_f12_student_cannot_view_or_download_other_student_oral_acta(lote2_setup):
    """Estudiante B no puede consultar ni descargar el acta oral de Estudiante A."""
    data = lote2_setup
    req_est_b = DummyRequest(user=data["u_est_b"])

    # 1. Obtener acta oral
    status, resp = obtener_acta_oral(req_est_b, data["mesa_a"].id, data["insc_mesa_a"].id)
    assert status == 403

    # 2. Listar actas orales de la mesa
    status_list, resp_list = listar_actas_orales(req_est_b, data["mesa_a"].id)
    assert status_list == 403

    # 3. Descargar PDF del acta oral de otro alumno
    resp_pdf = descargar_acta_oral_pdf(req_est_b, data["mesa_a"].id, data["insc_mesa_a"].id)
    assert resp_pdf.status_code == 403


def test_f12_student_can_view_own_oral_acta(lote2_setup):
    """Estudiante A puede consultar su propia acta oral."""
    data = lote2_setup
    req_est_a = DummyRequest(user=data["u_est_a"])

    schema = obtener_acta_oral(req_est_a, data["mesa_a"].id, data["insc_mesa_a"].id)
    assert schema.nota_final == "8"
    assert schema.observaciones == "Excelente examen oral"


def test_f12_staff_career_scope_on_oral_actas_and_trayectoria(lote2_setup):
    """Bedel de Carrera B no puede ver actas orales ni historial de Estudiante de Carrera A."""
    data = lote2_setup
    req_bedel_b = DummyRequest(user=data["bedel_b"])
    req_bedel_a = DummyRequest(user=data["bedel_a"])

    # 1. Bedel B no puede ver acta oral de Mesa en Carrera A
    status, _ = obtener_acta_oral(req_bedel_b, data["mesa_a"].id, data["insc_mesa_a"].id)
    assert status == 403

    # 2. Bedel A (de la carrera) sí puede ver el acta oral
    schema_a = obtener_acta_oral(req_bedel_a, data["mesa_a"].id, data["insc_mesa_a"].id)
    assert schema_a.nota_final == "8"

    # 3. Bedel B no puede consultar la trayectoria/historial del Estudiante A
    with pytest.raises(AppError) as exc_info:
        _ensure_estudiante_access(req_bedel_b, data["est_a"].dni)
    assert exc_info.value.status_code == 403

    # 4. Bedel A sí tiene acceso a la trayectoria de su alumno
    _ensure_estudiante_access(req_bedel_a, data["est_a"].dni)
