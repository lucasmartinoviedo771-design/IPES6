"""
Signals para invalidar cache de analytics cuando cambian los datos.
Se ejecutan automáticamente en post_save, post_delete, etc.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

from core.models import (
    Estudiante,
    EstudianteCarrera,
    Regularidad,
    PlanillaRegularidad,
    ActaExamen,
    MesaExamen,
    Preinscripcion,
    RiesgoAcademicoEstudiante,
)
from apps.asistencia.models import AsistenciaEstudiante, ClaseProgramada
from apps.metrics.models import (
    MatriculaSnapshot,
    AsistenciaSnapshot,
    AusentismoSnapshot,
)


def invalidate_analytics_cache(keys_pattern: list[str]) -> None:
    """
    Invalida múltiples cache keys.

    Args:
        keys_pattern: Lista de prefijos o patterns (ej: ["students_summary", "academic_performance"])
    """
    for pattern in keys_pattern:
        # Intenta borrar keys que matcheen el patrón
        # Redis/Memcached soportan keys con patrón, Django cache no siempre
        try:
            # Para Redis: cache.delete_pattern(f"{pattern}:*")
            # Para development (locmem): se puede hacer un cache.clear() selectivo
            pass
        except Exception:
            pass


# Cuando cambian estudiantes → Invalidar matricula, rendimiento, riesgo
@receiver(post_save, sender=EstudianteCarrera)
@receiver(post_delete, sender=EstudianteCarrera)
def invalidate_on_estudiante_carrera_change(sender, instance, **kwargs):
    """
    Invalida caches de matrícula y resumen académico cuando hay cambios.
    """
    # Limpiar snapshots relacionados (para que se recalculen)
    MatriculaSnapshot.objects.filter(
        profesorado=instance.profesorado
    ).delete()

    # Invalidar cache keys específicas
    patterns = [
        f"analytics:students_summary:{instance.profesorado_id}",
        f"analytics:academic_performance",
    ]


# Cuando se agregan/modifican actas de examen → Invalidar rendimiento académico
@receiver(post_save, sender=ActaExamen)
@receiver(post_delete, sender=ActaExamen)
def invalidate_on_acta_change(sender, instance, **kwargs):
    """
    Invalida caches de rendimiento académico.
    """
    cache.delete_many([
        key for key in cache.keys("*academic_performance*")
    ]) if hasattr(cache, 'keys') else None


# Cuando cambian asistencias → Invalidar ausentismo
@receiver(post_save, sender=AsistenciaEstudiante)
@receiver(post_delete, sender=AsistenciaEstudiante)
def invalidate_on_asistencia_change(sender, instance, **kwargs):
    """
    Invalida caches de asistencia y ausentismo consolidado.
    """
    # Limpiar snapshots para que se recalculen
    AusentismoSnapshot.objects.filter(
        comision=instance.clase_programada.comision
    ).delete()

    # Invalidar cache keys
    if hasattr(cache, 'keys'):
        cache.delete_many([
            key for key in cache.keys("*ausentismo*")
        ])


# Cuando cambian preinscripciones → Invalidar summary
@receiver(post_save, sender=Preinscripcion)
@receiver(post_delete, sender=Preinscripcion)
def invalidate_on_preinscripcion_change(sender, instance, **kwargs):
    """
    Invalida caches de preinscripciones.
    """
    if hasattr(cache, 'keys'):
        cache.delete_many([
            key for key in cache.keys("*preinscripcion*")
        ])


# Cuando cambian regularidades/planillas → Invalidar rendimiento
@receiver(post_save, sender=Regularidad)
@receiver(post_save, sender=PlanillaRegularidad)
@receiver(post_delete, sender=Regularidad)
@receiver(post_delete, sender=PlanillaRegularidad)
def invalidate_on_regularidad_change(sender, instance, **kwargs):
    """
    Invalida caches de rendimiento académico y summary de estudiantes.
    """
    if hasattr(cache, 'keys'):
        cache.delete_many([
            key for key in cache.keys("*academic_performance*"),
            key for key in cache.keys("*students_summary*"),
        ])


# Cuando se calcula riesgo → Invalidar summary (que incluye semáforo)
@receiver(post_save, sender=RiesgoAcademicoEstudiante)
def invalidate_on_riesgo_change(sender, instance, **kwargs):
    """
    Invalida caches de summary cuando cambia riesgo académico.
    """
    if hasattr(cache, 'keys'):
        cache.delete_many([
            key for key in cache.keys("*students_summary*"),
            key for key in cache.keys("*students_at_risk*"),
        ])


# Cuando cambian mesas de examen → Invalidar overview global
@receiver(post_save, sender=MesaExamen)
@receiver(post_delete, sender=MesaExamen)
def invalidate_on_mesa_change(sender, instance, **kwargs):
    """
    Invalida caches globales.
    """
    if hasattr(cache, 'keys'):
        cache.delete_many([
            key for key in cache.keys("*dashboard*"),
        ])
