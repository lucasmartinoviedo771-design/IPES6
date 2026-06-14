from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from .carreras import Documento, Profesorado, Materia


class Estudiante(models.Model):
    class EstadoLegajo(models.TextChoices):
        COMPLETO = "COM", "Completo"
        INCOMPLETO = "INC", "Incompleto / Condicional"
        PENDIENTE = "PEN", "Pendiente de Revisión"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="estudiante")
    persona = models.OneToOneField(
        "Persona",
        on_delete=models.CASCADE,
        related_name="estudiante_perfil",
        null=True,
        blank=True,
    )
    legajo = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Número de legajo único del estudiante",
    )
    carreras = models.ManyToManyField(
        Profesorado,
        through="EstudianteCarrera",
        related_name="estudiantes",
    )
    estado_legajo = models.CharField(max_length=3, choices=EstadoLegajo.choices, default=EstadoLegajo.PENDIENTE)
    must_change_password = models.BooleanField(
        default=False,
        help_text="Si está activo, el estudiante debe cambiar la contraseña al iniciar sesión.",
    )
    curso_introductorio_aprobado = models.BooleanField(
        default=False,
        help_text="Indica si tiene aprobado el Curso Introductorio.",
    )
    autorizado_rendir = models.BooleanField(
        default=False,
        help_text=(
            "Autorización excepcional para rendir exámenes finales con legajo incompleto. "
            "Solo puede ser activado por Secretaría o Bedelía."
        ),
    )
    autorizado_rendir_observacion = models.TextField(
        blank=True,
        null=True,
        help_text="Motivo o aclaración de la autorización excepcional.",
    )
    # Datos Académicos
    anio_ingreso = models.IntegerField(null=True, blank=True)
    cohorte = models.CharField(max_length=50, null=True, blank=True)
    observaciones = models.TextField(blank=True, null=True)
    libreta_entregada = models.BooleanField(default=False)
    materias_autorizadas = models.ManyToManyField(
        Materia,
        blank=True,
        related_name="estudiantes_autorizados",
        help_text="Materias específicas autorizadas excepcionalmente para rendir."
    )

    # Datos de Educación Secundaria
    sec_titulo = models.CharField(max_length=255, blank=True, null=True)
    sec_establecimiento = models.CharField(max_length=255, blank=True, null=True)
    sec_fecha_egreso = models.CharField(max_length=100, blank=True, null=True) # A veces no es una fecha exacta
    sec_localidad = models.CharField(max_length=150, blank=True, null=True)
    sec_provincia = models.CharField(max_length=150, blank=True, null=True)
    sec_pais = models.CharField(max_length=100, blank=True, null=True)

    # Datos Laborales y Salud
    trabaja = models.BooleanField(default=False)
    empleador = models.CharField(max_length=255, blank=True, null=True)
    horario_trabajo = models.CharField(max_length=255, blank=True, null=True)
    domicilio_trabajo = models.CharField(max_length=255, blank=True, null=True)
    cud_informado = models.BooleanField(default=False)
    condicion_salud_informada = models.BooleanField(default=False)
    condicion_salud_detalle = models.TextField(blank=True, null=True)

    # Flags de Documentación (Migrados de datos_extra)
    dni_legalizado = models.BooleanField(default=False)
    fotos_4x4 = models.BooleanField(default=False)
    certificado_salud = models.BooleanField(default=False)
    folios_oficio = models.BooleanField(default=False)
    titulo_secundario_legalizado = models.BooleanField(default=False)
    certificado_titulo_en_tramite = models.BooleanField(default=False)
    analitico_legalizado = models.BooleanField(default=False)
    articulo_7 = models.BooleanField(default=False)

    # Nuevos campos de documentación para persistencia total
    adeuda_materias = models.BooleanField(default=False)
    adeuda_materias_detalle = models.TextField(blank=True, default="")
    escuela_secundaria = models.CharField(max_length=255, blank=True, default="")
    certificado_alumno_regular_sec = models.BooleanField(default=False)
    es_certificacion_docente = models.BooleanField(default=False)
    titulo_terciario_univ = models.BooleanField(default=False)
    incumbencia = models.BooleanField(default=False)

    datos_extra = models.JSONField(default=dict, blank=True)
    documentacion_presentada = models.ManyToManyField(Documento, blank=True, related_name="estudiantes_que_presentaron")

    @property
    def dni(self):
        return self.persona.dni if self.persona else ""

    @property
    def fecha_nacimiento(self):
        return self.persona.fecha_nacimiento if self.persona else None

    @property
    def telefono(self):
        return self.persona.telefono if self.persona else ""

    @property
    def domicilio(self):
        return self.persona.domicilio if self.persona else ""

    def __str__(self):
        if self.persona:
            return f"{self.persona.apellido}, {self.persona.nombre} (DNI: {self.persona.dni})"
        return f"Estudiante sin persona vinculada (ID: {self.id})"

    @property
    def dni_clean(self):
        return self.persona.dni if self.persona else self.dni

    @property
    def nombre(self):
        return self.persona.nombre if self.persona else ""

    @property
    def apellido(self):
        return self.persona.apellido if self.persona else ""

    @property
    def email(self):
        return self.persona.email if self.persona else ""

    @property
    def telefono_clean(self):
        return self.persona.telefono if self.persona else self.telefono

    @property
    def domicilio_clean(self):
        return self.persona.domicilio if self.persona else self.domicilio

    def asignar_profesorado(
        self,
        profesorado: Profesorado,
        *,
        anio_ingreso: int | None = None,
        cohorte: str | None = None,
    ) -> "EstudianteCarrera":
        defaults: dict[str, object] = {}
        if anio_ingreso is not None:
            defaults["anio_ingreso"] = anio_ingreso
        if cohorte:
            defaults["cohorte"] = cohorte
        if not defaults:
            defaults["updated_at"] = timezone.now()
        registro, _ = EstudianteCarrera.objects.update_or_create(
            estudiante=self,
            profesorado=profesorado,
            defaults=defaults,
        )
        return registro

    def obtener_anio_ingreso(self, profesorado_id: int) -> int | None:
        detalle = (
            self.carreras_detalle.filter(profesorado_id=profesorado_id)
            .order_by("-updated_at")
            .first()
        )
        return detalle.anio_ingreso if detalle else None

    def obtener_cohorte(self, profesorado_id: int) -> str | None:
        detalle = (
            self.carreras_detalle.filter(profesorado_id=profesorado_id)
            .order_by("-updated_at")
            .first()
        )
        return detalle.cohorte if detalle and detalle.cohorte else None


