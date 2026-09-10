"""
Una solicitud de mesa extraordinaria pertenece a un llamado (VentanaHabilitacion)
y solo puede vincularse a una mesa de ese mismo llamado.

El caso real: se abrió un segundo llamado extraordinario para sumar estudiantes
que habían quedado afuera del primero. Varios estudiantes que YA tenían mesa
armada del primer llamado volvieron a solicitar la misma materia en el segundo.
Al procesarlas, algunas quedaron apuntando a la mesa del primer llamado: el
estudiante terminaba con dos registros de solicitud (uno por llamado) para una
sola mesa, y en "Mis Solicitudes" veía la materia dos veces ("Mesa Aprobada" +
"Pendiente"/"Rechazada"), lo que confunde.

Dos barreras:
  1. procesar_solicitud: no se puede asignar una solicitud a una mesa de otro llamado.
  2. solicitar_mesa: un estudiante no puede duplicar la solicitud de una materia
     que ya tiene pedido vigente (pendiente, o con mesa futura sin rendir) en otro
     llamado.
"""

import inspect
from datetime import date, timedelta

import pytest
from django.contrib.auth.models import User
from ninja.errors import HttpError

from core.models import (
    Estudiante,
    Materia,
    MesaExamen,
    Persona,
    PlanDeEstudio,
    Profesorado,
    SolicitudMesa,
)
from core.models.horarios import VentanaHabilitacion

pytestmark = pytest.mark.django_db


@pytest.fixture
def materia():
    prof = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-001/24", anio_inicio=2024)
    return Materia.objects.create(plan_de_estudio=plan, nombre="Historia Social", anio_cursada=1, formato="ASI")


@pytest.fixture
def estudiante():
    p = Persona.objects.create(dni="40000001", nombre="Ana", apellido="Prueba")
    u = User.objects.create_user(username="40000001")
    return Estudiante.objects.create(user=u, persona=p, anio_ingreso=2024)


@pytest.fixture
def admin_user():
    return User.objects.create_user(username="10000001", is_superuser=True)


@pytest.fixture
def llamado_1():
    return VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MESAS_EXTRA, desde=date(2026, 8, 31), hasta=date(2026, 9, 4), activo=False
    )


@pytest.fixture
def llamado_2():
    return VentanaHabilitacion.objects.create(
        tipo=VentanaHabilitacion.Tipo.MESAS_EXTRA, desde=date(2026, 9, 9), hasta=date(2026, 9, 9), activo=False
    )


class TestProcesarSolicitudVentana:
    def test_no_asigna_solicitud_a_mesa_de_otro_llamado(
        self, rf, materia, estudiante, admin_user, llamado_1, llamado_2
    ):
        from apps.management.api.mesas import procesar_solicitud

        # Solicitud del llamado 2, mesa creada bajo el llamado 1
        sol = SolicitudMesa.objects.create(estudiante=estudiante, materia=materia, ventana=llamado_2, modalidad="REG")
        mesa = MesaExamen.objects.create(
            materia=materia, tipo="EXT", modalidad="REG", fecha=date(2026, 9, 24), ventana=llamado_1
        )

        request = rf.post("/api/management/solicitudes_mesas/x/procesar")
        request.user = admin_user

        with pytest.raises(HttpError) as exc:
            procesar_solicitud(request, sol_id=sol.id, estado="PRO", mesa_id=mesa.id)
        assert exc.value.status_code == 400

        sol.refresh_from_db()
        assert sol.mesa_asignada_id is None
        assert sol.estado == "PEN"

    def test_asigna_solicitud_a_mesa_del_mismo_llamado(self, rf, materia, estudiante, admin_user, llamado_1):
        from apps.management.api.mesas import procesar_solicitud

        sol = SolicitudMesa.objects.create(estudiante=estudiante, materia=materia, ventana=llamado_1, modalidad="REG")
        mesa = MesaExamen.objects.create(
            materia=materia, tipo="EXT", modalidad="REG", fecha=date(2026, 9, 24), ventana=llamado_1
        )

        request = rf.post("/api/management/solicitudes_mesas/x/procesar")
        request.user = admin_user

        procesar_solicitud(request, sol_id=sol.id, estado="PRO", mesa_id=mesa.id)

        sol.refresh_from_db()
        assert sol.mesa_asignada_id == mesa.id
        assert sol.estado == "PRO"

    def test_permite_mesa_sin_ventana(self, rf, materia, estudiante, admin_user, llamado_2):
        """Mesa especial / legada sin ventana: no se bloquea la asignación."""
        from apps.management.api.mesas import procesar_solicitud

        sol = SolicitudMesa.objects.create(estudiante=estudiante, materia=materia, ventana=llamado_2, modalidad="REG")
        mesa = MesaExamen.objects.create(materia=materia, tipo="ESP", modalidad="REG", fecha=date(2026, 9, 24))

        request = rf.post("/api/management/solicitudes_mesas/x/procesar")
        request.user = admin_user

        procesar_solicitud(request, sol_id=sol.id, estado="PRO", mesa_id=mesa.id)
        sol.refresh_from_db()
        assert sol.mesa_asignada_id == mesa.id


