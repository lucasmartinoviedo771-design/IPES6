"""
Acceso del docente a la planilla / acta de una mesa de examen.

Estas reglas se rompieron una vez y el síntoma fue confuso: al docente titular la
UI le decía que no tenía privilegios, cuando en realidad su cuenta sí los tenía.
Los tests fijan las tres piezas que lo causaban.

1. El rol activo (`X-Active-Role`) se evalúa de forma estricta. Un usuario con
   varios roles que actúa como "docente" pierde las capabilities de sus otros
   roles, así que el circuito del docente tiene que cerrar con las capabilities
   del rol docente solo.
2. La metadata de actas es un catálogo necesario para renderizar el formulario de
   carga. Si el docente puede cargar notas (`carga_finales`) pero no puede leer
   la metadata, queda en el absurdo de poder escribir sin poder ver el formulario.
3. Solo el docente TITULAR (presidente) gestiona la planilla. Los vocales integran
   el tribunal pero no cargan ni editan el acta.
"""

import pytest
from django.contrib.auth.models import Group, User

from apps.estudiantes.api.helpers.user_utils import (
    _resolve_docente_from_user,
    _user_can_manage_mesa_planilla,
)
from core.models import Docente, MesaExamen, Persona
from core.permissions import can

pytestmark = pytest.mark.django_db


def _user(username: str, *roles: str, email: str = "") -> User:
    user = User.objects.create_user(username=username, email=email)
    for role in roles:
        group, _ = Group.objects.get_or_create(name=role)
        user.groups.add(group)
    return user


def _docente(dni: str, apellido: str = "PEREZ", email: str = "") -> Docente:
    persona = Persona.objects.create(dni=dni, nombre="Ana", apellido=apellido, email=email)
    return Docente.objects.create(persona=persona)


class _FakeRequest:
    """Request mínimo: el helper solo mira `.user`."""

    def __init__(self, user):
        self.user = user
        self.headers = {}


class TestCapabilitiesDelRolDocente:
    def test_docente_puede_cargar_finales_pero_no_ver_actas(self):
        """
        Estado actual de la tabla de capabilities. Si alguien agrega 'docente' a
        'ver_actas', este test avisa: sería darle acceso al listado completo de
        actas del instituto, que es justo lo que se quiso evitar.
        """
        doc = _user("30000001", "docente")
        assert can(doc, "carga_finales")
        assert not can(doc, "ver_actas")

    def test_rol_activo_docente_descarta_capabilities_de_otros_roles(self):
        """
        El caso real: un usuario que además es secretaría, actuando como docente.
        'ver_actas' se pierde, y por eso la metadata no puede depender solo de esa
        capability.
        """
        multi = _user("30000002", "docente", "secretaria")
        assert can(multi, "ver_actas")
        assert not can(multi, "ver_actas", "docente")
        assert can(multi, "carga_finales", "docente")

    def test_metadata_de_actas_alcanzable_actuando_como_docente(self):
        """
        Contrato de `/actas/metadata`, que exige ver_actas O carga_finales.
        Sin esto el formulario de carga de notas no renderiza y la UI muestra
        "No se pudo cargar la información inicial".
        """
        multi = _user("30000003", "docente", "secretaria")
        assert can(multi, "ver_actas", "docente") or can(multi, "carga_finales", "docente")

        solo_docente = _user("30000004", "docente")
        assert can(solo_docente, "ver_actas") or can(solo_docente, "carga_finales")


class TestAccesoAPlanillaDeMesa:
    def _mesa(self, presidente=None, vocal1=None, vocal2=None) -> MesaExamen:
        """
        Mesa sin persistir: el helper solo lee los ids del tribunal, así que no
        hace falta armar profesorado/plan/materia para probar la autorización.
        """
        return MesaExamen(
            docente_presidente_id=presidente.id if presidente else None,
            docente_vocal1_id=vocal1.id if vocal1 else None,
            docente_vocal2_id=vocal2.id if vocal2 else None,
        )

    def test_titular_puede_gestionar_su_planilla(self):
        doc = _docente("30000010", "TITULAR")
        user = _user("30000010", "docente")
        mesa = self._mesa(presidente=doc)
        assert _user_can_manage_mesa_planilla(_FakeRequest(user), mesa)

    def test_vocales_no_gestionan_la_planilla(self):
        titular = _docente("30000011", "TITULAR")
        vocal1 = _docente("30000012", "VOCALUNO")
        vocal2 = _docente("30000013", "VOCALDOS")
        mesa = self._mesa(presidente=titular, vocal1=vocal1, vocal2=vocal2)

        for dni in ("30000012", "30000013"):
            user = _user(dni, "docente")
            assert not _user_can_manage_mesa_planilla(_FakeRequest(user), mesa), (
                f"el vocal {dni} no debe poder gestionar la planilla"
            )

    def test_docente_ajeno_a_la_mesa_no_accede(self):
        titular = _docente("30000014", "TITULAR")
        _docente("30000015", "AJENO")
        mesa = self._mesa(presidente=titular)
        ajeno = _user("30000015", "docente")
        assert not _user_can_manage_mesa_planilla(_FakeRequest(ajeno), mesa)

    def test_mesa_sin_presidente_no_habilita_a_nadie(self):
        """Sin titular asignado, ningún docente hereda el acceso."""
        _docente("30000016", "SINMESA")
        user = _user("30000016", "docente")
        mesa = self._mesa()
        assert not _user_can_manage_mesa_planilla(_FakeRequest(user), mesa)

    def test_personal_autorizado_gestiona_cualquier_planilla(self):
        """Secretaría/bedelía conservan el acceso administrativo."""
        titular = _docente("30000017", "TITULAR")
        mesa = self._mesa(presidente=titular)
        secretaria = _user("30000018", "secretaria")
        assert _user_can_manage_mesa_planilla(_FakeRequest(secretaria), mesa)

    def test_usuario_sin_perfil_docente_no_accede(self):
        """Tiene el rol pero no existe Docente con ese DNI."""
        titular = _docente("30000019", "TITULAR")
        mesa = self._mesa(presidente=titular)
        fantasma = _user("39999999", "docente")
        assert not _user_can_manage_mesa_planilla(_FakeRequest(fantasma), mesa)


