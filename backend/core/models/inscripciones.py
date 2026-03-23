from django.db import models

from .carreras import Materia
from .estudiantes import Estudiante
from .horarios import Comision


class EquivalenciaCurricular(models.Model):
    """Agrupa materias equivalentes entre profesorados/planes.

    Ej.: código "P101" (Pedagogía) relaciona Materia de distintos planes.
    """

    codigo = models.CharField(max_length=32, unique=True)
    nombre = models.CharField(max_length=255, blank=True, null=True)
    materias = models.ManyToManyField(Materia, related_name="equivalencias", blank=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre or ''}".strip()


class InscripcionMateriaEstudiante(models.Model):
    """Inscripción anual de un estudiante a una materia/comisión."""

    class Estado(models.TextChoices):
        CONFIRMADA = "CONF", "Confirmada"
        PENDIENTE = "PEND", "Pendiente"
        RECHAZADA = "RECH", "Rechazada"
        ANULADA = "ANUL", "Anulada"

    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="inscripciones_materia")
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="inscripciones_estudiantes")
    comision = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inscripciones",
    )
    comision_solicitada = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inscripciones_solicitadas",
    )
    anio = models.IntegerField()
    estado = models.CharField(max_length=4, choices=Estado.choices, default=Estado.CONFIRMADA)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("estudiante", "materia", "anio")
        ordering = ["-anio", "-created_at"]
        indexes = [
            models.Index(fields=["estudiante", "anio"]),
            models.Index(fields=["estudiante", "estado"]),
        ]

    def __str__(self):
        materia_nombre = self.materia.nombre if self.materia_id else "Materia"
        codigo = f" [{self.comision.codigo}]" if self.comision_id else ""
        return f"{self.estudiante.dni} -> {materia_nombre}{codigo} ({self.anio}) {self.get_estado_display()}"
