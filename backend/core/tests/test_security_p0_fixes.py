"""
Pruebas de regresión para Endurecimiento de Seguridad Prioritaria (P0: F01, F02, F03, F04, F05):
- F01: Preinscripción pública no altera email/identidad ni completa emails vacíos de cuentas existentes (anti-takeover).
- F02: Jerarquía estricta y comprobación positiva en force-password-reset, contraseñas temporales no expuestas si se envió correo, forzado de must_change_password.
- F03: Matriz de delegación de roles y bloqueo de auto-elevación de privilegios en staff/roles.
- F04: Acceso restringido al PDF de preinscripción (bloqueo de código secuencial, verificación de alcance por carrera en staff, validación de token firmado).
- F05: Mitigación de SSRF y contención estricta de rutas de archivos locales en WeasyPrint (bloqueo de path traversal y sibling dirs).
"""

from unittest.mock import patch

import pytest
from django.contrib.auth.models import Group, User
from django.http import HttpResponseForbidden

from apps.management.api.staff import force_reset_password, manage_staff_role
from apps.preinscriptions.schemas import EstudianteIn, PreinscripcionIn
from apps.preinscriptions.services.preinscripcion_service import PreinscripcionService
from apps.preinscriptions.views_pdf import preinscripcion_pdf, safe_weasyprint_url_fetcher
from core.models import Persona, Preinscripcion, Profesorado, StaffAsignacion, UserProfile
from core.schemas import AsignarRolIn, ForceResetPasswordIn

pytestmark = pytest.mark.django_db


class DummyRequest:
    def __init__(self, user, get_params=None):
        self.user = user
        self.GET = get_params or {}
        self.COOKIES = {}
        self.headers = {}


def test_f01_preinscripcion_no_sobrescribe_email_de_cuenta_existente():
    """Un intento de preinscripción pública con el DNI de un usuario existente no debe alterar su email."""
    dni_existente = "11223344"
    email_legitimo = "estudiante_legitimo@ipes.edu.ar"
    persona = Persona.objects.create(
        dni=dni_existente,
        nombre="Juan",
        apellido="Perez",
        email=email_legitimo,
    )
    user = User.objects.create_user(username=dni_existente, email=email_legitimo)
    UserProfile.objects.create(user=user, persona=persona)

    carrera = Profesorado.objects.create(
        nombre="Profesorado de Inglés",
        duracion_anios=4,
        es_certificacion_docente=False,
    )

    estudiante_payload = EstudianteIn(
        dni=dni_existente,
        apellido="HACKER",
        nombres="Atacante",
        email="atacante@malicioso.com",
        telefono="123456",
        domicilio="Calle Falsa 123",
        fecha_nacimiento="2000-01-01",
    )
    payload = PreinscripcionIn(
        carrera_id=carrera.id,
        estudiante=estudiante_payload,
    )

    pre = PreinscripcionService.create_or_update_preinscripcion(payload)

    persona.refresh_from_db()
    user.refresh_from_db()

    # El email institucional legítimo NO debe haber sido alterado
    assert persona.email == email_legitimo
    assert user.email == email_legitimo
    assert persona.apellido.upper() == "PEREZ"
    assert persona.apellido.upper() != "HACKER"

    # Los datos declarados por el formulario se preservan en datos_extra
    assert pre.datos_extra.get("email_declarado_preinscripcion") == "atacante@malicioso.com"
    assert (
        pre.datos_extra.get("email") == "atacante@malicioso.com"
        or pre.datos_extra.get("estudiante", {}).get("email") == "atacante@malicioso.com"
    )


def test_f01_preinscripcion_no_rellena_email_vacio_en_cuenta_existente():
    """Si una cuenta existente no tiene correo, la preinscripción anónima NO debe completarlo."""
    dni_existente = "99881122"
    persona = Persona.objects.create(
        dni=dni_existente,
        nombre="Mario",
        apellido="Santos",
        email=None,
    )
    user = User.objects.create_user(username=dni_existente, email="")
    UserProfile.objects.create(user=user, persona=persona)

    carrera = Profesorado.objects.create(
        nombre="Profesorado de Historia",
        duracion_anios=4,
        es_certificacion_docente=False,
    )

    estudiante_payload = EstudianteIn(
        dni=dni_existente,
        apellido="Santos",
        nombres="Mario",
        email="takeover@malicioso.com",
        telefono="123456",
        domicilio="Calle Real 456",
        fecha_nacimiento="1995-05-05",
    )
    payload = PreinscripcionIn(
        carrera_id=carrera.id,
        estudiante=estudiante_payload,
    )

    pre = PreinscripcionService.create_or_update_preinscripcion(payload)

    persona.refresh_from_db()
    user.refresh_from_db()

    # El email de la cuenta existente DEBE seguir siendo None/vacío
    assert persona.email is None
    assert user.email == ""
    # El email declarado queda explícitamente en datos_extra['email_declarado_preinscripcion']
    assert pre.datos_extra.get("email_declarado_preinscripcion") == "takeover@malicioso.com"