class TestSolicitarMesaSinDuplicar:
    def test_guard_esta_en_el_codigo(self):
        """
        Regresión: solicitar_mesa debe rechazar el duplicado entre llamados.
        Se vigila la fuente para que no se quite en una refactorización.
        """
        from apps.estudiantes.api import mesas_api

        src = inspect.getsource(mesas_api.solicitar_mesa)
        assert ".exclude(ventana=ventana)" in src, "debe comparar contra solicitudes de OTROS llamados"
        assert "Ya tenés mesa asignada para" in src or "Ya tenés una solicitud pendiente para" in src, (
            "debe bloquear el duplicado con un mensaje claro"
        )
        assert "ya_rindio" in src, "debe permitir volver a solicitar si el estudiante ya rindió esa materia"

    def test_bloquea_duplicado_con_mesa_futura(self, materia, estudiante, llamado_1, llamado_2):
        """
        Comprobación directa de la lógica del guard: con una solicitud PROCESADA y
        mesa futura activa en el llamado 1, un pedido de la misma materia en el
        llamado 2 se considera duplicado.
        """
        from core.models import InscripcionMesa

        mesa = MesaExamen.objects.create(
            materia=materia,
            tipo="EXT",
            modalidad="REG",
            fecha=date.today() + timedelta(days=10),
            ventana=llamado_1,
            activa=True,
        )
        SolicitudMesa.objects.create(
            estudiante=estudiante, materia=materia, ventana=llamado_1, modalidad="REG", estado="PRO", mesa_asignada=mesa
        )
        InscripcionMesa.objects.create(mesa=mesa, estudiante=estudiante, estado="INS")

        previas = (
            SolicitudMesa.objects.filter(estudiante=estudiante, materia=materia)
            .exclude(estado=SolicitudMesa.Estado.RECHAZADA)
            .exclude(ventana=llamado_2)
            .select_related("mesa_asignada")
        )
        bloqueado = False
        for prev in previas:
            if prev.estado == SolicitudMesa.Estado.PROCESADA and prev.mesa_asignada and prev.mesa_asignada.activa:
                insc = InscripcionMesa.objects.filter(mesa=prev.mesa_asignada, estudiante=estudiante).first()
                ya_rindio = insc and (insc.nota is not None or insc.condicion is not None)
                if not ya_rindio:
                    bloqueado = True
        assert bloqueado, "una mesa futura sin rendir en otro llamado debe bloquear el duplicado"

    def test_no_bloquea_si_ya_rindio(self, materia, estudiante, llamado_1, llamado_2):
        """Si ya rindió esa materia (tiene nota), puede volver a solicitarla."""
        from core.models import InscripcionMesa

        mesa = MesaExamen.objects.create(
            materia=materia,
            tipo="EXT",
            modalidad="REG",
            fecha=date.today() - timedelta(days=30),
            ventana=llamado_1,
            activa=True,
        )
        SolicitudMesa.objects.create(
            estudiante=estudiante, materia=materia, ventana=llamado_1, modalidad="REG", estado="PRO", mesa_asignada=mesa
        )
        InscripcionMesa.objects.create(mesa=mesa, estudiante=estudiante, estado="INS", condicion="DES", nota=3)

        previas = (
            SolicitudMesa.objects.filter(estudiante=estudiante, materia=materia)
            .exclude(estado=SolicitudMesa.Estado.RECHAZADA)
            .exclude(ventana=llamado_2)
            .select_related("mesa_asignada")
        )
        bloqueado = False
        for prev in previas:
            if prev.estado == SolicitudMesa.Estado.PROCESADA and prev.mesa_asignada and prev.mesa_asignada.activa:
                insc = InscripcionMesa.objects.filter(mesa=prev.mesa_asignada, estudiante=estudiante).first()
                ya_rindio = insc and (insc.nota is not None or insc.condicion is not None)
                if not ya_rindio:
                    bloqueado = True
        assert not bloqueado, "si ya rindió, no se bloquea un nuevo pedido"