class EstudianteCarrera(models.Model):
    class EstadoAcademico(models.TextChoices):
        ACTIVO = "ACT", "Activo"
        BAJA = "BAJ", "Baja / Abandono"
        EGRESADO = "EGR", "Egresado"
        SUSPENDIDO = "SUS", "Suspendido"
        INACTIVO = "INA", "Inactivo"

    estudiante = models.ForeignKey(
        "Estudiante",
        on_delete=models.CASCADE,
        related_name="carreras_detalle",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="estudiantes_detalle",
    )
    anio_ingreso = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Año de ingreso/cohorte del estudiante en este profesorado.",
    )
    cohorte = models.CharField(max_length=32, blank=True, default="")
    estado_academico = models.CharField(
        max_length=3,
        choices=EstadoAcademico.choices,
        default=EstadoAcademico.ACTIVO,
        help_text="Estado académico del estudiante en esta carrera.",
    )
    estado_academico_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha y hora de la última transición de estado académico.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # --- Documentación del legajo por carrera ---
    class EstadoLegajo(models.TextChoices):
        COMPLETO = "COM", "Completo"
        INCOMPLETO = "INC", "Incompleto / Condicional"
        PENDIENTE = "PEN", "Pendiente de Revisión"

    estado_legajo = models.CharField(
        max_length=3,
        choices=EstadoLegajo.choices,
        default=EstadoLegajo.PENDIENTE,
        help_text="Estado del legajo físico del estudiante para esta carrera.",
    )
    curso_introductorio_aprobado = models.BooleanField(default=False)
    libreta_entregada = models.BooleanField(default=False)
    dni_legalizado = models.BooleanField(default=False)
    fotos_4x4 = models.BooleanField(default=False)
    certificado_salud = models.BooleanField(default=False)
    folios_oficio = models.BooleanField(default=False)
    titulo_secundario_legalizado = models.BooleanField(default=False)
    certificado_titulo_en_tramite = models.BooleanField(default=False)
    analitico_legalizado = models.BooleanField(default=False)
    articulo_7 = models.BooleanField(default=False)
    adeuda_materias = models.BooleanField(default=False)
    adeuda_materias_detalle = models.TextField(blank=True, default="")
    escuela_secundaria = models.CharField(max_length=255, blank=True, default="")
    certificado_alumno_regular_sec = models.BooleanField(default=False)
    es_certificacion_docente = models.BooleanField(default=False)
    titulo_terciario_univ = models.BooleanField(default=False)
    incumbencia = models.BooleanField(default=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_estado = self.estado_academico

    def save(self, *args, **kwargs):
        if self.pk:
            if self._original_estado != self.estado_academico:
                self.estado_academico_changed_at = timezone.now()
        elif not self.estado_academico_changed_at:
            # Caso de creación inicial
            self.estado_academico_changed_at = timezone.now()
        
        super().save(*args, **kwargs)
        self._original_estado = self.estado_academico

    class Meta:
        unique_together = ("estudiante", "profesorado")
        verbose_name = "Asignación estudiante-profesorado"
        verbose_name_plural = "Asignaciones estudiante-profesorado"
        indexes = [
            models.Index(fields=["estado_academico", "profesorado"]),
        ]

    def __str__(self):
        return f"{self.estudiante.dni} → {self.profesorado.nombre}"


class ProrrogaTituloSecundario(models.Model):
    """
    Prórroga individual autorizada para la entrega del título secundario.
    Mientras la prórroga esté vigente, el estudiante puede rendir exámenes
    aunque el título no esté en el legajo.
    """
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.CASCADE,
        related_name="prorrogas_titulo",
    )
    fecha_otorgada = models.DateField()
    fecha_vencimiento = models.DateField()
    autorizado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prorrogas_otorgadas",
    )
    observaciones = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-fecha_vencimiento"]
        verbose_name = "Prórroga título secundario"
        verbose_name_plural = "Prórrogas título secundario"

    def __str__(self):
        return f"Prórroga {self.estudiante.dni} — vence {self.fecha_vencimiento}"

    @property
    def vigente(self) -> bool:
        from django.utils import timezone
        return self.fecha_vencimiento >= timezone.localdate()

    @property
    def dias_restantes(self) -> int:
        from django.utils import timezone
        return (self.fecha_vencimiento - timezone.localdate()).days


