import datetime

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import Comision, Docente, Estudiante, PlanDeEstudio, Profesorado, Turno


class CursoHorarioSnapshot(models.Model):
    """Copia local del horario de una comisión para el módulo de asistencia."""

    DIA_CHOICES = [
        (0, "Domingo"),
        (1, "Lunes"),
        (2, "Martes"),
        (3, "Miércoles"),
        (4, "Jueves"),
        (5, "Viernes"),
        (6, "Sábado"),
    ]

    comision = models.ForeignKey(
        Comision,
        on_delete=models.CASCADE,
        related_name="asistencia_horarios",
    )
    dia_semana = models.PositiveSmallIntegerField(choices=DIA_CHOICES)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    origen_id = models.CharField(
        max_length=64,
        blank=True,
        help_text="Identificador de referencia del sistema fuente.",
    )
    sincronizado_en = models.DateTimeField(
        auto_now=True,
        help_text="Fecha de la última sincronización del horario.",
    )

    class Meta:
        verbose_name = "Horario de curso (snapshot)"
        verbose_name_plural = "Horarios de curso (snapshot)"
        unique_together = ("comision", "dia_semana", "hora_inicio", "hora_fin")

    def __str__(self) -> str:
        return f"{self.comision} - {self.get_dia_semana_display()} {self.hora_inicio} - {self.hora_fin}"


class CursoAlumnoSnapshot(models.Model):
    """Relación alumno-curso utilizada por el módulo sin depender del sistema externo."""

    comision = models.ForeignKey(
        Comision,
        on_delete=models.CASCADE,
        related_name="asistencia_alumnos",
    )
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencia_comisiones",
    )
    dni = models.CharField(max_length=16)
    apellido = models.CharField(max_length=128)
    nombre = models.CharField(max_length=128)
    activo = models.BooleanField(default=True)
    sincronizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Alumno de curso (snapshot)"
        verbose_name_plural = "Alumnos de curso (snapshot)"
        unique_together = ("comision", "dni")

    def __str__(self) -> str:
        return f"{self.apellido}, {self.nombre} - {self.comision}"


class ClaseProgramada(models.Model):
    class Estado(models.TextChoices):
        PROGRAMADA = "programada", "Programada"
        EN_CURSO = "en_curso", "En curso"
        IMPARTIDA = "impartida", "Impartida"
        CANCELADA = "cancelada", "Cancelada"

    comision = models.ForeignKey(
        Comision,
        on_delete=models.CASCADE,
        related_name="clases_programadas",
    )
    fecha = models.DateField()
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clases_asignadas_asistencia",
    )
    docente_dni = models.CharField(max_length=20, blank=True)
    docente_nombre = models.CharField(
        max_length=255,
        blank=True,
        help_text="Snapshot amigable del docente asignado al momento de crear la clase.",
    )
    estado = models.CharField(
        max_length=20,
        choices=Estado.choices,
        default=Estado.PROGRAMADA,
    )
    notas = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Clase programada"
        verbose_name_plural = "Clases programadas"
        indexes = [
            models.Index(fields=["fecha"]),
            models.Index(fields=["comision", "fecha"]),
        ]
        unique_together = ("comision", "fecha", "hora_inicio", "hora_fin")

    def __str__(self) -> str:
        return f"{self.comision} - {self.fecha}"


class Justificacion(models.Model):
    class Tipo(models.TextChoices):
        ESTUDIANTE = "estudiante", "Estudiante"
        DOCENTE = "docente", "Docente"

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"

    class Origen(models.TextChoices):
        ANTICIPADA = "anticipada", "Anticipada"
        POSTERIOR = "posterior", "Posterior"

    tipo = models.CharField(max_length=16, choices=Tipo.choices)
    estado = models.CharField(
        max_length=16,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
    )
    motivo = models.CharField(max_length=255)
    observaciones = models.TextField(blank=True)
    archivo_url = models.URLField(blank=True)
    vigencia_desde = models.DateField()
    vigencia_hasta = models.DateField()
    origen = models.CharField(max_length=12, choices=Origen.choices)
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="justificaciones_creadas",
    )
    aprobado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="justificaciones_aprobadas",
    )
    aprobado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Justificación"
        verbose_name_plural = "Justificaciones"
        ordering = ["-creado_en"]

    def __str__(self) -> str:
        return f"{self.get_tipo_display()} - {self.motivo} ({self.estado})"

    def marcar_aprobada(self, usuario):
        self.estado = self.Estado.APROBADA
        self.aprobado_por = usuario
        self.aprobado_en = timezone.now()
        self.save(update_fields=["estado", "aprobado_por", "aprobado_en", "actualizado_en"])

    def marcar_rechazada(self, usuario, *, observaciones: str | None = None):
        self.estado = self.Estado.RECHAZADA
        self.aprobado_por = usuario
        self.aprobado_en = timezone.now()
        if observaciones:
            self.observaciones = observaciones
        self.save(
            update_fields=[
                "estado",
                "aprobado_por",
                "aprobado_en",
                "observaciones",
                "actualizado_en",
            ]
        )


