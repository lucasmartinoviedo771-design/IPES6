from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models

from .base import Docente
from .carreras import Materia, Profesorado
from .estudiantes import Estudiante
from .horarios import Comision
from .inscripciones import InscripcionMateriaEstudiante


class Regularidad(models.Model):
    class Situacion(models.TextChoices):
        PROMOCIONADO = "PRO", "Promocionado"
        REGULAR = "REG", "Regular"
        APROBADO = "APR", "Aprobado (sin final)"
        DESAPROBADO_PA = "DPA", "Desaprobado por Parciales"
        DESAPROBADO_TP = "DTP", "Desaprobado por Trabajos Prácticos"
        LIBRE_I = "LBI", "Libre por Inasistencias"
        LIBRE_AT = "LAT", "Libre Antes de Tiempo"

    inscripcion = models.ForeignKey(
        "InscripcionMateriaEstudiante",
        on_delete=models.CASCADE,
        related_name="regularidades_historial",
        null=True,
        blank=True,
    )
    estudiante = models.ForeignKey("Estudiante", on_delete=models.CASCADE, related_name="regularidades")
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="regularidades")
    fecha_cierre = models.DateField()
    nota_trabajos_practicos = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    nota_final_cursada = models.PositiveSmallIntegerField(
        null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    asistencia_porcentaje = models.IntegerField(
        null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)]
    )
    excepcion = models.BooleanField(default=False)
    situacion = models.CharField(max_length=3, choices=Situacion.choices)
    observaciones = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("estudiante", "materia", "fecha_cierre")
        ordering = ["-fecha_cierre"]

    def __str__(self):
        return f"Reg {self.estudiante.dni} {self.materia.nombre} {self.get_situacion_display()}"


class RegularidadFormato(models.Model):
    slug = models.SlugField(max_length=32, unique=True)
    nombre = models.CharField(max_length=64)
    descripcion = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self) -> str:
        return self.nombre


class RegularidadPlantilla(models.Model):
    class Dictado(models.TextChoices):
        ANUAL = "ANUAL", "Anual"
        PRIMER_CUATRIMESTRE = "1C", "1° Cuatrimestre"
        SEGUNDO_CUATRIMESTRE = "2C", "2° Cuatrimestre"

    formato = models.ForeignKey(
        RegularidadFormato,
        on_delete=models.CASCADE,
        related_name="plantillas",
    )
    dictado = models.CharField(max_length=8, choices=Dictado.choices)
    nombre = models.CharField(max_length=128)
    descripcion = models.TextField(blank=True, null=True)
    columnas = models.JSONField(default=list, blank=True)
    situaciones = models.JSONField(default=list, blank=True)
    referencias = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("formato", "dictado")
        ordering = ["formato__nombre", "dictado"]

    def __str__(self) -> str:
        return f"{self.formato.nombre} ({self.get_dictado_display()})"


class PlanillaRegularidad(models.Model):
    class Estado(models.TextChoices):
        DRAFT = "draft", "Borrador"
        FINAL = "final", "Finalizada"

    codigo = models.CharField(max_length=64, unique=True)
    numero = models.PositiveIntegerField(default=0)
    anio_academico = models.IntegerField(default=0)
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="planillas_regularidad",
    )
    materia = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="planillas_regularidad",
    )
    plantilla = models.ForeignKey(
        RegularidadPlantilla,
        on_delete=models.PROTECT,
        related_name="planillas",
    )
    formato = models.ForeignKey(
        RegularidadFormato,
        on_delete=models.PROTECT,
        related_name="planillas",
    )
    dictado = models.CharField(
        max_length=8,
        choices=RegularidadPlantilla.Dictado.choices,
    )
    plan_resolucion = models.CharField(max_length=128, blank=True)
    folio = models.CharField(max_length=32, blank=True)
    fecha = models.DateField()
    observaciones = models.TextField(blank=True)
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.FINAL)
    datos_adicionales = models.JSONField(default=dict, blank=True)
    pdf = models.FileField(upload_to="planillas_regularidad/%Y/%m/%d", null=True, blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="planillas_regularidad_creadas",
    )
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planillas_regularidad_actualizadas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha", "codigo"]
        indexes = [
            models.Index(fields=["profesorado", "anio_academico"]),
            models.Index(fields=["materia", "fecha"]),
        ]

    def clean(self):
        super().clean()
        if self.plantilla and self.formato and self.formato != self.plantilla.formato:
            raise ValidationError(f"El formato de la planilla ({self.formato}) debe coincidir con el formato de la plantilla '{self.plantilla.nombre}' ({self.plantilla.formato}).")

    def __str__(self) -> str:
        return f"{self.codigo} - {self.materia.nombre}"


