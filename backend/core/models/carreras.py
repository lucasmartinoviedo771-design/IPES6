from django.db import models
from django.db.models import Q


class Profesorado(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    duracion_anios = models.IntegerField(help_text="Duración de la carrera en años")
    activo = models.BooleanField(default=True)
    inscripcion_abierta = models.BooleanField(default=True)
    es_certificacion_docente = models.BooleanField(default=False)

    def __str__(self):
        return self.nombre


class PlanDeEstudio(models.Model):
    profesorado = models.ForeignKey(Profesorado, on_delete=models.CASCADE, related_name="planes")
    resolucion = models.CharField(
        max_length=100,
        unique=True,
        help_text="Número de resolución o normativa del plan",
    )
    anio_inicio = models.IntegerField(help_text="Año en que el plan entró en vigencia")
    anio_fin = models.IntegerField(
        null=True,
        blank=True,
        help_text="Año en que el plan dejó de estar vigente (opcional)",
    )
    vigente = models.BooleanField(default=True, help_text="Indica si este plan de estudio está actualmente en uso")

    def __str__(self):
        return f"{self.profesorado.nombre} - Plan {self.resolucion}"


class Materia(models.Model):
    class FormatoMateria(models.TextChoices):
        ASIGNATURA = "ASI", "Asignatura"
        PRACTICA = "PRA", "Práctica"
        MODULO = "MOD", "Módulo"
        TALLER = "TAL", "Taller"
        LABORATORIO = "LAB", "Laboratorio"
        SEMINARIO = "SEM", "Seminario"

    class TipoCursada(models.TextChoices):
        ANUAL = "ANU", "Anual"
        PRIMER_CUATRIMESTRE = "PCU", "Primer Cuatrimestre"
        SEGUNDO_CUATRIMESTRE = "SCU", "Segundo Cuatrimestre"

    class TipoFormacion(models.TextChoices):
        FORMACION_GENERAL = "FGN", "Formación general"
        FORMACION_ESPECIFICA = "FES", "Formación específica"
        PRACTICA_DOCENTE = "PDC", "Práctica docente"

    plan_de_estudio = models.ForeignKey(PlanDeEstudio, on_delete=models.CASCADE, related_name="materias")
    nombre = models.CharField(max_length=255)
    anio_cursada = models.IntegerField(help_text="Año de la carrera al que pertenece la materia (1, 2, 3, 4, ...)")
    horas_semana = models.IntegerField(default=0, help_text="Carga horaria semanal requerida")  # New field
    formato = models.CharField(max_length=3, choices=FormatoMateria.choices)
    regimen = models.CharField(
        max_length=3, choices=TipoCursada.choices, default=TipoCursada.ANUAL
    )  # Replaced tipo_cursada with regimen
    tipo_formacion = models.CharField(
        max_length=3,
        choices=TipoFormacion.choices,
        default=TipoFormacion.FORMACION_GENERAL,
        help_text="Clasificación pedagógica de la materia.",
    )
    is_edi = models.BooleanField(
        default=False,
        verbose_name="Es EDI",
        help_text="Indica si esta materia es un Espacio de Definición Institucional",
    )
    fecha_inicio = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de inicio",
        help_text="Fecha en que este EDI comenzó a estar vigente.",
    )
    fecha_fin = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de cierre",
        help_text="Fecha en que este EDI dejó de estar vigente. Null = activo.",
    )


    class Meta:
        unique_together = ("plan_de_estudio", "anio_cursada", "nombre", "regimen", "fecha_inicio")
        ordering = ["anio_cursada", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.anio_cursada}° Año) - Plan: {self.plan_de_estudio.resolucion}"

    @property
    def permite_mesa_libre(self) -> bool:
        from core.libre_config import materia_permite_mesa_libre

        return materia_permite_mesa_libre(self)


class Correlatividad(models.Model):
    class TipoCorrelatividad(models.TextChoices):
        REGULAR_PARA_CURSAR = "RPC", "Regular para Cursar"
        APROBADA_PARA_CURSAR = "APC", "Aprobada para Cursar"
        APROBADA_PARA_RENDIR = "APR", "Aprobada para Rendir Final"

    materia_origen = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="correlativas_requeridas",
        help_text="Materia que requiere la correlatividad (ej: Didáctica II)",
    )
    materia_correlativa = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="es_correlativa_de",
        help_text="Materia que debe ser aprobada/regularizada (ej: Pedagogía)",
    )
    tipo = models.CharField(max_length=3, choices=TipoCorrelatividad.choices)

    def __str__(self):
        return f"{self.materia_origen.nombre} requiere {self.materia_correlativa.nombre} como {self.get_tipo_display()}"

    class Meta:
        unique_together = ("materia_origen", "materia_correlativa", "tipo")


class CorrelatividadVersionQuerySet(models.QuerySet):
    def vigente_para(self, plan_id: int, profesorado_id: int, cohorte: int | None):
        qs = self.filter(
            plan_de_estudio_id=plan_id,
            profesorado_id=profesorado_id,
            activo=True,
        )
        if cohorte is None:
            return qs.order_by("cohorte_desde").last()
        return (
            qs.filter(
                cohorte_desde__lte=cohorte,
            )
            .filter(Q(cohorte_hasta__isnull=True) | Q(cohorte_hasta__gte=cohorte))
            .order_by("-cohorte_desde")
            .first()
        )


class CorrelatividadVersion(models.Model):
    plan_de_estudio = models.ForeignKey(
        PlanDeEstudio,
        on_delete=models.CASCADE,
        related_name="correlatividad_versiones",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="correlatividad_versiones",
    )
    nombre = models.CharField(max_length=255, help_text="Etiqueta para identificar la planilla (ej. Default 2023+).")
    descripcion = models.TextField(blank=True, default="")
    cohorte_desde = models.PositiveIntegerField(help_text="Año de cohorte inicial (inclusive).")
    cohorte_hasta = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Año de cohorte final (inclusive). Dejar vacío para aplicar en adelante.",
    )
    vigencia_desde = models.DateField(null=True, blank=True, help_text="Fecha en la que comienza a regir esta versión.")
    vigencia_hasta = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha en la que deja de aplicarse esta versión (opcional).",
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    objects = CorrelatividadVersionQuerySet.as_manager()

    class Meta:
        ordering = ["plan_de_estudio_id", "cohorte_desde"]
        unique_together = ("plan_de_estudio", "nombre")

    def __str__(self) -> str:
        rango = f"{self.cohorte_desde}+" if self.cohorte_hasta is None else f"{self.cohorte_desde}-{self.cohorte_hasta}"
        return f"{self.plan_de_estudio} · {self.nombre} ({rango})"

    @classmethod
    def vigente_para(cls, plan_id: int, profesorado_id: int, cohorte: int | None):
        return cls.objects.vigente_para(plan_id, profesorado_id, cohorte)


class CorrelatividadVersionDetalle(models.Model):
    version = models.ForeignKey(
        CorrelatividadVersion,
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    correlatividad = models.ForeignKey(
        Correlatividad,
        on_delete=models.CASCADE,
        related_name="versiones",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("version", "correlatividad")

    def __str__(self) -> str:
        return f"{self.version}: {self.correlatividad}"


class Documento(models.Model):
    nombre = models.CharField(max_length=255, unique=True)
    obligatorio = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre
