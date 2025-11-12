from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Profesorado(models.Model):
    id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=255)
    duracion_anios = models.IntegerField(help_text="Duración de la carrera en años")
    activo = models.BooleanField(default=True)
    inscripcion_abierta = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre


# --- Modelos de Preinscripción (No Gestionados) ---


class Preinscripcion(models.Model):
    ESTADOS = (
        ("Enviada", "Enviada"),
        ("Observada", "Observada"),
        ("Confirmada", "Confirmada"),
        ("Rechazada", "Rechazada"),
        ("Borrador", "Borrador"),
    )
    id = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=30)
    estado = models.CharField(max_length=15, choices=ESTADOS, default="Enviada")
    alumno = models.ForeignKey("Estudiante", on_delete=models.CASCADE)  # Vinculado a Estudiante
    carrera = models.ForeignKey(Profesorado, on_delete=models.PROTECT)
    anio = models.IntegerField()  # Año de la preinscripción
    datos_extra = models.JSONField(default=dict, blank=True)
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    cuil = models.CharField(
        max_length=13,
        blank=True,
        null=True,
        validators=[
            RegexValidator(
                r"^\d{2}-\d{8}-\d{1}",
                message="El CUIL debe tener el formato XX-XXXXXXXX-X.",
            )
        ],
    )

    def __str__(self):
        return f"Preinscripción {self.codigo} para {self.alumno}"

    class Meta:
        managed = True
        db_table = "preinscripciones"
        unique_together = ("alumno", "carrera", "anio")


# --- Otros Modelos Gestionados ---


class Documento(models.Model):
    nombre = models.CharField(max_length=255, unique=True)
    obligatorio = models.BooleanField(default=True)

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


class Docente(models.Model):
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    dni = models.CharField(max_length=20, unique=True, help_text="DNI del docente")
    email = models.EmailField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    cuil = models.CharField(
        max_length=13,
        unique=True,
        null=True,
        blank=True,
        help_text="CUIL sin guiones (opcional)",
    )

    def __str__(self):
        return f"{self.apellido}, {self.nombre} (DNI: {self.dni})"


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

    class Meta:
        unique_together = ("plan_de_estudio", "anio_cursada", "nombre")
        ordering = ["anio_cursada", "nombre"]

    def __str__(self):
        return f"{self.nombre} ({self.anio_cursada}° Año) - Plan: {self.plan_de_estudio.resolucion}"

    @property
    def permite_mesa_libre(self) -> bool:
        from .libre_config import materia_permite_mesa_libre

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


class Estudiante(models.Model):
    class EstadoLegajo(models.TextChoices):
        COMPLETO = "COM", "Completo"
        INCOMPLETO = "INC", "Incompleto / Condicional"
        PENDIENTE = "PEN", "Pendiente de Revisión"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="estudiante")
    legajo = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        help_text="Número de legajo único del estudiante",
    )
    dni = models.CharField(max_length=10, unique=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    domicilio = models.CharField(max_length=255, blank=True)
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
    datos_extra = models.JSONField(default=dict, blank=True)
    documentacion_presentada = models.ManyToManyField(Documento, blank=True, related_name="estudiantes_que_presentaron")

    def __str__(self):
        return f"{self.user.get_full_name()} (DNI: {self.dni})"

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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("estudiante", "profesorado")
        verbose_name = "Asignación estudiante-profesorado"
        verbose_name_plural = "Asignaciones estudiante-profesorado"

    def __str__(self):
        return f"{self.estudiante.dni} → {self.profesorado.nombre}"


class StaffAsignacion(models.Model):
    class Rol(models.TextChoices):
        BEDEL = "bedel", "Bedel"
        COORDINADOR = "coordinador", "Coordinador"
        TUTOR = "tutor", "Tutor"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="asignaciones_profesorado",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="staff_asignaciones",
    )
    rol = models.CharField(max_length=20, choices=Rol.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "profesorado", "rol")
        verbose_name = "Asignación de staff"
        verbose_name_plural = "Asignaciones de staff"

    def __str__(self):
        return f"{self.user.username} - {self.profesorado.nombre} ({self.get_rol_display()})"


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
    anio_cursada = models.IntegerField()  # Año de cursada (e.g., 2025)
    cuatrimestre = models.CharField(
        max_length=3, choices=REGIMEN_CHOICES, blank=True, null=True
    )  # C1, C2, or NULL for ANUAL

    def __str__(self):
        return f"Horario de {self.espacio.nombre} - {self.anio_cursada} ({self.turno.nombre})"

    class Meta:
        verbose_name = "Horario de Cátedra"
        verbose_name_plural = "Horarios de Cátedra"
        # A course can only have one schedule per turn/year/quarter
        unique_together = ("espacio", "turno", "anio_cursada", "cuatrimestre")


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
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("materia", "anio_lectivo", "codigo")
        ordering = ["anio_lectivo", "materia__nombre", "codigo"]

    def __str__(self):
        return f"{self.materia.nombre} - {self.codigo} ({self.anio_lectivo})"


