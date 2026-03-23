from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from .base import Docente
from .carreras import Materia
from .estudiantes import Estudiante
from .horarios import VentanaHabilitacion


class MesaExamen(models.Model):
    class Tipo(models.TextChoices):
        FINAL = "FIN", "Ordinaria"
        EXTRAORDINARIA = "EXT", "Extraordinaria"
        ESPECIAL = "ESP", "Especial"

    class Modalidad(models.TextChoices):
        REGULAR = "REG", "Regular"
        LIBRE = "LIB", "Libre"

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="mesas")
    tipo = models.CharField(max_length=3, choices=Tipo.choices)
    modalidad = models.CharField(max_length=3, choices=Modalidad.choices, default=Modalidad.REGULAR)
    fecha = models.DateField()
    hora_desde = models.TimeField(null=True, blank=True)
    hora_hasta = models.TimeField(null=True, blank=True)
    aula = models.CharField(max_length=64, blank=True, null=True)
    cupo = models.IntegerField(default=0)
    ventana = models.ForeignKey(VentanaHabilitacion, on_delete=models.SET_NULL, null=True, blank=True)
    codigo = models.CharField(max_length=40, unique=True, blank=True, null=True)
    docente_presidente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mesas_como_presidente",
    )
    docente_vocal1 = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mesas_como_vocal1",
    )
    docente_vocal2 = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mesas_como_vocal2",
    )
    planilla_cerrada_en = models.DateTimeField(null=True, blank=True)
    planilla_cerrada_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mesas_planillas_cerradas",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Mesa {self.get_tipo_display()} {self.materia.nombre} {self.fecha}"

    def _build_codigo(self) -> str:
        fecha_ref = self.fecha or timezone.now().date()
        return f"MESA-{fecha_ref.strftime('%Y%m%d')}-{self.id:05d}"

    def save(self, *args, **kwargs):
        was_blank_codigo = not self.codigo
        super().save(*args, **kwargs)
        if self.codigo and not was_blank_codigo:
            return
        if not self.codigo:
            codigo = self._build_codigo()
            type(self).objects.filter(pk=self.pk).update(codigo=codigo)
            self.codigo = codigo


class InscripcionMesa(models.Model):
    class Estado(models.TextChoices):
        INSCRIPTO = "INS", "Inscripto"
        CANCELADO = "CAN", "Cancelado"

    class Condicion(models.TextChoices):
        APROBADO = "APR", "Aprobado"
        DESAPROBADO = "DES", "Desaprobado"
        AUSENTE = "AUS", "Ausente"
        AUSENTE_JUSTIFICADO = "AUJ", "Ausente justificado"

    mesa = models.ForeignKey(MesaExamen, on_delete=models.CASCADE, related_name="inscripciones")
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="inscripciones_mesa")
    estado = models.CharField(max_length=3, choices=Estado.choices, default=Estado.INSCRIPTO)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    fecha_resultado = models.DateField(null=True, blank=True)
    condicion = models.CharField(max_length=3, choices=Condicion.choices, null=True, blank=True)
    nota = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    folio = models.CharField(max_length=32, null=True, blank=True)
    libro = models.CharField(max_length=32, null=True, blank=True)
    observaciones = models.TextField(null=True, blank=True)
    cuenta_para_intentos = models.BooleanField(default=True)

    class Meta:
        unique_together = ("mesa", "estudiante")


class MesaActaOral(models.Model):
    mesa = models.ForeignKey(MesaExamen, on_delete=models.CASCADE, related_name="actas_orales")
    inscripcion = models.OneToOneField(
        InscripcionMesa, on_delete=models.CASCADE, related_name="acta_oral"
    )
    acta_numero = models.CharField(max_length=64, blank=True, default="")
    folio_numero = models.CharField(max_length=64, blank=True, default="")
    fecha = models.DateField(null=True, blank=True)
    curso = models.CharField(max_length=128, blank=True, default="")
    nota_final = models.CharField(max_length=32, blank=True, default="")
    observaciones = models.TextField(blank=True, default="")
    temas_alumno = models.JSONField(default=list, blank=True)
    temas_docente = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Acta de examen oral"
        verbose_name_plural = "Actas de examen oral"

    def __str__(self):
        return f"Acta oral {self.acta_numero or self.inscripcion_id}"
