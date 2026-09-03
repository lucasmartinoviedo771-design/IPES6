from django.db import models

from core.models.carreras import Profesorado
from core.models.estudiantes import Estudiante


class RiesgoAcademicoEstudiante(models.Model):
    class NivelRiesgo(models.TextChoices):
        ROJO = "rojo", "Riesgo Crítico"
        AMARILLO = "amarillo", "Riesgo Medio"
        VERDE = "verde", "Trayectoria Regular"

    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.CASCADE,
        related_name="riesgos_academicos",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="estudiantes_riesgo",
        null=True,
        blank=True,
    )
    nivel_riesgo = models.CharField(
        max_length=10,
        choices=NivelRiesgo.choices,
        db_index=True,
    )
    motivos = models.JSONField(
        default=list,
        help_text="Lista de razones concretas que dispararon el nivel de riesgo.",
    )
    fecha_calculo = models.DateField(
        db_index=True,
        help_text="Fecha del snapshot del cálculo (permite evolución temporal).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Riesgo Académico de Estudiante"
        verbose_name_plural = "Riesgos Académicos de Estudiantes"
        unique_together = ("estudiante", "fecha_calculo")
        indexes = [
            models.Index(fields=["fecha_calculo", "nivel_riesgo"]),
            models.Index(fields=["profesorado", "nivel_riesgo"]),
        ]
        ordering = ["-fecha_calculo", "nivel_riesgo"]

    def __str__(self):
        return f"{self.estudiante.dni} - {self.get_nivel_riesgo_display()} ({self.fecha_calculo})"