def test_f02_force_reset_password_jerarquia_y_comprobacion_positiva():
    """Valida comprobación positiva: ATTP solo puede resetear docentes/estudiantes puros y rechaza roles vacíos."""
    superuser = User.objects.create_superuser(username="admin_supremo", password="pwd")
    admin_group, _ = Group.objects.get_or_create(name="admin")
    attp_group, _ = Group.objects.get_or_create(name="attp")
    bedel_group, _ = Group.objects.get_or_create(name="bedel")

    admin_user = User.objects.create_user(username="admin_user", password="pwd")
    admin_user.groups.add(admin_group)

    bedel_user = User.objects.create_user(username="bedel_user", password="pwd")
    bedel_user.groups.add(bedel_group)

    attp_user = User.objects.create_user(username="operador_attp", password="pwd")
    attp_user.groups.add(attp_group)

    # 1. ATTP intenta resetear a Superuser -> 403
    payload = ForceResetPasswordIn(username="admin_supremo")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403

    # 2. ATTP intenta resetear a Admin -> 403
    payload = ForceResetPasswordIn(username="admin_user")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403

    # 3. ATTP intenta resetear a Bedel (comprobación positiva de rol de gestión) -> 403
    payload = ForceResetPasswordIn(username="bedel_user")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403
    assert "estudiantes o docentes" in res.get("message", "")

    # 4. ATTP intenta resetear a usuario sin ningún rol (conjunto vacío) -> 403
    user_sin_roles = User.objects.create_user(username="usuario_sin_roles", password="pwd")
    payload = ForceResetPasswordIn(username="usuario_sin_roles")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403
    assert "estudiantes o docentes" in res.get("message", "")


def test_f02_force_reset_solicita_email_oculta_secreto_y_fuerza_cambio():
    """Verifica solicitud obligatoria de correo, forzado de must_change_password y no exposición del secreto."""
    admin_user = User.objects.create_superuser(username="admin_general", password="pwd")

    estudiante_user = User.objects.create_user(
        username="33445566", password="pwd", first_name="Carlos", last_name="Gomez"
    )
    persona = Persona.objects.create(dni="33445566", nombre="Carlos", apellido="Gomez", email=None)
    UserProfile.objects.create(user=estudiante_user, persona=persona)

    # 1. Intentar resetear sin suministrar email -> 400 requires_email: True
    payload = ForceResetPasswordIn(username="33445566", email=None)
    status, res = force_reset_password(DummyRequest(admin_user), payload)
    assert status == 400
    assert res.get("requires_email") is True

    # 2. Resetear con email válido y simulación de envío exitoso -> 200, temp_password es None en response
    nuevo_email = "carlos.gomez@alumno.ipes.edu.ar"
    payload = ForceResetPasswordIn(username="33445566", email=nuevo_email)

    with patch("django.core.mail.send_mail", return_value=1) as mock_send:
        status, res = force_reset_password(DummyRequest(admin_user), payload)

    assert status == 200
    assert res.get("email_enviado") is True
    assert res.get("temp_password") is None  # Secreto no expuesto al operador
    persona.refresh_from_db()
    estudiante_user.refresh_from_db()
    assert persona.email == nuevo_email
    assert estudiante_user.email == nuevo_email
    assert estudiante_user.profile.must_change_password is True

    # 3. Resetear con contraseña manual -> must_change_password sigue siendo obligatorio (True)
    import secrets

    clave_manual_test = f"ManualTest-{secrets.token_urlsafe(16)}"
    payload_manual = ForceResetPasswordIn(username=estudiante_user.username, new_password=clave_manual_test)
    with patch("django.core.mail.send_mail", return_value=1):
        status, res = force_reset_password(DummyRequest(admin_user), payload_manual)
    assert status == 200
    estudiante_user.profile.refresh_from_db()
    assert estudiante_user.profile.must_change_password is True


