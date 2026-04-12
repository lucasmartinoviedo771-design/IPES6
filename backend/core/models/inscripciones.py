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
        BAJA = "BAJA", "Baja Voluntaria"

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
    baja_fecha = models.DateField(
        null=True, blank=True,
        help_text="Fecha en que se registró la baja voluntaria.",
    )
    baja_motivo = models.TextField(
        null=True, blank=True,
        help_text="Motivo declarado por el estudiante al darse de baja.",
    )
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


class InscripcionMateriaMovimiento(models.Model):
    """Historial de cambios (Auditoría) para una inscripción."""

    class Tipo(models.TextChoices):
        INSCRIPCION = "INS", "Inscripción"
        CANCELACION = "CAN", "Cancelación"
        BAJA = "BAJ", "Baja Voluntaria"
        OTRO = "OTR", "Otro cambio"

    inscripcion = models.ForeignKey(
        InscripcionMateriaEstudiante,
        on_delete=models.CASCADE,
        related_name="movimientos",
    )
    tipo = models.CharField(max_length=3, choices=Tipo.choices)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    motivo_detalle = models.TextField(null=True, blank=True)
    operador = models.CharField(
        max_length=255, 
        null=True, blank=True, 
        help_text="Usuario o DNI que ejecutó la acción."
    )

    class Meta:
        ordering = ["-fecha_hora"]
        verbose_name = "Movimiento de Inscripción"
        verbose_name_plural = "Movimientos de Inscripción"

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.fecha_hora.strftime('%d/%m/%Y %H:%M')}"