class ResidenciaCondicional(models.Model):
    """
    Inscripción condicional a Residencia (Práctica IV / Talleres de Residencia).
    El estudiante adeuda exactamente una materia de años anteriores y acepta
    la condición de aprobarla en las mesas extraordinarias de mayo.
    Si al 01/06 no la aprobó, la cursada de Residencia cae automáticamente.
    """
    estudiante = models.ForeignKey(
        Estudiante,
        on_delete=models.CASCADE,
        related_name="residencias_condicionales",
    )
    materia_residencia = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="inscripciones_condicionales",
        help_text="Materia de Residencia en la que se inscribió condicionalmente.",
    )
    materia_pendiente = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="residencias_condicionales_pendientes",
        help_text="La única materia que adeuda y debe aprobar en mayo.",
    )
    ciclo_lectivo = models.PositiveIntegerField(help_text="Año lectivo de la inscripción condicional.")
    fecha_limite = models.DateField(help_text="01/06 del ciclo lectivo — fecha límite para aprobar.")
    aceptada_en = models.DateTimeField(auto_now_add=True)
    autorizado_por = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="residencias_condicionales_autorizadas",
    )
    resuelta = models.BooleanField(
        default=False,
        help_text="True cuando el estudiante aprobó la materia pendiente antes del límite.",
    )
    caida = models.BooleanField(
        default=False,
        help_text="True cuando venció el plazo sin aprobar y la Residencia cayó.",
    )

    class Meta:
        ordering = ["-ciclo_lectivo", "estudiante"]
        verbose_name = "Residencia condicional"
        verbose_name_plural = "Residencias condicionales"
        unique_together = ("estudiante", "materia_residencia", "ciclo_lectivo")

    def __str__(self):
        return f"{self.estudiante.dni} — {self.materia_residencia.nombre} ({self.ciclo_lectivo}) cond:{self.materia_pendiente.nombre}"

    @property
    def vigente(self) -> bool:
        from datetime import date
        return not self.resuelta and not self.caida and date.today() <= self.fecha_limite