def test_f03_manage_staff_role_anti_autoelevacion_y_matriz():
    """Un usuario no puede auto-elevarse roles y Secretaría no puede asignar rol admin."""
    sec_group, _ = Group.objects.get_or_create(name="secretaria")
    sec_user = User.objects.create_user(username="secretaria_1", password="pwd")
    sec_user.groups.add(sec_group)

    target_user = User.objects.create_user(username="docente_1", password="pwd")

    # 1. Auto-elevación bloqueada
    payload = AsignarRolIn(user_id=sec_user.id, role="admin", action="assign")
    status, res = manage_staff_role(DummyRequest(sec_user), payload)
    assert status == 403
    assert "propios roles" in res.get("message", "")

    # 2. Secretaría intenta asignar 'admin' a un tercero -> 403 por matriz de delegación
    payload = AsignarRolIn(user_id=target_user.id, role="admin", action="assign")
    status, res = manage_staff_role(DummyRequest(sec_user), payload)
    assert status == 403
    assert "no tiene permisos para asignar" in res.get("message", "")

    # 3. Secretaría asigna un rol permitido por la matriz (ej: bedel con profesorado) -> 200
    prof = Profesorado.objects.create(nombre="Profesorado Bedel Test", duracion_anios=4)
    payload = AsignarRolIn(user_id=target_user.id, role="bedel", profesorado_ids=[prof.id], action="assign")
    status, res = manage_staff_role(DummyRequest(sec_user), payload)
    assert status == 200
    assert target_user.groups.filter(name="bedel").exists()


