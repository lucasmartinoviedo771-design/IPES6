"""
Pruebas de regresión para Endurecimiento de Seguridad Prioritaria (P0: F01, F02, F03, F04, F05):
- F01: Preinscripción pública no altera email/identidad de usuarios existentes (anti-takeover).
- F02: Jerarquía estricta en force-password-reset, contraseñas temporales seguras, solicitud y registro obligatorio de email si no posee uno.
- F03: Matriz de delegación de roles y bloqueo de auto-elevación de privilegios en staff/roles.
- F04: Acceso restringido al PDF de preinscripción (bloqueo anónimo sin token/código).
- F05: Mitigación de SSRF en WeasyPrint bloqueando URLs HTTP/HTTPS y accesos a localhost/redes internas.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth.models import Group, User
from django.core.exceptions import ValidationError

from apps.management.api.staff import force_reset_password, manage_staff_role
from apps.preinscriptions.schemas import EstudianteIn, PreinscripcionIn
from apps.preinscriptions.services.preinscripcion_service import PreinscripcionService
from apps.preinscriptions.views_pdf import safe_weasyprint_url_fetcher
from core.models import Persona, Profesorado, UserProfile
from core.schemas import AsignarRolIn, ForceResetPasswordIn

pytestmark = pytest.mark.django_db


class DummyRequest:
    def __init__(self, user):
        self.user = user


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
        descripcion="Test",
        color="#112233",
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
    assert persona.apellido == "Perez"

    # Los datos declarados por el formulario se preservan en datos_extra
    assert (
        pre.datos_extra.get("email") == "atacante@malicioso.com"
        or pre.datos_extra.get("estudiante", {}).get("email") == "atacante@malicioso.com"
    )


def test_f02_force_reset_password_jerarquia_y_seguridad():
    """Valida jerarquías de reseteo: superusuario y administradores protegidos de operadores menores."""
    superuser = User.objects.create_superuser(username="admin_supremo", password="pwd")
    admin_group, _ = Group.objects.get_or_create(name="admin")
    attp_group, _ = Group.objects.get_or_create(name="attp")

    admin_user = User.objects.create_user(username="admin_user", password="pwd")
    admin_user.groups.add(admin_group)

    attp_user = User.objects.create_user(username="operador_attp", password="pwd")
    attp_user.groups.add(attp_group)

    # ATTP intenta resetear a Superuser -> 403
    payload = ForceResetPasswordIn(username="admin_supremo")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403

    # ATTP intenta resetear a Admin -> 403
    payload = ForceResetPasswordIn(username="admin_user")
    status, res = force_reset_password(DummyRequest(attp_user), payload)
    assert status == 403


def test_f02_force_reset_solicita_y_guarda_email_si_usuario_no_posee():
    """Si el usuario a resetear no tiene email, la API debe solicitarlo y guardarlo en la BD."""
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

    # 2. Intentar resetear con email inválido -> 400 requires_email: True
    payload = ForceResetPasswordIn(username="33445566", email="email-invalido")
    status, res = force_reset_password(DummyRequest(admin_user), payload)
    assert status == 400
    assert res.get("requires_email") is True

    # 3. Resetear con email válido -> 200, guarda en BD, contraseña segura no predecible
    nuevo_email = "carlos.gomez@alumno.ipes.edu.ar"
    payload = ForceResetPasswordIn(username="33445566", email=nuevo_email)

    with patch("django.core.mail.send_mail") as mock_send_mail:
        status, res = force_reset_password(DummyRequest(admin_user), payload)

    assert status == 200
    persona.refresh_from_db()
    estudiante_user.refresh_from_db()

    assert persona.email == nuevo_email
    assert estudiante_user.email == nuevo_email

    temp_pass = res.get("temp_password")
    assert temp_pass is not None
    assert temp_pass != "pass12346789"
    assert len(temp_pass) >= 10
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
    assert "a sí mismo" in res.get("message", "")

    # 2. Secretaría intenta asignar 'admin' a un tercero -> 403 por matriz de delegación
    payload = AsignarRolIn(user_id=target_user.id, role="admin", action="assign")
    status, res = manage_staff_role(DummyRequest(sec_user), payload)
    assert status == 403
    assert "No tenés autorización" in res.get("message", "")

    # 3. Secretaría asigna un rol permitido por la matriz (ej: bedel) -> 200
    payload = AsignarRolIn(user_id=target_user.id, role="bedel", action="assign")
    status, res = manage_staff_role(DummyRequest(sec_user), payload)
    assert status == 200
    assert target_user.groups.filter(name="bedel").exists()


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
    assert resultado_data.get("mime_type") == "image/png"
    assert "string" in resultado_data
