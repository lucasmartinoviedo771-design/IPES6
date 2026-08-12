import datetime

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from core.models import Docente


class Cargo(models.Model):
    class TipoCargo(models.TextChoices):
        HORAS_RELOJ = "horas_reloj", "Horas Reloj (bloque)"
        HORAS_CATEDRA = "horas_catedra", "Horas Cátedra"

    codigo_cargo = models.CharField(
        max_length=64,
        unique=True,
        help_text="Código institucional del cargo (ej: CARG-BEDEL-01, CARG-SEC-01).",
    )
    codigo_salarial = models.CharField(
        max_length=64,
        blank=True,
        help_text="Código salarial / de liquidación para pagos administrativos.",
    )
    nombre = models.CharField(
        max_length=255,
        help_text="Nombre descriptivo del cargo (ej: Bedelía Turno Mañana 01).",
    )
    tipo_cargo = models.CharField(
        max_length=32,
        choices=TipoCargo.choices,
        default=TipoCargo.HORAS_RELOJ,
    )
    duracion_minutos = models.PositiveIntegerField(
        default=260,
        help_text="Duración estándar en minutos por bloque (ej: 260 min = 4hs 20min).",
    )
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "asistencia_cargo"
        verbose_name = "Cargo"
        verbose_name_plural = "Cargos"
        ordering = ["codigo_cargo"]

    def __str__(self) -> str:
        salarial = f" [{self.codigo_salarial}]" if self.codigo_salarial else ""
        return f"{self.codigo_cargo} - {self.nombre}{salarial}"


class CargoDocente(models.Model):
    class SituacionRevista(models.TextChoices):
        TITULAR = "titular", "Titular"
        INTERINO = "interino", "Interino"
        SUPLENTE = "suplente", "Suplente"

    cargo = models.ForeignKey(
        Cargo,
        on_delete=models.CASCADE,
        related_name="asignaciones_docentes",
    )
    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name="cargos_asignados",
    )
    sit_revista = models.CharField(
        max_length=16,
        choices=SituacionRevista.choices,
        default=SituacionRevista.INTERINO,
    )
    fecha_inicio = models.DateField(default=datetime.date.today)
    fecha_fin = models.DateField(null=True, blank=True)
    resolucion = models.CharField(
        max_length=255,
        blank=True,
        help_text="Número o detalle de disposición/resolución administrativa.",
    )
    activo = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "asistencia_cargodocente"
        verbose_name = "Asignación de cargo a docente"
        verbose_name_plural = "Asignaciones de cargo a docentes"
        ordering = ["cargo", "-fecha_inicio"]

    def __str__(self) -> str:
        return f"{self.docente} → {self.cargo} ({self.get_sit_revista_display()})"


class HorarioCargo(models.Model):
    DIA_CHOICES = [
        (0, "Domingo"),
        (1, "Lunes"),
        (2, "Martes"),
        (3, "Miércoles"),
        (4, "Jueves"),
        (5, "Viernes"),
        (6, "Sábado"),
    ]

    cargo = models.ForeignKey(
        Cargo,
        on_delete=models.CASCADE,
        related_name="horarios",
    )
    dia_semana = models.PositiveSmallIntegerField(choices=DIA_CHOICES)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()

    class Meta:
        db_table = "asistencia_horariocargo"
        verbose_name = "Horario de cargo"
        verbose_name_plural = "Horarios de cargo"
        unique_together = ("cargo", "dia_semana", "hora_inicio", "hora_fin")
        ordering = ["dia_semana", "hora_inicio"]

    def __str__(self) -> str:
        return f"{self.cargo.codigo_cargo} - {self.get_dia_semana_display()} {self.hora_inicio.strftime('%H:%M')} a {self.hora_fin.strftime('%H:%M')}"

    def clean(self):
        super().clean()
        if self.hora_inicio and self.hora_fin and self.hora_fin <= self.hora_inicio:
            raise ValidationError("La hora de fin debe ser posterior a la hora de inicio.")


class AsistenciaCargoDocente(models.Model):
    class Estado(models.TextChoices):
        PRESENTE = "presente", "Presente"
        AUSENTE = "ausente", "Ausente"
        JUSTIFICADA = "justificada", "Ausente justificada"
        TARDE = "tarde", "Llegada tarde"

    cargo_docente = models.ForeignKey(
        CargoDocente,
        on_delete=models.CASCADE,
        related_name="asistencias",
    )
    horario = models.ForeignKey(
        HorarioCargo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_registradas",
    )
    fecha = models.DateField()
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PRESENTE,
    )
    observaciones = models.TextField(blank=True)
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_cargos_registradas",
    )
    registrado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "asistencia_asistenciacargodocente"
        verbose_name = "Asistencia a cargo docente"
        verbose_name_plural = "Asistencias a cargos docentes"
        unique_together = ("cargo_docente", "fecha")
        ordering = ["-fecha", "cargo_docente"]

    def __str__(self) -> str:
        return f"{self.cargo_docente.docente} - {self.cargo_docente.cargo.codigo_cargo} ({self.fecha}) : {self.estado}"


def validar_solapamiento_horario_docente(
    docente_id: int,
    dia_semana: int,
    hora_inicio: datetime.time,
    hora_fin: datetime.time,
    exclude_horario_cargo_id: int | None = None,
) -> tuple[bool, str | None]:
    """
    Verifica si un docente tiene solapamiento de horarios entre sus clases asignadas
    y sus cargos activos en la franja horaria solicitada para un dia_semana especifico.
    Se considera solapamiento cuando (hora_inicio < fin2) AND (hora_fin > inicio2).
    """
    from apps.asistencia.models import CursoHorarioSnapshot

    # 1. Verificar solapamiento con Horarios de Clase (Comisiones asignadas)
    clases_solapadas = CursoHorarioSnapshot.objects.filter(
        comision__docente_id=docente_id,
        dia_semana=dia_semana,
        hora_inicio__lt=hora_fin,
        hora_fin__gt=hora_inicio,
    ).select_related("comision", "comision__materia")

    if clases_solapadas.exists():
        clase = clases_solapadas.first()
        materia_nombre = clase.comision.materia.nombre if clase.comision and clase.comision.materia else "Clase asignada"
        return (
            True,
            f"El docente ya tiene una clase asignada ('{materia_nombre}', {clase.get_dia_semana_display()} {clase.hora_inicio.strftime('%H:%M')}-{clase.hora_fin.strftime('%H:%M')}) en ese horario.",
        )

    # 2. Verificar solapamiento con Otros Horarios de Cargo activos del Docente
    cargos_solapados = HorarioCargo.objects.filter(
        cargo__asignaciones_docentes__docente_id=docente_id,
        cargo__asignaciones_docentes__activo=True,
        dia_semana=dia_semana,
        hora_inicio__lt=hora_fin,
        hora_fin__gt=hora_inicio,
    ).select_related("cargo")

    if exclude_horario_cargo_id:
        cargos_solapados = cargos_solapados.exclude(id=exclude_horario_cargo_id)

    if cargos_solapados.exists():
        hc = cargos_solapados.first()
        return (
            True,
            f"El docente ya tiene el cargo '{hc.cargo.nombre}' ({hc.cargo.codigo_cargo}) asignado en ese mismo horario ({hc.get_dia_semana_display()} {hc.hora_inicio.strftime('%H:%M')}-{hc.hora_fin.strftime('%H:%M')}).",
        )

    return False, None
