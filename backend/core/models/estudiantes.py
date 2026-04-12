from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from .carreras import Documento, Profesorado


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
    folios_oficio = models.IntegerField(default=0)
    titulo_secundario_legalizado = models.BooleanField(default=False)
    certificado_titulo_en_tramite = models.BooleanField(default=False)
    analitico_legalizado = models.BooleanField(default=False)
    articulo_7 = models.BooleanField(default=False)

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
        if self.persona:
            return self.persona.nombre
        return self.user.first_name

    @property
    def apellido(self):
        if self.persona:
            return self.persona.apellido
        return self.user.last_name

    @property
    def email(self):
        if self.persona:
            return self.persona.email
        return self.user.email

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

    def __str__(self):
        return f"{self.estudiante.dni} → {self.profesorado.nombre}"