class PlanillaRegularidadDocente(models.Model):
    class Rol(models.TextChoices):
        PROFESOR = "profesor", "Profesor/a"
        BEDEL = "bedel", "Bedel"
        OTRO = "otro", "Otro"

    planilla = models.ForeignKey(
        PlanillaRegularidad,
        on_delete=models.CASCADE,
        related_name="docentes",
    )
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planillas_regularidad",
    )
    nombre = models.CharField(max_length=255)
    dni = models.CharField(max_length=20, blank=True)
    rol = models.CharField(max_length=16, choices=Rol.choices, default=Rol.PROFESOR)
    orden = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self) -> str:
        return f"{self.nombre} ({self.get_rol_display()})"


class PlanillaRegularidadFila(models.Model):
    planilla = models.ForeignKey(
        PlanillaRegularidad,
        on_delete=models.CASCADE,
        related_name="filas",
    )
    orden = models.PositiveIntegerField()
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planillas_regularidad",
    )
    dni = models.CharField(max_length=20)
    apellido_nombre = models.CharField(max_length=255)
    nota_final = models.PositiveSmallIntegerField(null=True, blank=True)
    asistencia_porcentaje = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    situacion = models.CharField(max_length=32)
    excepcion = models.BooleanField(default=False)
    datos = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["orden", "id"]
        unique_together = (("planilla", "orden"),)
        constraints = [
            models.UniqueConstraint(
                fields=["planilla", "dni"],
                name="uniq_planilla_regularidad_fila_dni",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        qs = PlanillaRegularidadFila.objects.filter(planilla=self.planilla, dni=self.dni)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            existing = qs.first()
            raise ValidationError(
                f"El DNI {self.dni} ya está cargado en esta planilla "
                f"(fila #{existing.orden}: {existing.apellido_nombre})."
            )

    def __str__(self) -> str:
        return f"{self.planilla.codigo} - #{self.orden} {self.apellido_nombre}"


class PlanillaRegularidadHistorial(models.Model):
    class Accion(models.TextChoices):
        CREACION = "create", "Creación"
        EDICION = "update", "Edición"
        ELIMINACION_FILA = "delete_row", "Eliminación de fila"
        REGENERACION_PDF = "regenerate_pdf", "Regeneración de PDF"

    planilla = models.ForeignKey(
        PlanillaRegularidad,
        on_delete=models.CASCADE,
        related_name="historial",
    )
    accion = models.CharField(max_length=32, choices=Accion.choices)
    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planillas_regularidad_historial",
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.planilla.codigo} - {self.get_accion_display()} ({self.created_at:%Y-%m-%d %H:%M})"


class RegularidadPlanillaLock(models.Model):
    comision = models.OneToOneField(
        Comision,
        on_delete=models.CASCADE,
        related_name="regularidad_lock",
        null=True,
        blank=True,
    )
    materia = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="regularidad_locks",
        null=True,
        blank=True,
    )
    anio_virtual = models.IntegerField(null=True, blank=True)
    cerrado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="regularidad_planillas_cerradas",
    )
    cerrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["materia", "anio_virtual"], name="uniq_regularidad_lock_materia_anio"),
            models.CheckConstraint(
                check=(
                    # Caso 1: Solo comisión
                    models.Q(comision__isnull=False, materia__isnull=True, anio_virtual__isnull=True) |
                    # Caso 2: Solo materia + año
                    models.Q(comision__isnull=True, materia__isnull=False, anio_virtual__isnull=False)
                ),
                name="regularidad_lock_scope_xor",
            ),
        ]

    def __str__(self) -> str:
        if self.comision:
            return f"Cierre regularidad comision {self.comision_id}"
        return f"Cierre regularidad materia {self.materia_id} ({self.anio_virtual})"