class VentanaHabilitacion(models.Model):
    class Tipo(models.TextChoices):
        INSCRIPCION = "INSCRIPCION", "Inscripcion (general)"
        MESAS_FINALES = "MESAS_FINALES", "Mesas de examen - Finales"
        MESAS_EXTRA = "MESAS_EXTRA", "Mesas de examen - Extraordinarias"
        MESAS_LIBRES = "MESAS_LIBRES", "Mesas de examen - Libres"
        MATERIAS = "MATERIAS", "Inscripciones a Materias"
        CARRERAS = "CARRERAS", "Inscripciones a Carreras"
        COMISION = "COMISION", "Cambios de Comision"
        ANALITICOS = "ANALITICOS", "Pedidos de Analiticos"
        EQUIVALENCIAS = "EQUIVALENCIAS", "Pedidos de Equivalencias"
        PREINSCRIPCION = "PREINSCRIPCION", "Preinscripcion"
        CALENDARIO_CUATRIMESTRE = (
            "CALENDARIO_CUATRIMESTRE",
            "Calendario academico - Cuatrimestres",
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


class PreinscripcionChecklist(models.Model):
    """Checklist administrativo de documentación para confirmar una preinscripción.

    Se asocia 1:1 con la Preinscripcion (por año/carrera/alumno) y permite
    calcular el estado del legajo (COMPLETO/INCOMPLETO) según la documentación.
    """

    preinscripcion = models.OneToOneField("Preinscripcion", on_delete=models.CASCADE, related_name="checklist")

    # Grupo Documentación personal
    dni_legalizado = models.BooleanField(default=False)
    fotos_4x4 = models.BooleanField(default=False)
    certificado_salud = models.BooleanField(default=False)
    folios_oficio = models.IntegerField(default=0)

    # Titulación de nivel medio (seleccionar una de las tres alternativas)
    titulo_secundario_legalizado = models.BooleanField(default=False)
    certificado_titulo_en_tramite = models.BooleanField(default=False)
    analitico_legalizado = models.BooleanField(default=False)
    certificado_alumno_regular_sec = models.BooleanField(default=False)

    # Si analítico: detalle de adeuda y establecimiento
    adeuda_materias = models.BooleanField(default=False)
    adeuda_materias_detalle = models.TextField(blank=True, default="")
    escuela_secundaria = models.CharField(max_length=255, blank=True, default="")

    # Trayecto de certificación docente (requiere título terciario/universitario)
    es_certificacion_docente = models.BooleanField(default=False)
    titulo_terciario_univ = models.BooleanField(default=False)
    curso_introductorio_aprobado = models.BooleanField(default=False)

    # Derivado
    estado_legajo = models.CharField(
        max_length=3,
        choices=Estudiante.EstadoLegajo.choices,
        default=Estudiante.EstadoLegajo.PENDIENTE,
    )

    updated_at = models.DateTimeField(auto_now=True)

    def calcular_estado(self) -> str:
        """Devuelve código de estado del legajo ('COM' o 'INC')."""
        # Reglas comunes
        docs_base = [
            self.dni_legalizado,
            self.certificado_salud,
            self.fotos_4x4,
            (self.folios_oficio or 0) >= 3,
        ]

        if self.es_certificacion_docente:
            completos = all(docs_base + [self.titulo_terciario_univ])
            return Estudiante.EstadoLegajo.COMPLETO if completos else Estudiante.EstadoLegajo.INCOMPLETO

        # Vía secundaria: una (y solo una) de las tres alternativas
        alternativas_cnt = sum(
            [
                1 if self.titulo_secundario_legalizado else 0,
                1 if self.certificado_titulo_en_tramite else 0,
                1 if self.analitico_legalizado else 0,
            ]
        )

        cond_alternativas = alternativas_cnt >= 1

        # Si presentó analítico, exigir constancia de alumno regular y detalle de adeuda (si marcó adeuda)
        extra_ok = True
        if self.analitico_legalizado:
            extra_ok = self.certificado_alumno_regular_sec
            if self.adeuda_materias:
                extra_ok = (
                    extra_ok and bool(self.adeuda_materias_detalle.strip()) and bool(self.escuela_secundaria.strip())
                )

        completos = all(docs_base + [cond_alternativas, extra_ok])
        return Estudiante.EstadoLegajo.COMPLETO if completos else Estudiante.EstadoLegajo.INCOMPLETO

    def save(self, *args, **kwargs):
        # Actualiza estado derivado y refleja en Estudiante asociado
        self.estado_legajo = self.calcular_estado()
        super().save(*args, **kwargs)
        try:
            est = self.preinscripcion.alumno
            if est and est.estado_legajo != self.estado_legajo:
                est.estado_legajo = self.estado_legajo
                est.save(update_fields=["estado_legajo"])
        except Exception:
            pass


class RequisitoDocumentacionTemplate(models.Model):
    class Categoria(models.TextChoices):
        GENERALES = "GEN", "Requisitos generales"
        SECUNDARIO = "SEC", "Secundario"
        COMPLEMENTARIO = "COM", "Complementario"
        FOTO = "FOTO", "Foto"
        OTROS = "OTRO", "Otros"

    codigo = models.CharField(max_length=64, unique=True)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default="")
    categoria = models.CharField(max_length=5, choices=Categoria.choices, default=Categoria.GENERALES)
    obligatorio = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Requisito documental (plantilla)"
        verbose_name_plural = "Requisitos documentales (plantillas)"
        ordering = ["categoria", "orden", "codigo"]

    def __str__(self) -> str:
        return f"{self.codigo} - {self.titulo}"


class ProfesoradoRequisitoDocumentacion(models.Model):
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.CASCADE,
        related_name="requisitos_documentacion",
    )
    template = models.ForeignKey(
        RequisitoDocumentacionTemplate,
        on_delete=models.SET_NULL,
        related_name="instancias",
        null=True,
        blank=True,
    )
    codigo = models.CharField(max_length=64)
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, default="")
    categoria = models.CharField(
        max_length=5,
        choices=RequisitoDocumentacionTemplate.Categoria.choices,
        default=RequisitoDocumentacionTemplate.Categoria.GENERALES,
    )
    obligatorio = models.BooleanField(default=True)
    orden = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    personalizado = models.BooleanField(
        default=False,
        help_text="Se marca en True cuando el requisito fue editado específicamente para este profesorado.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Requisito documental por profesorado"
        verbose_name_plural = "Requisitos documentales por profesorado"
        unique_together = ("profesorado", "codigo")
        ordering = ["categoria", "orden", "codigo"]

    def __str__(self) -> str:
        return f"{self.profesorado} · {self.codigo}"

    def aplicar_template(self, force: bool = False) -> bool:
        """Sincroniza campos con la plantilla cuando el requisito no está personalizado.

        Devuelve True si hubo cambios guardados.
        """
        if not self.template:
            return False
        if self.personalizado and not force:
            return False
        campos = {
            "titulo": self.template.titulo,
            "descripcion": self.template.descripcion,
            "categoria": self.template.categoria,
            "obligatorio": self.template.obligatorio,
            "orden": self.template.orden,
            "activo": self.template.activo,
        }
        modificados = []
        for campo, valor in campos.items():
            if getattr(self, campo) != valor:
                setattr(self, campo, valor)
                modificados.append(campo)
        if modificados:
            if "updated_at" not in modificados:
                modificados.append("updated_at")
            self.save(update_fields=modificados)
            return True
        return False

    def marcar_personalizado(self) -> None:
        if not self.personalizado:
            self.personalizado = True
            self.save(update_fields=["personalizado", "updated_at"])


class EquivalenciaCurricular(models.Model):
    """Agrupa materias equivalentes entre profesorados/planes.

    Ej.: código "P101" (Pedagogía) relaciona Materia de distintos planes.
    """

    codigo = models.CharField(max_length=32, unique=True)
    nombre = models.CharField(max_length=255, blank=True, null=True)
    materias = models.ManyToManyField(Materia, related_name="equivalencias", blank=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre or ''}".strip()


class InscripcionMateriaAlumno(models.Model):
    """Inscripción anual de un estudiante a una materia/comisión."""

    class Estado(models.TextChoices):
        CONFIRMADA = "CONF", "Confirmada"
        PENDIENTE = "PEND", "Pendiente"
        RECHAZADA = "RECH", "Rechazada"
        ANULADA = "ANUL", "Anulada"

    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="inscripciones_materia")
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="inscripciones_alumnos")
    comision = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inscripciones",
    )
    comision_solicitada = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="inscripciones_solicitadas",
    )
    anio = models.IntegerField()
    estado = models.CharField(max_length=4, choices=Estado.choices, default=Estado.CONFIRMADA)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("estudiante", "materia", "anio")
        ordering = ["-anio", "-created_at"]
        indexes = [
            models.Index(fields=["estudiante", "anio"]),
            models.Index(fields=["estudiante", "estado"]),
        ]

    def __str__(self):
        materia_nombre = self.materia.nombre if self.materia_id else "Materia"
        codigo = f" [{self.comision.codigo}]" if self.comision_id else ""
        return f"{self.estudiante.dni} -> {materia_nombre}{codigo} ({self.anio}) {self.get_estado_display()}"