class JustificacionDetalle(models.Model):
    justificacion = models.ForeignKey(
        Justificacion,
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    clase = models.ForeignKey(
        ClaseProgramada,
        on_delete=models.CASCADE,
        related_name="justificaciones",
    )
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="justificaciones_asistencia",
    )
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="justificaciones_asistencia",
    )
    aplica_automaticamente = models.BooleanField(
        default=True,
        help_text="Si está activo, al aprobar la justificación se marcará automáticamente la ausencia como justificada.",
    )

    class Meta:
        verbose_name = "Detalle de justificación"
        verbose_name_plural = "Detalles de justificación"
        constraints = [
            models.UniqueConstraint(
                fields=["justificacion", "clase", "estudiante"],
                name="unique_justificacion_clase_estudiante",
            ),
            models.UniqueConstraint(
                fields=["justificacion", "clase", "docente"],
                name="unique_justificacion_clase_docente",
            ),
        ]

    def __str__(self) -> str:
        target = self.estudiante or self.docente
        return f"{self.justificacion} → {target} ({self.clase})"


class AsistenciaAlumno(models.Model):
    class Estado(models.TextChoices):
        PRESENTE = "presente", "Presente"
        AUSENTE = "ausente", "Ausente"
        AUSENTE_JUSTIFICADA = "ausente_justificada", "Ausente justificada"
        TARDE = "tarde", "Tarde"

    class RegistradoVia(models.TextChoices):
        DOCENTE = "docente", "Docente"
        STAFF = "staff", "Staff"
        SISTEMA = "sistema", "Sistema"

    clase = models.ForeignKey(
        ClaseProgramada,
        on_delete=models.CASCADE,
        related_name="asistencias_estudiantes",
    )
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.CASCADE,
        related_name="asistencias",
    )
    estado = models.CharField(max_length=24, choices=Estado.choices, default=Estado.AUSENTE)
    justificacion = models.ForeignKey(
        Justificacion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_estudiantes",
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_estudiantes_registradas",
    )
    registrado_via = models.CharField(
        max_length=12,
        choices=RegistradoVia.choices,
        default=RegistradoVia.DOCENTE,
    )
    registrado_en = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True)

    class Meta:
        verbose_name = "Asistencia de estudiante"
        verbose_name_plural = "Asistencias de estudiantes"
        unique_together = ("clase", "estudiante")
        indexes = [
            models.Index(fields=["clase", "estado"]),
            models.Index(fields=["estudiante", "estado"]),
        ]

    def __str__(self) -> str:
        return f"{self.estudiante} - {self.clase} ({self.estado})"


class AsistenciaDocente(models.Model):
    class Estado(models.TextChoices):
        PRESENTE = "presente", "Presente"
        AUSENTE = "ausente", "Ausente"
        JUSTIFICADA = "justificada", "Justificada"

    class RegistradoVia(models.TextChoices):
        DOCENTE = "docente", "Docente (autoregistro)"
        STAFF = "staff", "Staff administrativo"
        SISTEMA = "sistema", "Sistema"

    class MarcacionCategoria(models.TextChoices):
        NORMAL = "normal", "Normal"
        TARDE = "tarde", "Llegada tarde"
        DIFERIDA = "diferida", "Carga diferida"

    clase = models.ForeignKey(
        ClaseProgramada,
        on_delete=models.CASCADE,
        related_name="asistencia_docentes",
    )
    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name="asistencias_docentes",
    )
    estado = models.CharField(max_length=16, choices=Estado.choices, default=Estado.PRESENTE)
    justificacion = models.ForeignKey(
        Justificacion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_docentes",
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="asistencias_docentes_registradas",
    )
    registrado_via = models.CharField(
        max_length=12,
        choices=RegistradoVia.choices,
        default=RegistradoVia.DOCENTE,
    )
    registrado_en = models.DateTimeField(auto_now_add=True)
    observaciones = models.TextField(blank=True)
    marcada_en_turno = models.CharField(
        max_length=64,
        blank=True,
        help_text="Nombre del turno al momento de registrar la asistencia.",
    )
    marcacion_categoria = models.CharField(
        max_length=12,
        choices=MarcacionCategoria.choices,
        default=MarcacionCategoria.NORMAL,
    )
    alerta = models.BooleanField(default=False)
    alerta_tipo = models.CharField(max_length=32, blank=True)
    alerta_motivo = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = "Asistencia de docente"
        verbose_name_plural = "Asistencias de docentes"
        unique_together = ("clase", "docente")
        indexes = [
            models.Index(fields=["clase"]),
            models.Index(fields=["docente", "estado"]),
            models.Index(fields=["docente", "registrado_en"]),
        ]

    def __str__(self) -> str:
        return f"{self.docente} - {self.clase} ({self.estado})"


