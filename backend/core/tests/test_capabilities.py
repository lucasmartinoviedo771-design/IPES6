import pytest
from django.contrib.auth.models import Group, User

from apps.common.errors import AppError
from core.permissions import ALL_ROLES, CAPABILITIES, can, require

pytestmark = pytest.mark.django_db


class TestCapabilities:
    def _make_user(self, *roles: str) -> User:
        user = User.objects.create_user(username=f"test_{'_'.join(roles)}")
        for role in roles:
            group, _ = Group.objects.get_or_create(name=role)
            user.groups.add(group)
        return user

    def test_admin_can_everything(self):
        admin = self._make_user("admin")
        for cap in CAPABILITIES:
            assert can(admin, cap), f"admin debería tener '{cap}'"

    def test_superuser_can_everything(self):
        su = User.objects.create_superuser(username="super", password="x")
        for cap in CAPABILITIES:
            assert can(su, cap), f"superuser debería tener '{cap}'"

    def test_bedel_can_carga_regularidades(self):
        bedel = self._make_user("bedel")
        assert can(bedel, "carga_regularidades")

    def test_bedel_cannot_admin_sistema(self):
        bedel = self._make_user("bedel")
        assert not can(bedel, "admin_sistema")

    def test_estudiante_can_enviar_mensajes(self):
        est = self._make_user("estudiante")
        assert can(est, "enviar_mensajes")

    def test_estudiante_cannot_editar_estudiantes(self):
        est = self._make_user("estudiante")
        assert not can(est, "editar_estudiantes")

    def test_docente_can_asistencia_estudiantes(self):
        doc = self._make_user("docente")
        assert can(doc, "asistencia_estudiantes_editar")
        assert not can(doc, "asistencia_estudiantes_justificar")

    def test_require_raises_on_missing_capability(self):
        bedel = self._make_user("bedel")
        with pytest.raises(AppError) as exc_info:
            require(bedel, "admin_sistema")
        assert exc_info.value.status_code == 403

    def test_unknown_capability_raises_valueerror(self):
        user = self._make_user("admin")
        with pytest.raises(ValueError, match="Capability desconocida"):
            can(user, "capability_que_no_existe")

    def test_all_capabilities_use_valid_roles(self):
        """Verifica que la tabla no tenga roles inventados."""
        for cap, roles in CAPABILITIES.items():
            invalid = roles - ALL_ROLES
            assert not invalid, f"Capability '{cap}' usa roles inválidos: {invalid}"

    def test_tutor_corrections_applied(self):
        """Verifica las correcciones específicas de Lucas."""
        tutor = self._make_user("tutor")
        assert can(tutor, "gestionar_equivalencias")
        assert can(tutor, "gestionar_titulos")
        assert can(tutor, "ver_analiticos")

    def test_jefa_aaee_cannot_asignar_roles(self):
        """Corrección de Lucas: jefa_aaee ya no asigna roles."""
        jefa = self._make_user("jefa_aaee")
        assert not can(jefa, "asignar_roles")
        assert can(jefa, "gestionar_ventanas")  # pero sí mantiene ventanas

    def test_ver_metricas_roles(self):
        """Verifica los roles autorizados para ver_metricas."""
        bedel = self._make_user("bedel")
        jefes = self._make_user("jefes")
        rectorado = self._make_user("rectorado")
        tutor = self._make_user("tutor")
        assert can(bedel, "ver_metricas")
        assert can(jefes, "ver_metricas")
        assert can(rectorado, "ver_metricas")
        assert not can(tutor, "ver_metricas")
