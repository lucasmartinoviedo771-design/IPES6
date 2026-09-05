"""
Smoke tests de los endpoints de analytics.

Cada endpoint se invoca de verdad contra la base de datos. La motivacion es
concreta: estos endpoints se escribieron asumiendo nombres de campos y de
relaciones que no existian (AuditLog.created_at en lugar de timestamp,
MesaExamen.estado, Comision.horario_catedra, PedidoAnalitico.fecha_solicitud),
y como nadie los habia ejecutado el error solo aparecia al abrir la pestana.
Nueve de once endpoints fallaban en produccion.

Estos tests corren con la base vacia a proposito: un endpoint analitico tiene
que devolver ceros, no explotar, cuando todavia no hay datos que agregar.
"""

import pytest
from django.contrib.auth.models import User

from apps.metrics import analytics_api as A

pytestmark = pytest.mark.django_db


class _Req:
    """Request minimo: los endpoints solo usan .user, y @requires mira .headers."""

    def __init__(self, user):
        self.user = user
        self.headers = {}


@pytest.fixture
def req_admin():
    return _Req(User.objects.create_superuser(username="99000111", password="x"))


# (nombre legible, callable) — si agregas un endpoint a analytics_api, sumalo aca.
ENDPOINTS = [
    ("students_summary", lambda r: A.students_summary(r)),
    ("matricula_evolucion", lambda r: A.matricula_evolucion(r)),
    ("asistencia_evolucion", lambda r: A.asistencia_evolucion(r)),
    ("ausentismo_evolucion", lambda r: A.ausentismo_evolucion(r)),
    ("rendimiento_por_materia", lambda r: A.rendimiento_por_materia(r)),
    ("rendimiento_por_comisiones", lambda r: A.rendimiento_por_comisiones(r)),
    ("comparacion_cohortes", lambda r: A.comparacion_cohortes(r)),
    ("auditoria_dashboard", lambda r: A.auditoria_dashboard(r)),
    ("ausentismo_consolidado", lambda r: A.ausentismo_consolidado(r)),
    ("mesas_dashboard", lambda r: A.mesas_dashboard(r)),
    ("tramites_dashboard", lambda r: A.tramites_dashboard(r)),
]


@pytest.mark.parametrize("nombre,llamar", ENDPOINTS, ids=[n for n, _ in ENDPOINTS])
def test_endpoint_responde_con_base_vacia(nombre, llamar, req_admin):
    """
    No debe lanzar FieldError, NameError ni AttributeError por referirse a
    campos o relaciones inexistentes.
    """
    resultado = llamar(req_admin)
    assert resultado is not None
    assert isinstance(resultado, dict)


def test_ausentismo_avisa_cuando_la_muestra_no_alcanza(req_admin):
    """
    La asistencia se marca por excepcion: una clase sin marcar queda como
    ausente. Con el modulo en puesta a punto eso da tasas cercanas al 100% que
    no representan el ausentismo real, asi que el endpoint tiene que avisarlo
    en vez de publicar el numero a secas.
    """
    d = A.ausentismo_consolidado(req_admin)

    assert d["muestra_suficiente"] is False, "sin registros la muestra no puede darse por valida"
    assert d["cobertura_marcacion"] == 0.0
    assert "no representativa" in d["nota_metodologica"].lower()


def test_endpoints_exigen_permiso_de_metricas(db):
    """
    Un usuario sin ver_metricas no debe poder leer metricas institucionales.
    require() levanta AppError(403), no la HttpError de ninja.
    """
    from apps.common.errors import AppError

    pelado = _Req(User.objects.create_user(username="99000222", password="x"))
    with pytest.raises(AppError) as exc:
        A.students_summary(pelado)
    assert exc.value.status_code == 403


def test_el_cache_no_saltea_el_chequeo_de_permisos(req_admin, cache_real, db):
    """
    Regresion de una vulnerabilidad real.

    cache_endpoint envuelve la vista completa: ante un acierto devuelve el valor
    guardado sin ejecutar el cuerpo. Mientras el require() vivio unicamente
    dentro del cuerpo, cualquier usuario autenticado obtenia las metricas que
    otro con permisos habia dejado cacheadas.

    Usa la fixture cache_real: necesita un cache que de verdad guarde, porque
    lo que se prueba es justamente que un HIT no saltee la autorizacion.
    """
    from apps.common.errors import AppError

    # El admin puebla el cache.
    A.students_summary(req_admin)

    # Un usuario sin ver_metricas debe seguir siendo rechazado, aunque el valor
    # ya este cacheado y la vista no llegue a ejecutarse.
    pelado = _Req(User.objects.create_user(username="99000333", password="x"))
    with pytest.raises(AppError) as exc:
        A.students_summary(pelado)
    assert exc.value.status_code == 403


def test_guardar_un_acta_invalida_el_cache_de_rendimiento(req_admin, cache_redis, db):
    """
    Al cargar un acta, el rendimiento academico cacheado queda obsoleto y tiene
    que borrarse en el momento, no quince minutos despues.

    Usa Redis real (base 15) y no LocMemCache: la invalidacion se apoya en
    delete_pattern, que LocMemCache no implementa, asi que con `cache_real` este
    test pasaria sin probar nada.
    """
    from datetime import date

    from core.models import ActaExamen, Materia, PlanDeEstudio, Profesorado

    prof = Profesorado.objects.create(nombre="Prof Invalidacion", activo=True, duracion_anios=4)
    plan = PlanDeEstudio.objects.create(profesorado=prof, resolucion="RES-INVALIDACION", anio_inicio=2020, vigente=True)
    materia = Materia.objects.create(
        plan_de_estudio=plan, nombre="Materia Invalidacion", anio_cursada=1, formato="ASI", horas_semana=4
    )

    # El endpoint deja su respuesta en el cache.
    A.rendimiento_por_materia(req_admin)
    assert cache_redis.keys("*academic_performance_materia*"), (
        "el endpoint tendria que haber dejado la respuesta cacheada"
    )

    # Guardar un acta dispara la señal de invalidacion.
    ActaExamen.objects.create(
        codigo="ACTA-INVALIDACION-1",
        tipo=ActaExamen.Tipo.values[0],
        profesorado=prof,
        materia=materia,
        plan=plan,
        fecha=date.today(),
    )

    assert not cache_redis.keys("*academic_performance_materia*"), (
        "la señal tendria que haber borrado el rendimiento cacheado"
    )


def test_la_invalidacion_no_borra_snapshots(req_admin, cache_redis, db):
    """
    Los snapshots son el registro historico de como estaba el sistema cada dia y
    no se pueden reconstruir hacia atras. Una version previa de las señales los
    borraba en cada post_save; este test existe para que eso no vuelva a pasar.
    """
    from datetime import date

    from apps.metrics.models import MatriculaSnapshot
    from core.models import Profesorado, Regularidad  # noqa: F401

    prof = Profesorado.objects.create(nombre="Prof Snapshots", activo=True, duracion_anios=4)
    MatriculaSnapshot.objects.create(profesorado=prof, fecha_snapshot=date(2026, 1, 1), total_matriculados=42)

    # Cualquier evento que dispare invalidacion de cache.
    from apps.metrics.cache_invalidation import invalidar

    invalidar("students_summary", "academic_performance_materia")

    assert MatriculaSnapshot.objects.filter(profesorado=prof).count() == 1, (
        "invalidar el cache no debe tocar la serie historica de snapshots"
    )
