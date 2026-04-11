from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
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
        constraints = [
            models.CheckConstraint(
                check=models.Q(total_alumnos=models.F("total_aprobados") + models.F("total_desaprobados") + models.F("total_ausentes")),
                name="acta_examen_totals_parity"
            )
        ]

    def recalcular_totales(self):
        """Recalcula los totales basados en los registros de estudiantes."""
        regs = self.estudiantes.all()
        self.total_alumnos = regs.count()
        self.total_aprobados = regs.filter(calificacion_numerica__gte=4).count()
        self.total_desaprobados = regs.filter(calificacion_numerica__lt=4).count()
        self.total_ausentes = regs.filter(calificacion_numerica__isnull=True).count()
        self.save(update_fields=['total_alumnos', 'total_aprobados', 'total_desaprobados', 'total_ausentes'])

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
    escrito_numerico = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    examen_oral = models.CharField(max_length=4, blank=True)
    oral_numerico = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    calificacion_definitiva = models.CharField(max_length=4)
    calificacion_numerica = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    observaciones = models.TextField(blank=True)

    def clean(self):
        super().clean()
        # Solo validamos inconsistencia explícita si ambos campos vienen seteados
        if self.calificacion_definitiva.isdigit() and self.calificacion_numerica:
            if int(self.calificacion_definitiva) != self.calificacion_numerica:
                raise ValidationError("La nota en texto no coincide con el valor numérico cargado.")

    def save(self, *args, **kwargs):
        # Sincronización de campos numéricos
        if self.calificacion_definitiva.isdigit():
            self.calificacion_numerica = int(self.calificacion_definitiva)
        elif self.calificacion_definitiva in [self.NOTA_AUSENTE_JUSTIFICADO, self.NOTA_AUSENTE_INJUSTIFICADO]:
            self.calificacion_numerica = None

        if self.examen_escrito.isdigit():
            self.escrito_numerico = int(self.examen_escrito)
        
        if self.examen_oral.isdigit():
            self.oral_numerico = int(self.examen_oral)
        
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        acta = self.acta
        super().delete(*args, **kwargs)
        # En el borrado sí recalculamos para evitar dejar actas con totales fantasmas
        acta.recalcular_totales()

    class Meta:
        ordering = ["numero_orden", "id"]

    def __str__(self) -> str:
        return f"{self.numero_orden}. {self.apellido_nombre} ({self.calificacion_definitiva})"