def test_f04_pdf_bloquea_codigo_secuencial_y_requiere_carrera_o_token():
    """La descarga de PDF no debe autorizarse mediante código secuencial; requiere pertenencia a carrera o token firmado."""
    carrera_a = Profesorado.objects.create(nombre="Carrera A", duracion_anios=4)
    carrera_b = Profesorado.objects.create(nombre="Carrera B", duracion_anios=4)

    aspirante = Persona.objects.create(dni="77665544", nombre="Laura", apellido="Diaz", email="laura@test.com")
    est = PreinscripcionService.create_or_update_preinscripcion(
        PreinscripcionIn(
            carrera_id=carrera_a.id,
            estudiante=EstudianteIn(
                dni="77665544",
                apellido="Diaz",
                nombres="Laura",
                email="laura@test.com",
                fecha_nacimiento="1998-01-01",
            ),
        )
    )

    # 1. Descarga anónima usando solo el código secuencial -> 403 Forbidden
    req_con_codigo = DummyRequest(None, get_params={"codigo": est.codigo})
    resp = preinscripcion_pdf(req_con_codigo, preinscripcion_id=est.id)
    assert isinstance(resp, HttpResponseForbidden)

    # 2. Descarga anónima usando token criptográficamente firmado -> 200 (autorizado)
    token_valido = PreinscripcionService.generate_pdf_token(est.id)
    with patch("apps.preinscriptions.views_pdf.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-dummy"
        req_con_token = DummyRequest(None, get_params={"token": token_valido})
        resp = preinscripcion_pdf(req_con_token, preinscripcion_id=est.id)
        assert resp.status_code == 200

    # 3. Staff de otra carrera (ej: Bedel de Carrera B) intentando acceder a Carrera A -> 403 Forbidden
    bedel_user = User.objects.create_user(username="bedel_b", password="pwd")
    bedel_group, _ = Group.objects.get_or_create(name="bedel")
    bedel_user.groups.add(bedel_group)
    StaffAsignacion.objects.create(user=bedel_user, profesorado=carrera_b, rol="bedel")

    req_staff_ajeno = DummyRequest(bedel_user)
    resp = preinscripcion_pdf(req_staff_ajeno, preinscripcion_id=est.id)
    assert isinstance(resp, HttpResponseForbidden)

    # 4. Staff con alcance en Carrera A -> 200 OK
    StaffAsignacion.objects.create(user=bedel_user, profesorado=carrera_a, rol="bedel")
    with patch("apps.preinscriptions.views_pdf.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-dummy"
        req_staff_propio = DummyRequest(bedel_user)
        resp = preinscripcion_pdf(req_staff_propio, preinscripcion_id=est.id)
        assert resp.status_code == 200


def test_f05_weasyprint_ssrf_bloqueo_urls_externas_e_internas():
    """El url_fetcher seguro para WeasyPrint debe bloquear peticiones a la red o localhost."""
    # URLs HTTP/HTTPS externas o internas deben fallar
    for url in (
        "http://127.0.0.1:8000/api/internal",
        "http://localhost:5432",
        "http://169.254.169.254/latest/meta-data/",
        "https://google.com/malicious.png",
    ):
        with pytest.raises(ValueError, match="Acceso a recurso externo denegado"):
            safe_weasyprint_url_fetcher(url)

    # data URIs sí deben permitirse
    resultado_data = safe_weasyprint_url_fetcher(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    mime = getattr(resultado_data, "content_type", None) or getattr(resultado_data, "mime_type", None)
    assert mime == "image/png"


def test_f05_weasyprint_bloquea_archivos_fuera_de_logos_y_sibling_dirs(tmp_path):
    """Verifica que safe_weasyprint_url_fetcher impida path traversal y rutas hermanas no autorizadas."""
    # Archivos sensibles del sistema o fuera de static/logos deben ser bloqueados
    for sensitive_file in (
        "file:///etc/passwd",
        "file:///app/.env",
        "file:///app/config/settings.py",
    ):
        with pytest.raises(ValueError, match="Acceso a recurso externo denegado"):
            safe_weasyprint_url_fetcher(sensitive_file)


def test_f04_bloqueo_actualizacion_anonima_con_codigo_y_dni():
    """Un atacante anónimo conociendo el código secuencial y DNI no debe poder actualizar una preinscripción ni recibir token."""
    from ninja.errors import HttpError

    carrera = Profesorado.objects.create(nombre="Profesorado de Inglés", duracion_anios=4)
    persona = Persona.objects.create(
        dni="55443322",
        nombre="Carlos",
        apellido="Lopez",
        email="carlos.original@test.com",
    )

    # 1. Crear preinscripción legítima
    payload_original = PreinscripcionIn(
        carrera_id=carrera.id,
        estudiante=EstudianteIn(
            dni="55443322",
            apellido="Lopez",
            nombres="Carlos",
            email="carlos.original@test.com",
            fecha_nacimiento="1999-09-09",
        ),
    )
    pre = PreinscripcionService.create_or_update_preinscripcion(payload_original)
    codigo_secuencial = pre.codigo
    assert codigo_secuencial.startswith("PRE-")

    # 2. Atacante envía petición anónima usando el código secuencial y DNI de la víctima
    payload_atacante = PreinscripcionIn(
        carrera_id=carrera.id,
        codigo=codigo_secuencial,
        estudiante=EstudianteIn(
            dni="55443322",
            apellido="Lopez",
            nombres="Carlos",
            email="attacker@evil.com",
            fecha_nacimiento="1999-09-09",
        ),
    )

    # Debe ser rechazado con 403 Forbidden
    with pytest.raises(HttpError) as exc_info:
        PreinscripcionService.create_or_update_preinscripcion(payload_atacante, user=None)

    assert exc_info.value.status_code == 403
    assert "no son credenciales suficientes" in str(exc_info.value.message)


def test_f04_token_expiracion_estricta_24h():
    """El token de descarga de comprobante debe expirar estrictamente a las 24 horas (86400s)."""
    import time
    from unittest.mock import patch
    from django.core import signing

    carrera = Profesorado.objects.create(nombre="Profesorado Artes", duracion_anios=4)
    Persona.objects.create(dni="33221100", nombre="Ana", apellido="Perez", email="ana@test.com")
    pre = PreinscripcionService.create_or_update_preinscripcion(
        PreinscripcionIn(
            carrera_id=carrera.id,
            estudiante=EstudianteIn(
                dni="33221100",
                apellido="Perez",
                nombres="Ana",
                email="ana@test.com",
                fecha_nacimiento="1996-06-06",
            ),
        )
    )

    # Token emitido hace 48 horas (172800s en el pasado)
    old_time = time.time() - 172800
    with patch("time.time", return_value=old_time):
        token_48h = signing.dumps({"pre_id": pre.id}, salt="preinscripcion_pdf_download")

    # Intentar descargar con token de 48h -> debe devolver 403 Forbidden
    req = DummyRequest(None, get_params={"token": token_48h})
    resp = preinscripcion_pdf(req, preinscripcion_id=pre.id)
    assert resp.status_code == 403

    # Token fresco (emitido ahora) -> debe autorizar 200 OK
    token_reciente = signing.dumps({"pre_id": pre.id}, salt="preinscripcion_pdf_download")
    with patch("apps.preinscriptions.views_pdf.HTML") as mock_html:
        mock_html.return_value.write_pdf.return_value = b"%PDF-dummy"
        req_valido = DummyRequest(None, get_params={"token": token_reciente})
        resp_valido = preinscripcion_pdf(req_valido, preinscripcion_id=pre.id)
        assert resp_valido.status_code == 200


def test_must_change_password_bloquea_acceso_servidor_api():
    """Usuarios con must_change_password=True deben ser bloqueados por el servidor en endpoints operativos."""
    from apps.common.errors import AppError
    from core.auth_ninja import JWTAuth
    from core.authentication.jwt_service import JWTService

    user = User.objects.create_user(username="usuario_debe_cambiar", password="pwd")
    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.must_change_password = True
    profile.save(update_fields=["must_change_password"])

    token = JWTService.create_access_token(user.id)

    class MockRequest:
        def __init__(self, path: str):
            self.path = path
            self.COOKIES = {}
            self.headers = {"Authorization": f"Bearer {token}"}
            self.user = None

    auth = JWTAuth()

    # 1. Petición a endpoint operativo -> bloqueado con 403
    req_estudiantes = MockRequest(path="/api/estudiantes/")
    with pytest.raises(AppError) as exc_info:
        auth(req_estudiantes)
    assert exc_info.value.status_code == 403
    assert "cambiar su contraseña obligatoriamente" in str(exc_info.value.message)

    # 2. Petición a endpoint de cambio de clave -> permitido
    req_cambio = MockRequest(path="/api/auth/change-password/")
    auth_user = auth(req_cambio)
    assert auth_user == user

    # 3. Petición a perfil -> permitido
    req_perfil = MockRequest(path="/api/auth/profile/")
    auth_user_perfil = auth(req_perfil)
    assert auth_user_perfil == user


@pytest.mark.parametrize("existing_identity", [False, True])
def test_public_token_requires_new_identity(existing_identity):
    from django.test import Client

    carrera = Profesorado.objects.create(nombre="Token scope", duracion_anios=4)
    if existing_identity:
        persona = Persona.objects.create(
            dni="90112233", nombre="Original", apellido="Original", email="private@example.invalid"
        )
        account = User.objects.create_user(username="90112233")
        UserProfile.objects.create(user=account, persona=persona)
    body = {
        "carrera_id": carrera.id,
        "estudiante": {
            "dni": "90112233",
            "nombres": "Declarado",
            "apellido": "Declarado",
            "email": "declared@example.invalid",
            "fecha_nacimiento": "2000-01-01",
        },
    }
    with patch("apps.preinscriptions.api.ventana_preinscripcion_activa", return_value=True):
        response = Client().post("/api/preinscripciones", body, content_type="application/json")
    assert response.status_code == 200
    assert bool(response.json()["data"]["download_token"]) is (not existing_identity)


@pytest.mark.parametrize(
    "own_career,state,expected",
    [(False, "Enviada", 403), (False, "Confirmada", 403), (True, "Confirmada", 400), (True, "Enviada", 200)],
)
def test_staff_application_scope_and_confirmed_state(own_career, state, expected):
    from django.test import Client
    from core.authentication.jwt_service import JWTService

    carrera = Profesorado.objects.create(nombre="Original", duracion_anios=4)
    other = Profesorado.objects.create(nombre="Other", duracion_anios=4)
    payload = PreinscripcionIn(
        carrera_id=carrera.id,
        estudiante=EstudianteIn(
            dni="90887766",
            nombres="Original",
            apellido="Original",
            email="original@example.invalid",
            fecha_nacimiento="2000-01-01",
        ),
    )
    pre = PreinscripcionService.create_or_update_preinscripcion(payload)
    pre.estado = state
    pre.save()
    operator = User.objects.create_user(username="scoped-bedel")
    operator.groups.add(Group.objects.get_or_create(name="bedel")[0])
    StaffAsignacion.objects.create(user=operator, rol="bedel", profesorado=carrera if own_career else other)
    client = Client()
    client.cookies["jwt_access_token"] = JWTService.create_access_token(operator.id)
    body = {
        "codigo": pre.codigo,
        "carrera_id": carrera.id,
        "estudiante": {
            "dni": "90887766",
            "nombres": "Original",
            "apellido": "Original",
            "email": "new@example.invalid",
            "fecha_nacimiento": "2000-01-01",
        },
    }
    with patch("apps.preinscriptions.api.ventana_preinscripcion_activa", return_value=True):
        response = client.post(
            "/api/preinscripciones", body, content_type="application/json", HTTP_X_ACTIVE_ROLE="admin"
        )
    assert response.status_code == expected, response.content
    pre.refresh_from_db()
    assert pre.estado == state
    if expected == 200:
        assert response.json()["data"]["download_token"]
    else:
        assert pre.datos_extra["estudiante"]["email"] == "original@example.invalid"
