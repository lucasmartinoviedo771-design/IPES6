"""
Invalidación del caché de analytics ante cambios en los datos de origen.

Sin esto el caché solo expira por TTL, con lo cual un acta recién cargada podía
tardar hasta quince minutos en verse reflejada en el dashboard.

REGLA INNEGOCIABLE: estas señales tocan ÚNICAMENTE el caché. Una versión previa
de este archivo, además de invalidar, borraba filas de MatriculaSnapshot y
AusentismoSnapshot en cada post_save. Eso destruye la serie histórica que esos
modelos existen para acumular: los snapshots son el registro de cómo estaba el
sistema cada día y no se pueden recalcular hacia atrás. Nunca borres snapshots
desde acá.
"""

import logging

from django.core.cache import cache
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Prefijos tal como los declara cada @cache_endpoint en analytics_api.py.
P_STUDENTS = "students_summary"
P_ACAD_MATERIA = "academic_performance_materia"
P_ACAD_COMISIONES = "academic_performance_comisiones"
P_ACAD_COHORTES = "academic_performance_cohortes"
P_AUSENTISMO = "ausentismo_consolidado"
P_MESAS = "mesas_dashboard"
P_TRAMITES = "tramites_dashboard"

ACADEMICO = (P_ACAD_MATERIA, P_ACAD_COMISIONES, P_ACAD_COHORTES)


def invalidar(*prefijos: str) -> int:
    """
    Borra las entradas de caché de los prefijos indicados.

    Devuelve cuántas claves se borraron. Si el backend no soporta borrado por
    patrón (LocMemCache, el modo degradado sin Redis) no hace nada y el caché
    simplemente sigue expirando por TTL: es una desmejora, no un error.
    """
    borradas = 0
    delete_pattern = getattr(cache, "delete_pattern", None)
    if delete_pattern is None:
        return 0

    for prefijo in prefijos:
        try:
            borradas += delete_pattern(f"analytics:{prefijo}:*") or 0
        except Exception:  # noqa: BLE001
            # Una caída de Redis no puede voltear un guardado del usuario:
            # como mucho se sirve un dato viejo hasta que venza el TTL.
            logger.warning("No se pudo invalidar el cache de %s", prefijo, exc_info=True)
    return borradas


def _conectar():
    """Registra las señales. Se llama desde MetricsConfig.ready()."""
    from apps.asistencia.models import AsistenciaEstudiante
    from core.models import (
        ActaExamen,
        ActaExamenEstudiante,
        EstudianteCarrera,
        MesaExamen,
        PedidoAnalitico,
        PedidoEquivalencia,
        Regularidad,
        RiesgoAcademicoEstudiante,
    )

    # Qué modelo invalida qué. La respuesta de cada endpoint sale de estas
    # tablas, así que un cambio acá vuelve obsoleto lo cacheado.
    MAPA = [
        # Notas de examen: alimentan rendimiento académico y el promedio de mesas.
        (ActaExamenEstudiante, ACADEMICO + (P_MESAS,)),
        (ActaExamen, ACADEMICO + (P_MESAS,)),
        # Cursada: promedio de notas y de asistencia del resumen de estudiantes.
        (Regularidad, (P_STUDENTS,) + ACADEMICO),
        # Matrícula: totales por estado y comparación de cohortes.
        (EstudianteCarrera, (P_STUDENTS, P_ACAD_COHORTES)),
        # Semáforo de riesgo.
        (RiesgoAcademicoEstudiante, (P_STUDENTS,)),
        # Asistencia: tasa de ausentismo por cátedra.
        (AsistenciaEstudiante, (P_AUSENTISMO,)),
        # Mesas de examen.
        (MesaExamen, (P_MESAS,)),
        # Trámites.
        (PedidoAnalitico, (P_TRAMITES,)),
        (PedidoEquivalencia, (P_TRAMITES,)),
    ]

    for modelo, prefijos in MAPA:
        _registrar(modelo, prefijos)


def _registrar(modelo, prefijos: tuple[str, ...]) -> None:
    """Conecta post_save y post_delete de un modelo a la invalidación."""
    uid = f"analytics_cache_{modelo._meta.label_lower}"

    @receiver(post_save, sender=modelo, weak=False, dispatch_uid=uid + "_save")
    @receiver(post_delete, sender=modelo, weak=False, dispatch_uid=uid + "_delete")
    def _handler(sender, instance, **kwargs):  # noqa: ARG001
        invalidar(*prefijos)
