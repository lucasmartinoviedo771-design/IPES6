from django.db import models

from core.models.carreras import Profesorado
from core.models.horarios import Comision


class MatriculaSnapshot(models.Model):
    """
    Snapshot periódico (diario/mensual) de matrícula por profesorado y estado.
    Permite graficar evolución de matrícula a través del tiempo.
    """

    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="matricula_snapshots",
        null=True,
        blank=True,
    )
    fecha_snapshot = models.DateField(
        db_index=True,
        help_text="Fecha del snapshot (diario, mensual según configuración).",
    )
    total_matriculados = models.IntegerField(default=0)
    por_estado = models.JSONField(
        default=dict,
        help_text="Desglose por estado_academico: {'activo': N, 'libre': N, ...}",
    )
    promedio_notas = models.FloatField(null=True, blank=True)
    promedio_asistencia = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Snapshot de Matrícula"
        verbose_name_plural = "Snapshots de Matrícula"
        unique_together = ("profesorado", "fecha_snapshot")
        indexes = [
            models.Index(fields=["fecha_snapshot"]),
            models.Index(fields=["profesorado", "fecha_snapshot"]),
        ]
        ordering = ["-fecha_snapshot"]

    def __str__(self):
        prof = self.profesorado.nombre if self.profesorado else "Global"
        return f"Matrícula {prof} ({self.fecha_snapshot}): {self.total_matriculados}"


class AsistenciaSnapshot(models.Model):
    """
    Snapshot periódico de asistencia agregada de estudiantes por profesorado.
    Permite graficar tendencias de asistencia general del ciclo.
    """

    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="asistencia_snapshots",
        null=True,
        blank=True,
    )
    fecha_snapshot = models.DateField(
        db_index=True,
    )
    total_registros = models.IntegerField(default=0)
    presentes = models.IntegerField(default=0)
    ausentes = models.IntegerField(default=0)
    tardias = models.IntegerField(default=0)
    justificadas = models.IntegerField(default=0)
    porcentaje_asistencia = models.FloatField(null=True, blank=True)
    detalles = models.JSONField(
        default=dict,
        help_text="Detalles adicionales por comisión si aplica.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Snapshot de Asistencia"
        verbose_name_plural = "Snapshots de Asistencia"
        unique_together = ("profesorado", "fecha_snapshot")
        indexes = [
            models.Index(fields=["fecha_snapshot"]),
            models.Index(fields=["profesorado", "fecha_snapshot"]),
        ]
        ordering = ["-fecha_snapshot"]

    def __str__(self):
        prof = self.profesorado.nombre if self.profesorado else "Global"
        return f"Asistencia {prof} ({self.fecha_snapshot}): {self.porcentaje_asistencia}%"


class AusentismoSnapshot(models.Model):
    """
    Snapshot periódico de ausentismo por comisión/cátedra.
    Permite identificar tendencias de desenganche y presión de asignaturas.
    """

    comision = models.ForeignKey(
        Comision,
        on_delete=models.CASCADE,
        related_name="ausentismo_snapshots",
        null=True,
        blank=True,
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="ausentismo_snapshots",
        null=True,
        blank=True,
    )
    fecha_snapshot = models.DateField(
        db_index=True,
    )
    tasa_ausentismo = models.FloatField(help_text="Porcentaje de ausencias sobre total de asistencias registradas.")
    total_estudiantes = models.IntegerField(default=0)
    estudiantes_sin_registro = models.IntegerField(default=0)
    estudiantes_críticos = models.IntegerField(
        default=0,
        help_text="Estudiantes con más del 30% de ausencias.",
    )
    detalles = models.JSONField(
        default=dict,
        help_text="Desglose: {'ausencias': N, 'tardias': N, 'total_clases': N, ...}",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Snapshot de Ausentismo"
        verbose_name_plural = "Snapshots de Ausentismo"
        unique_together = ("comision", "fecha_snapshot")
        indexes = [
            models.Index(fields=["fecha_snapshot"]),
            models.Index(fields=["profesorado", "fecha_snapshot"]),
        ]
        ordering = ["-fecha_snapshot"]

    def __str__(self):
        comision_name = self.comision.codigo if self.comision else self.profesorado.nombre
        return f"Ausentismo {comision_name} ({self.fecha_snapshot}): {self.tasa_ausentismo}%"