class PedidoAnalitico(models.Model):
    class Motivo(models.TextChoices):
        EQUIVALENCIA = "equivalencia", "Pedido de equivalencia"
        BECA = "beca", "Becas"
        CONTROL = "control", "Control"
        OTRO = "otro", "Otro"

    estudiante = models.ForeignKey("Estudiante", on_delete=models.CASCADE, related_name="pedidos_analitico")
    ventana = models.ForeignKey(VentanaHabilitacion, on_delete=models.PROTECT, related_name="pedidos_analitico")
    motivo = models.CharField(max_length=20, choices=Motivo.choices)
    motivo_otro = models.CharField(max_length=255, blank=True, null=True)
    profesorado = models.ForeignKey(Profesorado, on_delete=models.SET_NULL, null=True, blank=True)
    cohorte = models.IntegerField(null=True, blank=True, help_text="Año de ingreso (cohorte)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analítico {self.estudiante.dni} {self.created_at.date()} ({self.get_motivo_display()})"


class PedidoEquivalencia(models.Model):
    class Tipo(models.TextChoices):
        ANEXO_A = "ANEXO_A", "Anexo A"
        ANEXO_B = "ANEXO_B", "Anexo B"

    class Estado(models.TextChoices):
        BORRADOR = "draft", "Borrador"
        FINALIZADO = "final", "Finalizado"

    estudiante = models.ForeignKey(
        "Estudiante",
        on_delete=models.CASCADE,
        related_name="pedidos_equivalencia",
    )
    ventana = models.ForeignKey(
        VentanaHabilitacion,
        on_delete=models.PROTECT,
        related_name="pedidos_equivalencia",
    )
    tipo = models.CharField(max_length=16, choices=Tipo.choices)
    ciclo_lectivo = models.CharField(max_length=16, blank=True, default="")
    profesorado_destino = models.ForeignKey(
        Profesorado,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos_equivalencia_destino",
    )
    profesorado_destino_nombre = models.CharField(max_length=255)
    plan_destino = models.ForeignKey(
        PlanDeEstudio,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos_equivalencia_destino",
    )
    plan_destino_resolucion = models.CharField(max_length=255, blank=True, default="")
    profesorado_origen_nombre = models.CharField(max_length=255, blank=True, default="")
    plan_origen_resolucion = models.CharField(max_length=255, blank=True, default="")
    establecimiento_origen = models.CharField(max_length=255, blank=True, default="")
    establecimiento_localidad = models.CharField(max_length=255, blank=True, default="")
    establecimiento_provincia = models.CharField(max_length=255, blank=True, default="")
    estado = models.CharField(
        max_length=12,
        choices=Estado.choices,
        default=Estado.BORRADOR,
    )
    bloqueado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    bloqueado_en = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]

    def __str__(self):
        return f"Pedido {self.get_tipo_display()} - {self.estudiante.dni} ({self.get_estado_display()})"

    @property
    def esta_finalizado(self) -> bool:
        return self.estado == self.Estado.FINALIZADO


class PedidoEquivalenciaMateria(models.Model):
    pedido = models.ForeignKey(
        PedidoEquivalencia,
        on_delete=models.CASCADE,
        related_name="materias",
    )
    nombre = models.CharField(max_length=255)
    formato = models.CharField(max_length=128, blank=True, default="")
    anio_cursada = models.CharField(max_length=64, blank=True, default="")
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "id"]

    def __str__(self):
        return f"{self.nombre} ({self.formato or 'formato no indicado'})"


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
    created_at = models.DateTimeField(auto_now_add=True)

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
    fecha_resultado = models.DateField(null=True, blank=True)
    condicion = models.CharField(max_length=3, choices=Condicion.choices, null=True, blank=True)
    nota = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    folio = models.CharField(max_length=32, null=True, blank=True)
    libro = models.CharField(max_length=32, null=True, blank=True)
    observaciones = models.TextField(null=True, blank=True)
    cuenta_para_intentos = models.BooleanField(default=True)

    class Meta:
        unique_together = ("mesa", "estudiante")


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
        "InscripcionMateriaAlumno",
        on_delete=models.CASCADE,
        related_name="regularidades_historial",
        null=True,
        blank=True,
    )
    estudiante = models.ForeignKey("Estudiante", on_delete=models.CASCADE, related_name="regularidades")
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name="regularidades")
    fecha_cierre = models.DateField()
    nota_trabajos_practicos = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    nota_final_cursada = models.IntegerField(null=True, blank=True)
    asistencia_porcentaje = models.IntegerField(null=True, blank=True)
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
    nota_final = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
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
        unique_together = ("planilla", "orden")

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


