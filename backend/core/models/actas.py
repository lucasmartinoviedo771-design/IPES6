from django.contrib.auth.models import User
from django.db import models

from .carreras import Materia, PlanDeEstudio, Profesorado


class ActaExamen(models.Model):
    class Tipo(models.TextChoices):
        REGULAR = "REG", "Regular"
        LIBRE = "LIB", "Libre"

    codigo = models.CharField(max_length=64, unique=True)
    numero = models.PositiveIntegerField(default=0)
    anio_academico = models.IntegerField(default=0)
    tipo = models.CharField(max_length=4, choices=Tipo.choices)
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.PROTECT,
        related_name="actas_examen",
    )
    materia = models.ForeignKey(
        Materia,
        on_delete=models.PROTECT,
        related_name="actas_examen",
    )
    plan = models.ForeignKey(
        PlanDeEstudio,
        on_delete=models.PROTECT,
        related_name="actas_examen",
    )
    anio_cursada = models.IntegerField(null=True, blank=True)
    fecha = models.DateField()
    folio = models.CharField(max_length=64, blank=True)
    libro = models.CharField(max_length=64, blank=True)
    observaciones = models.TextField(blank=True)
    total_alumnos = models.PositiveIntegerField(default=0)
    total_aprobados = models.PositiveIntegerField(default=0)
    total_desaprobados = models.PositiveIntegerField(default=0)
    total_ausentes = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="actas_examen_creadas",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actas_examen_actualizadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "-id"]
        unique_together = ("profesorado", "anio_academico", "numero")

    def __str__(self) -> str:
        return f"{self.codigo} - {self.materia.nombre}"


class ActaExamenDocente(models.Model):
    class Rol(models.TextChoices):
        PRESIDENTE = "PRES", "Presidente"
        VOCAL1 = "VOC1", "Vocal 1"
        VOCAL2 = "VOC2", "Vocal 2"

    acta = models.ForeignKey(
        ActaExamen,
        on_delete=models.CASCADE,
        related_name="docentes",
    )
    docente = models.ForeignKey(
        "Docente",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="actas_examen",
    )
    nombre = models.CharField(max_length=255)
    dni = models.CharField(max_length=32, blank=True)
    rol = models.CharField(max_length=4, choices=Rol.choices, default=Rol.PRESIDENTE)
    orden = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self) -> str:
        return f"{self.get_rol_display()} - {self.nombre}"


class ActaExamenEstudiante(models.Model):
    NOTA_AUSENTE_JUSTIFICADO = "AJ"
    NOTA_AUSENTE_INJUSTIFICADO = "AI"

    acta = models.ForeignKey(
        ActaExamen,
        on_delete=models.CASCADE,
        related_name="estudiantes",
    )
    numero_orden = models.PositiveIntegerField()
    permiso_examen = models.CharField(max_length=64, blank=True)
    dni = models.CharField(max_length=16)
    apellido_nombre = models.CharField(max_length=255)
    examen_escrito = models.CharField(max_length=4, blank=True)
    examen_oral = models.CharField(max_length=4, blank=True)
    calificacion_definitiva = models.CharField(max_length=4)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ["numero_orden", "id"]

    def __str__(self) -> str:
        return f"{self.numero_orden}. {self.apellido_nombre} ({self.calificacion_definitiva})"
