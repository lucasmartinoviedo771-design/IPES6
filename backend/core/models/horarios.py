from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from .base import Docente
from .carreras import Materia, Profesorado


class Turno(models.Model):
    nombre = models.CharField(max_length=50, unique=True)  # Mañana, Tarde, Noche

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Turno"
        verbose_name_plural = "Turnos"


class Bloque(models.Model):
    DIA_CHOICES = [
        (1, "Lunes"),
        (2, "Martes"),
        (3, "Miércoles"),
        (4, "Jueves"),
        (5, "Viernes"),
        (6, "Sábado"),
    ]
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name="bloques")
    dia = models.IntegerField(choices=DIA_CHOICES)
    hora_desde = models.TimeField()
    hora_hasta = models.TimeField()
    es_recreo = models.BooleanField(default=False)

    @property
    def dia_display(self):
        return self.get_dia_display()

    def __str__(self):
        return f"{self.get_dia_display()} {self.hora_desde}-{self.hora_hasta} ({self.turno.nombre})"

    class Meta:
        verbose_name = "Bloque Horario"
        verbose_name_plural = "Bloques Horarios"
        unique_together = ("turno", "dia", "hora_desde", "hora_hasta")
        ordering = ["dia", "hora_desde"]


class HorarioCatedra(models.Model):
    # Using Materia.TipoCursada.choices for consistency with regimen
    REGIMEN_CHOICES = Materia.TipoCursada.choices

    espacio = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="horarios_catedra")
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name="horarios_catedra")
    anio_academico = models.IntegerField(default=2025, help_text="Año académico (ej. 2025)")
    cuatrimestre = models.CharField(
        max_length=3, choices=REGIMEN_CHOICES, blank=True, null=True
    )  # C1, C2, or NULL for ANUAL

    def clean(self):
        super().clean()
        if self.cuatrimestre and self.espacio.regimen == "ANU":
            raise ValidationError(f"La materia '{self.espacio.nombre}' es ANUAL y no puede tener un horario asignado a un cuatrimestre específico ({self.get_cuatrimestre_display()}).")

    def __str__(self):
        return f"Horario de {self.espacio.nombre} - {self.anio_academico} ({self.turno.nombre})"

    class Meta:
        verbose_name = "Horario de Cátedra"
        verbose_name_plural = "Horarios de Cátedra"
        # A course can only have one schedule per turn/year/quarter
        unique_together = ("espacio", "turno", "anio_academico", "cuatrimestre")


class HorarioCatedraDetalle(models.Model):
    horario_catedra = models.ForeignKey(HorarioCatedra, on_delete=models.CASCADE, related_name="detalles")
    bloque = models.ForeignKey(Bloque, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.horario_catedra} - {self.bloque}"

    class Meta:
        verbose_name = "Detalle de Horario de Cátedra"
        verbose_name_plural = "Detalles de Horario de Cátedra"
        unique_together = (
            "horario_catedra",
            "bloque",
        )  # A block can only be assigned once per schedule


class Comision(models.Model):
    class Estado(models.TextChoices):
        ABIERTA = "ABI", "Abierta"
        CERRADA = "CER", "Cerrada"
        SUSPENDIDA = "SUS", "Suspendida"
        LICENCIA = "LIC", "En Licencia"

    class Rol(models.TextChoices):
        TITULAR = "TIT", "Titular"
        INTERINO = "INT", "Interino"
        SUPLENTE = "SUP", "Suplente"

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="comisiones")
    anio_lectivo = models.IntegerField(help_text="Año académico en el que se dicta la comisión")
    codigo = models.CharField(max_length=32, help_text="Identificador interno de la comisión")
    turno = models.ForeignKey(Turno, on_delete=models.PROTECT, related_name="comisiones")
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comisiones",
    )
    horario = models.ForeignKey(
        "HorarioCatedra",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comisiones",
    )
    cupo_maximo = models.IntegerField(null=True, blank=True)
    estado = models.CharField(max_length=3, choices=Estado.choices, default=Estado.ABIERTA)
    rol = models.CharField(max_length=3, choices=Rol.choices, default=Rol.TITULAR)
    orden = models.PositiveIntegerField(default=1, help_text="Orden de jerarquía/suplencia")
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Comisión"
        verbose_name_plural = "Comisiones"
        unique_together = ("materia", "anio_lectivo", "codigo", "docente", "rol", "orden")
        ordering = ["anio_lectivo", "materia__nombre", "codigo", "orden"]

    def __str__(self):
        return f"{self.materia.nombre} - {self.codigo} ({self.anio_lectivo})"


class StaffAsignacion(models.Model):
    class Rol(models.TextChoices):
        BEDEL = "bedel", "Bedel"
        COORDINADOR = "coordinador", "Coordinador"
        TUTOR = "tutor", "Tutor"
        CURSO_INTRO = "curso_intro", "Curso Introductorio"

    class Turno(models.TextChoices):
        MANANA = "manana", "Mañana"
        TARDE = "tarde", "Tarde"
        VESPERTINO = "vespertino", "Vespertino"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="asignaciones_profesorado",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="staff_asignaciones",
        null=True,
        blank=True,
        help_text="Profesorado asignado. Para tutores: vacío = todos los profesorados del turno.",
    )
    rol = models.CharField(max_length=20, choices=Rol.choices)
    # Requerido para tutores y bedeles. Vacío solo para coordinadores/otros.
    turno = models.CharField(
        max_length=12,
        choices=Turno.choices,
        null=True,
        blank=True,
        help_text="Turno que cubre. Requerido para tutores.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Asignación de staff"
        verbose_name_plural = "Asignaciones de staff"

    def __str__(self):
        turno_str = f" - {self.get_turno_display()}" if self.turno else ""
        prof_str = f" | {self.profesorado.nombre}" if self.profesorado_id else " | Todos los profesorados"
        return f"{self.user.username} ({self.get_rol_display()}{turno_str}{prof_str})"


class VentanaHabilitacion(models.Model):
    class Tipo(models.TextChoices):
        INSCRIPCION = "INSCRIPCION", "Inscripcion (general)"
        MESAS_FINALES = "MESAS_FINALES", "Mesas de examen - Finales"
        MESAS_EXTRA = "MESAS_EXTRA", "Mesas de examen - Extraordinarias"
        MATERIAS = "MATERIAS", "Inscripciones a Materias"
        CARRERAS = "CARRERAS", "Inscripciones a Carreras"
        COMISION = "COMISION", "Cambios de Comision"
        ANALITICOS = "ANALITICOS", "Pedidos de Analiticos"
        EQUIVALENCIAS = "EQUIVALENCIAS", "Pedidos de Equivalencias"
        PREINSCRIPCION = "PREINSCRIPCION", "Preinscripcion"
        CURSO_INTRODUCTORIO = "CURSO_INTRODUCTORIO", "Curso Introductorio"
        CALENDARIO_CUATRIMESTRE = (
            "CALENDARIO_CUATRIMESTRE",
            "Calendario academico - Cuatrimestres",
        )
        PLANILLA_REGULARIDAD = (
            "PLANILLA_REGULARIDAD",
            "Entrega de planillas de regularidad",
        )

    tipo = models.CharField(max_length=32, choices=Tipo.choices)
    desde = models.DateField()
    hasta = models.DateField()
    activo = models.BooleanField(default=False)
    periodo = models.CharField(
        max_length=16,
        null=True,
        blank=True,
        help_text="Solo para inscripciones a materias y calendario cuatrimestral: '1C_ANUALES', '2C', '1C' o '2C'.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_tipo_display()} ({self.desde} - {self.hasta}) {'[ACTIVO]' if self.activo else ''}"
