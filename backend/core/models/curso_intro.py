from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from .carreras import Profesorado
from .horarios import Turno, VentanaHabilitacion


class CursoIntroductorioCohorte(models.Model):
    nombre = models.CharField(max_length=128, blank=True)
    anio_academico = models.IntegerField()
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.SET_NULL,
        related_name="curso_introductorio_cohortes",
        null=True,
        blank=True,
    )
    turno = models.ForeignKey(Turno, on_delete=models.SET_NULL, null=True, blank=True, related_name="curso_introductorio_cohortes")
    ventana_inscripcion = models.ForeignKey(
        VentanaHabilitacion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="curso_introductorio_cohortes",
    )
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    cupo = models.PositiveIntegerField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cohortes_curso_intro_creadas",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cohortes_curso_intro_actualizadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-anio_academico", "-fecha_inicio", "-id"]
        verbose_name = "Cohorte de Curso Introductorio"
        verbose_name_plural = "Cohortes de Curso Introductorio"

    def clean(self):
        super().clean()
        if self.fecha_inicio and self.fecha_fin and self.fecha_fin < self.fecha_inicio:
            raise ValidationError("La fecha de fin no puede ser anterior a la fecha de inicio.")

    def __str__(self):
        base = self.nombre or f"Cohorte {self.anio_academico}"
        if self.turno:
            return f"{base} - {self.turno.nombre}"
        return base


class CursoIntroductorioRegistro(models.Model):
    class Resultado(models.TextChoices):
        PENDIENTE = "PEN", "Pendiente"
        APROBADO = "APR", "Aprobado"
        DESAPROBADO = "DES", "Desaprobado"
        AUSENTE = "AUS", "Ausente"

    cohorte = models.ForeignKey(
        CursoIntroductorioCohorte,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="registros",
    )
    estudiante = models.ForeignKey(
        "Estudiante",
        on_delete=models.CASCADE,
        related_name="curso_introductorio_registros",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="curso_introductorio_registros",
    )
    turno = models.ForeignKey(Turno, on_delete=models.SET_NULL, null=True, blank=True, related_name="curso_introductorio_registros")
    inscripto_en = models.DateTimeField(auto_now_add=True)
    asistencias_totales = models.PositiveIntegerField(null=True, blank=True)
    nota_final = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    resultado = models.CharField(max_length=3, choices=Resultado.choices, default=Resultado.PENDIENTE)
    observaciones = models.TextField(blank=True)
    resultado_at = models.DateTimeField(null=True, blank=True)
    resultado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="curso_introductorio_resultados",
    )
    es_historico = models.BooleanField(default=False)

    class Meta:
        ordering = ["-inscripto_en"]
        verbose_name = "Registro Curso Introductorio"
        verbose_name_plural = "Registros Curso Introductorio"
        constraints = [
            # Prevenir duplicados para estudiantes en la misma cohorte
            models.UniqueConstraint(
                fields=["cohorte", "estudiante"],
                condition=models.Q(cohorte__isnull=False),
                name="unique_registro_cohorte_estudiante",
            ),
            # Prevenir múltiples registros huérfanos (cohorte null) para el mismo estudiante
            models.UniqueConstraint(
                fields=["estudiante"],
                condition=models.Q(cohorte__isnull=True),
                name="unique_registro_student_orphan",
            )
        ]


    def __str__(self):
        return f"{self.estudiante.dni} - {self.get_resultado_display()}"