class ActaExamenAlumno(models.Model):
    NOTA_AUSENTE_JUSTIFICADO = "AJ"
    NOTA_AUSENTE_INJUSTIFICADO = "AI"

    acta = models.ForeignKey(
        ActaExamen,
        on_delete=models.CASCADE,
        related_name="alumnos",
    )
    numero_orden = models.PositiveIntegerField()
    permiso_examen = models.CharField(max_length=64, blank=True)
    dni = models.CharField(max_length=16)
    apellido_nombre = models.CharField(max_length=255)
    examen_escrito = models.CharField(max_length=4, blank=True)
    examen_oral = models.CharField(max_length=4, blank=True)
    calificacion_definitiva = models.CharField(max_length=4)
    observaciones = models.TextField(blank=True)

    class Meta:
        ordering = ["numero_orden", "id"]

    def __str__(self) -> str:
        return f"{self.numero_orden}. {self.apellido_nombre} ({self.calificacion_definitiva})"


def validate_pdf_attachment(file):
    if not file:
        return
    name = (getattr(file, "name", "") or "").lower()
    if not name.endswith(".pdf"):
        raise ValidationError("Solo se permiten archivos PDF.")
    content_type = getattr(file, "content_type", None)
    if content_type and content_type not in ("application/pdf", "application/x-pdf"):
        raise ValidationError("Solo se permiten archivos PDF.")
    max_size = getattr(settings, "MESSAGES_MAX_ATTACHMENT_SIZE", 2 * 1024 * 1024)  # 2 MB por defecto
    size = getattr(file, "size", None)
    if size and size > max_size:
        raise ValidationError(f"El archivo supera el limite permitido de {max_size // 1024} KB.")


class MessageTopic(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Conversation(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Abierta"
        CLOSE_REQUESTED = "close_requested", "Cierre solicitado"
        CLOSED = "closed", "Cerrada"

    topic = models.ForeignKey(
        MessageTopic,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations",
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations_started",
    )
    subject = models.CharField(max_length=255, blank=True)
    context_type = models.CharField(max_length=64, blank=True, null=True)
    context_id = models.CharField(max_length=64, blank=True, null=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.OPEN)
    is_massive = models.BooleanField(default=False)
    allow_student_reply = models.BooleanField(default=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    close_requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations_close_requested",
    )
    close_requested_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversations_closed",
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["last_message_at"]),
            models.Index(fields=["context_type", "context_id"]),
        ]

    def __str__(self):
        return f"Conversacion #{self.pk} ({self.get_status_display()})"

    def mark_updated(self):
        self.last_message_at = timezone.now()
        self.updated_at = self.last_message_at
        self.save(update_fields=["last_message_at", "updated_at"])


class ConversationParticipant(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversation_participations",
    )
    role_snapshot = models.CharField(max_length=64, blank=True, null=True)
    can_reply = models.BooleanField(default=True)
    last_read_at = models.DateTimeField(null=True, blank=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("conversation", "user")
        indexes = [
            models.Index(fields=["user", "last_read_at"]),
        ]

    def mark_read(self):
        self.last_read_at = timezone.now()
        self.save(update_fields=["last_read_at"])

    def __str__(self):
        return f"{self.user} en conversacion {self.conversation_id}"


class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages_authored",
    )
    body = models.TextField()
    attachment = models.FileField(
        upload_to="mensajes/%Y/%m/%d",
        null=True,
        blank=True,
        validators=[validate_pdf_attachment],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        author = self.author or "Sistema"
        return f"Mensaje #{self.pk} por {author}"


class ConversationAudit(models.Model):
    class Action(models.TextChoices):
        CLOSE_REQUESTED = "close_requested", "Solicitud de cierre"
        CLOSED = "closed", "Cierre"
        REOPENED = "reopened", "Reapertura"

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="audits",
    )
    action = models.CharField(max_length=32, choices=Action.choices)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="conversation_audits",
    )
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} - conversacion {self.conversation_id}"