class DocenteMarcacionLog(models.Model):
    class Resultado(models.TextChoices):
        TYPING = "typing", "Ingreso parcial"
        ACEPTADO = "aceptado", "Marcación aceptada"
        RECHAZADO = "rechazado", "Marcación rechazada"

    dni = models.CharField(max_length=20)
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marcaciones_log",
    )
    clase = models.ForeignKey(
        ClaseProgramada,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="marcaciones_log",
    )
    resultado = models.CharField(max_length=16, choices=Resultado.choices)
    detalle = models.CharField(max_length=255, blank=True)
    alerta = models.BooleanField(default=False)
    registrado_en = models.DateTimeField(auto_now_add=True)
    origen = models.CharField(
        max_length=32,
        blank=True,
        help_text="Identificador del origen (ej. kiosk).",
    )

    class Meta:
        verbose_name = "Log de marcación docente"
        verbose_name_plural = "Logs de marcación docente"
        ordering = ["-registrado_en"]
        indexes = [
            models.Index(fields=["dni", "registrado_en"]),
            models.Index(fields=["resultado"]),
        ]

    def __str__(self) -> str:
        return f"{self.dni} - {self.resultado} ({self.registrado_en:%Y-%m-%d %H:%M:%S})"
class CalendarioAsistenciaEvento(models.Model):
    class Tipo(models.TextChoices):
        FERIADO = "feriado", "Feriado"
        SUSPENSION = "suspension", "Suspensión de actividades"
        LICENCIA = "licencia", "Licencia institucional"
        RECESO = "receso", "Feria/Receso sin asistencia"

    class Subtipo(models.TextChoices):
        GENERAL = "general", "General"
        INVIERNO = "licencia_invierno", "Licencia especial de invierno"
        ANUAL = "licencia_anual", "Licencia anual reglamentaria (LAR)"
        DOCENTE = "licencia_docente", "Licencia docente individual"
        FERIA = "feria_academica", "Feria / periodo sin asistencia"
        PERIODO = "periodo_sin_asistencia", "Periodo sin toma de asistencia"
        OTRO = "otro", "Otro"

    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=20, choices=Tipo.choices, default=Tipo.FERIADO)
    subtipo = models.CharField(max_length=32, choices=Subtipo.choices, default=Subtipo.GENERAL)
    fecha_desde = models.DateField()
    fecha_hasta = models.DateField()
    turno = models.ForeignKey(
        Turno,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="eventos_asistencia",
        help_text="Opcional. Limita el evento a un turno específico.",
    )
    aplica_docentes = models.BooleanField(default=True)
    aplica_estudiantes = models.BooleanField(default=True)
    motivo = models.TextField(blank=True)
    activo = models.BooleanField(default=True)
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="eventos_asistencia",
        help_text="Opcional. Limita el evento a un profesorado.",
    )
    plan = models.ForeignKey(
        PlanDeEstudio,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="eventos_asistencia",
        help_text="Opcional. Limita el evento a un plan de estudio.",
    )
    comision = models.ForeignKey(
        Comision,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="eventos_calendario",
        help_text="Opcional. Limita el evento a una comision/catedra.",
    )
    docente = models.ForeignKey(
        Docente,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_calendario",
        help_text="Asigna un docente cuando se trate de licencias particulares (LAR, invierno, etc.).",
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_asistencia_creados",
    )
    actualizado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="eventos_asistencia_actualizados",
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Evento de calendario de asistencia"
        verbose_name_plural = "Eventos de calendario de asistencia"
        indexes = [
            models.Index(fields=["fecha_desde", "fecha_hasta"]),
            models.Index(fields=["tipo"]),
            models.Index(fields=["turno"]),
            models.Index(fields=["activo"]),
            models.Index(fields=["docente"]),
            models.Index(fields=["profesorado"]),
            models.Index(fields=["plan"]),
            models.Index(fields=["comision"]),
        ]
        ordering = ["-fecha_desde", "-fecha_hasta"]

    def __str__(self) -> str:
        destino = "general"
        if self.comision_id:
            destino = f"Comisión {self.comision.codigo}"
        elif self.plan_id:
            destino = f"Plan {self.plan.resolucion}"
        elif self.profesorado_id:
            destino = self.profesorado.nombre
        elif self.turno_id:
            destino = self.turno.nombre
        return f"{self.get_tipo_display()} {self.nombre} ({destino})"

    def cubre_fecha(self, fecha: datetime.date | datetime.datetime, turno_id: int | None = None) -> bool:
        if isinstance(fecha, datetime.datetime):
            fecha = fecha.date()
        if fecha < self.fecha_desde or fecha > self.fecha_hasta:
            return False
        if self.turno_id and turno_id and self.turno_id != turno_id:
            return False
        if self.turno_id and turno_id is None:
            return False
        return True

    def aplica_a_contexto(self, *, contexto: dict[str, int | None] | None = None) -> bool:
        if contexto is None:
            return True
        if self.docente_id and contexto.get("docente_id") != self.docente_id:
            return False
        if self.comision_id and contexto.get("comision_id") != self.comision_id:
            return False
        if self.plan_id and contexto.get("plan_id") != self.plan_id:
            return False
        if self.profesorado_id and contexto.get("profesorado_id") != self.profesorado_id:
            return False
        return True
