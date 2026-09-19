"""
Pruebas de regresión para Auditoría de Seguridad - Lote 1 (F06, F07, F08):
- F06: Control estricto de alcance de carrera en gestión operativa de comisiones (gestion_comisiones_api.py).
- F07: Restricción territorial y titularidad de cátedra en carga, visualización y cierre de regularidades (regularidades_carga.py).
- F08: Restricción por carrera en consulta, edición, baja y prórrogas de legajos de estudiantes (admin_estudiantes_core_api.py).
"""

from datetime import date

import pytest
from django.contrib.auth.models import Group, User

from apps.common.errors import AppError
from apps.estudiantes.api.admin_estudiantes_core_api import (
    admin_create_prorroga_titulo,
    admin_delete_estudiante,
    admin_delete_prorroga_titulo,
    admin_get_estudiante,
    admin_list_prorrogas_titulo,
    admin_update_estudiante,
    admin_update_prorroga_titulo,
)
from apps.estudiantes.api.regularidades_carga import (
    gestionar_regularidad_cierre,
    guardar_planilla_regularidad,
    listar_comisiones,
    obtener_docentes_defecto_endpoint,
    obtener_planilla_regularidad,
)
from apps.estudiantes.gestion_comisiones_api import (
    CrearComisionIn,
    CrearComisionMasivaIn,
    DistribuirEstudiantesIn,
    MoverEstudiantesIn,
    crear_comision,
    crear_comision_masiva,
    distribuir_estudiantes,
    listar_comisiones_gestion,
    mover_estudiantes,
)
from apps.estudiantes.schemas import EstudianteAdminUpdateIn, ProrrogaTituloIn, RegularidadCargaIn, RegularidadCierreIn
from core.models import (
    Comision,
    Docente,
    Estudiante,
    EstudianteCarrera,
    InscripcionMateriaEstudiante,
    Materia,
    Persona,
    PlanDeEstudio,
    Profesorado,
    ProrrogaTituloSecundario,
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


@pytest.fixture
def base_security_setup():
    # Roles / Grupos
    g_bedel, _ = Group.objects.get_or_create(name="bedel")
    g_secretaria, _ = Group.objects.get_or_create(name="secretaria")
    g_docente, _ = Group.objects.get_or_create(name="docente")

    # Carreras
    carrera_a = Profesorado.objects.create(nombre="Profesorado de Inglés", duracion_anios=4)
    carrera_b = Profesorado.objects.create(nombre="Profesorado de Primaria", duracion_anios=4)

    # Planes
    plan_a = PlanDeEstudio.objects.create(profesorado=carrera_a, resolucion="RES-ING-2020", anio_inicio=2020, vigente=True)
    plan_b = PlanDeEstudio.objects.create(profesorado=carrera_b, resolucion="RES-PRI-2020", anio_inicio=2020, vigente=True)

    # Materias
    mat_a = Materia.objects.create(
        plan_de_estudio=plan_a,
        nombre="Gramática I",
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
    )
    mat_b = Materia.objects.create(
        plan_de_estudio=plan_b,
        nombre="Pedagogía",
        anio_cursada=1,
        formato=Materia.FormatoMateria.ASIGNATURA,
        regimen=Materia.TipoCursada.ANUAL,
    )

    # Turno
    turno = Turno.objects.create(nombre="Vespertino")

    # Bedel asignado SOLO a Carrera A
    user_bedel = User.objects.create_user(username="bedel_a", email="bedel_a@ipes.edu.ar")
    user_bedel.groups.add(g_bedel)
    StaffAsignacion.objects.create(user=user_bedel, profesorado=carrera_a, rol=StaffAsignacion.Rol.BEDEL)

    # Secretaria (global)
    user_sec = User.objects.create_user(username="secretaria_gral", email="sec@ipes.edu.ar")
    user_sec.groups.add(g_secretaria)

    # Docente A (asignado a cátedra en Mat A)
    p_doc_a = Persona.objects.create(dni="30111222", nombre="Docente", apellido="Alfaro", email="doc_a@ipes.edu.ar")
    user_doc_a = User.objects.create_user(username="30111222", email="doc_a@ipes.edu.ar")
    user_doc_a.groups.add(g_docente)
    doc_perfil_a = Docente.objects.create(persona=p_doc_a)
    UserProfile.objects.create(user=user_doc_a, persona=p_doc_a)

    # Docente B (sin cátedras en Mat A)
    p_doc_b = Persona.objects.create(dni="30333444", nombre="Docente", apellido="Bravo", email="doc_b@ipes.edu.ar")
    user_doc_b = User.objects.create_user(username="30333444", email="doc_b@ipes.edu.ar")
    user_doc_b.groups.add(g_docente)
    Docente.objects.create(persona=p_doc_b)
    UserProfile.objects.create(user=user_doc_b, persona=p_doc_b)

    # Comisiones
    com_a = Comision.objects.create(
        materia=mat_a, anio_lectivo=2026, codigo="A", turno=turno, docente=doc_perfil_a, estado=Comision.Estado.ABIERTA
    )
    com_b = Comision.objects.create(
        materia=mat_b, anio_lectivo=2026, codigo="A", turno=turno, estado=Comision.Estado.ABIERTA
    )

    # Estudiante A (sólo en Carrera A)
    p_est_a = Persona.objects.create(dni="45000001", nombre="Alumno", apellido="Uno", email="a1@ipes.edu.ar")
    u_est_a = User.objects.create_user(username="45000001", email="a1@ipes.edu.ar")
    est_a = Estudiante.objects.create(user=u_est_a, persona=p_est_a)
    EstudianteCarrera.objects.create(estudiante=est_a, profesorado=carrera_a, anio_ingreso=2025)

    # Estudiante B (sólo en Carrera B)
    p_est_b = Persona.objects.create(dni="45000002", nombre="Alumno", apellido="Dos", email="a2@ipes.edu.ar")
    u_est_b = User.objects.create_user(username="45000002", email="a2@ipes.edu.ar")
    est_b = Estudiante.objects.create(user=u_est_b, persona=p_est_b)
    EstudianteCarrera.objects.create(estudiante=est_b, profesorado=carrera_b, anio_ingreso=2025)

    return {
        "carrera_a": carrera_a,
        "carrera_b": carrera_b,
        "plan_a": plan_a,
        "plan_b": plan_b,
        "mat_a": mat_a,
        "mat_b": mat_b,
        "com_a": com_a,
        "com_b": com_b,
        "bedel_a": user_bedel,
        "sec": user_sec,
        "doc_a": user_doc_a,
        "doc_b": user_doc_b,
        "est_a": est_a,
        "est_b": est_b,
        "turno": turno,
    }


# ==============================================================================
# F06: Control de Alcance por Carrera en Gestión de Comisiones
# ==============================================================================


def test_f06_bedel_cannot_manage_comisiones_other_career(base_security_setup):
    """Un bedel de Carrera A no puede listar, crear o mover comisiones de Carrera B."""
    data = base_security_setup
    req = DummyRequest(user=data["bedel_a"])

    # 1. No puede listar comisiones de materia de Carrera B
    with pytest.raises(AppError) as exc_info:
        listar_comisiones_gestion(req, materia_id=data["mat_b"].id, anio_lectivo=2026)
    assert exc_info.value.status_code == 403

    # 2. No puede crear comisión en materia de Carrera B
    with pytest.raises(AppError) as exc_info:
        crear_comision(
            req,
            payload=CrearComisionIn(materia_id=data["mat_b"].id, anio_lectivo=2026, codigo="B", turno_id=data["turno"].id),
        )
    assert exc_info.value.status_code == 403

    # 3. No puede crear comisiones masivas en plan de Carrera B
    with pytest.raises(AppError) as exc_info:
        crear_comision_masiva(
            req,
            payload=CrearComisionMasivaIn(plan_id=data["plan_b"].id, anio_cursada=1, anio_lectivo=2026, codigo="B"),
        )
    assert exc_info.value.status_code == 403

    # 4. No puede distribuir ni mover comisiones de Carrera B
    with pytest.raises(AppError) as exc_info:
        distribuir_estudiantes(
            req,
            payload=DistribuirEstudiantesIn(
                comision_origen_id=data["com_b"].id, comision_destino_id=data["com_b"].id, porcentaje=50
            ),
        )
    assert exc_info.value.status_code == 403


def test_f06_bedel_can_manage_assigned_career_comisiones(base_security_setup):
    """Un bedel puede gestionar comisiones en su carrera asignada."""
    data = base_security_setup
    req = DummyRequest(user=data["bedel_a"])

    # Listar
    res = listar_comisiones_gestion(req, materia_id=data["mat_a"].id, anio_lectivo=2026)
    assert len(res) == 1
    assert res[0].codigo == "A"

    # Crear comisión en su carrera
    resp = crear_comision(
        req,
        payload=CrearComisionIn(materia_id=data["mat_a"].id, anio_lectivo=2026, codigo="C", turno_id=data["turno"].id),
    )
    assert resp.ok is True


# ==============================================================================
# F07: Regularidades (Territorialidad y Titularidad Docente)
# ==============================================================================


def test_f07_bedel_cannot_access_or_save_regularidades_other_career(base_security_setup):
    """Un bedel de Carrera A no puede listar, ver, guardar ni cerrar regularidades de Carrera B."""
    data = base_security_setup
    req = DummyRequest(user=data["bedel_a"])

    # 1. Listar comisiones de plan ajeno
    with pytest.raises(AppError) as exc_info:
        listar_comisiones(req, plan_id=data["plan_b"].id)
    assert exc_info.value.status_code == 403

    # 2. Ver planilla de comisión ajena
    with pytest.raises(AppError) as exc_info:
        obtener_planilla_regularidad(req, comision_id=data["com_b"].id)
    assert exc_info.value.status_code == 403

    # 3. Guardar notas en comisión ajena
    payload_carga = RegularidadCargaIn(
        comision_id=data["com_b"].id,
        materia_id=data["mat_b"].id,
        fecha_cierre=date.today(),
        estudiantes=[],
    )
    with pytest.raises(AppError) as exc_info:
        guardar_planilla_regularidad(req, payload=payload_carga)
    assert exc_info.value.status_code == 403

    # 4. Cerrar planilla ajena
    payload_cierre = RegularidadCierreIn(comision_id=data["com_b"].id, accion="cerrar")
    with pytest.raises(AppError) as exc_info:
        gestionar_regularidad_cierre(req, payload=payload_cierre)
    assert exc_info.value.status_code == 403

    # 5. Consultar docentes por defecto de profesorado ajeno
    with pytest.raises(AppError) as exc_info:
        obtener_docentes_defecto_endpoint(req, materia_id=data["mat_b"].id, profesorado_id=data["carrera_b"].id)
    assert exc_info.value.status_code == 403


def test_f07_docente_unassigned_cannot_access_regularidades(base_security_setup):
    """Un docente sin asignación en una cátedra no puede ver ni modificar su planilla de regularidad."""
    data = base_security_setup
    req = DummyRequest(user=data["doc_b"])  # Docente B no está en Com A

    status, resp = obtener_planilla_regularidad(req, comision_id=data["com_a"].id)
    assert status == 403

    payload_carga = RegularidadCargaIn(
        comision_id=data["com_a"].id,
        materia_id=data["mat_a"].id,
        fecha_cierre=date.today(),
        estudiantes=[],
    )
    status, resp = guardar_planilla_regularidad(req, payload=payload_carga)
    assert status == 403


def test_f07_docente_assigned_can_view_and_save_regularidades(base_security_setup):
    """El docente titular asignado puede ver y guardar su propia planilla de regularidad."""
    data = base_security_setup
    req = DummyRequest(user=data["doc_a"])  # Docente A asignado en Com A

    res = obtener_planilla_regularidad(req, comision_id=data["com_a"].id)
    assert res.comision_codigo == "A"
    assert res.materia_id == data["mat_a"].id

    payload_carga = RegularidadCargaIn(
        comision_id=data["com_a"].id,
        materia_id=data["mat_a"].id,
        fecha_cierre=date.today(),
        estudiantes=[],
    )
    resp = guardar_planilla_regularidad(req, payload=payload_carga)
    assert resp.ok is True


# ==============================================================================
# F08: Restricción Territorial en Legajos de Estudiantes
# ==============================================================================


def test_f08_bedel_cannot_view_or_modify_student_of_other_career(base_security_setup):
    """Un bedel de Carrera A no puede ver, editar, borrar ni gestionar prórrogas de un alumno de Carrera B."""
    data = base_security_setup
    req = DummyRequest(user=data["bedel_a"])
    dni_b = data["est_b"].persona.dni

    # 1. Consulta de legajo (GET)
    with pytest.raises(AppError) as exc_info:
        admin_get_estudiante(req, dni=dni_b)
    assert exc_info.value.status_code == 403

    # 2. Edición de datos (PUT)
    with pytest.raises(AppError) as exc_info:
        admin_update_estudiante(req, dni=dni_b, payload=EstudianteAdminUpdateIn(telefono="999999"))
    assert exc_info.value.status_code == 403

    # 3. Baja de legajo (DELETE)
    with pytest.raises(AppError) as exc_info:
        admin_delete_estudiante(req, dni=dni_b)
    assert exc_info.value.status_code == 403

    # 4. Prórrogas de título (GET y POST)
    with pytest.raises(AppError) as exc_info:
        admin_list_prorrogas_titulo(req, dni=dni_b)
    assert exc_info.value.status_code == 403

    with pytest.raises(AppError) as exc_info:
        admin_create_prorroga_titulo(
            req,
            dni=dni_b,
            payload=ProrrogaTituloIn(fecha_otorgada="2026-03-01", fecha_vencimiento="2026-06-01", observaciones="Test"),
        )
    assert exc_info.value.status_code == 403


def test_f08_bedel_can_view_student_in_assigned_career(base_security_setup):
    """Un bedel puede consultar el legajo de un estudiante perteneciente a su carrera asignada."""
    data = base_security_setup
    req = DummyRequest(user=data["bedel_a"])
    dni_a = data["est_a"].persona.dni

    status, detail = admin_get_estudiante(req, dni=dni_a)
    assert status == 200
    assert detail.dni == dni_a


def test_f08_admin_and_secretaria_have_global_student_access(base_security_setup):
    """Administración y Secretaría General mantienen acceso sin restricción de carrera."""
    data = base_security_setup
    req = DummyRequest(user=data["sec"])

    # Puede ver estudiante de Carrera A y de Carrera B
    status_a, detail_a = admin_get_estudiante(req, dni=data["est_a"].persona.dni)
    status_b, detail_b = admin_get_estudiante(req, dni=data["est_b"].persona.dni)

    assert status_a == 200
    assert detail_a.dni == data["est_a"].persona.dni
    assert status_b == 200
    assert detail_b.dni == data["est_b"].persona.dni