class TestDescargaDelPdfDelActa:
    """
    Descargar el PDF exigia 'ver_actas', que el rol docente no tiene: al docente
    que acababa de generar el acta le daba 403 y la UI mostraba "Ocurrio un error
    inesperado". Ahora tambien alcanza con 'carga_finales', pero acotado a la
    mesa propia para no abrir las actas del resto del instituto.
    """

    def _acta_de(self, mesa):
        from types import SimpleNamespace

        return SimpleNamespace(mesa=mesa)

    def test_el_titular_descarga_el_acta_de_su_mesa(self):
        from apps.estudiantes.api.actas import _puede_descargar_acta

        doc = _docente("30000030", "TITULAR")
        user = _user("30000030", "docente")
        mesa = MesaExamen(docente_presidente_id=doc.id)
        assert _puede_descargar_acta(_FakeRequest(user), self._acta_de(mesa))

    def test_el_docente_no_descarga_actas_de_otras_mesas(self):
        from apps.estudiantes.api.actas import _puede_descargar_acta

        titular = _docente("30000031", "TITULAR")
        _docente("30000032", "AJENO")
        ajeno = _user("30000032", "docente")
        mesa = MesaExamen(docente_presidente_id=titular.id)
        assert not _puede_descargar_acta(_FakeRequest(ajeno), self._acta_de(mesa))

    def test_secretaria_descarga_cualquier_acta(self):
        from apps.estudiantes.api.actas import _puede_descargar_acta

        titular = _docente("30000033", "TITULAR")
        secretaria = _user("30000034", "secretaria")
        mesa = MesaExamen(docente_presidente_id=titular.id)
        assert _puede_descargar_acta(_FakeRequest(secretaria), self._acta_de(mesa))

    def test_acta_sin_mesa_solo_para_quien_ve_actas(self):
        """Las actas historicas y de equivalencias no tienen mesa asociada."""
        from apps.estudiantes.api.actas import _puede_descargar_acta

        _docente("30000035", "SUELTO")
        doc = _user("30000035", "docente")
        assert not _puede_descargar_acta(_FakeRequest(doc), self._acta_de(None))

        secretaria = _user("30000036", "secretaria")
        assert _puede_descargar_acta(_FakeRequest(secretaria), self._acta_de(None))


class TestResolucionDeDocente:
    def test_resuelve_por_dni(self):
        doc = _docente("30000020", "PORDNI")
        user = _user("30000020", "docente")
        assert _resolve_docente_from_user(user) == doc

    def test_no_resuelve_por_email(self):
        """
        `User.email` está obsoleto y puede tener datos sucios (Persona es la fuente
        de verdad). Resolver identidad por ahí dejaría que un email mal cargado
        habilite a un docente sobre la planilla de otro.
        """
        doc = _docente("30000021", "PORMAIL", email="compartido@ipes.edu.ar")
        impostor = _user("39999998", "docente", email="compartido@ipes.edu.ar")
        resuelto = _resolve_docente_from_user(impostor)
        assert resuelto is None
        assert resuelto != doc

    def test_email_sucio_no_da_acceso_a_planilla_ajena(self):
        """El escenario completo: mismo email, mesa de otro."""
        titular = _docente("30000022", "TITULAR", email="compartido@ipes.edu.ar")
        impostor = _user("39999997", "docente", email="compartido@ipes.edu.ar")
        mesa = MesaExamen(docente_presidente_id=titular.id)
        assert not _user_can_manage_mesa_planilla(_FakeRequest(impostor), mesa)
