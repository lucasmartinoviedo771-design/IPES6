from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator

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
    alumno = models.ForeignKey('Estudiante', on_delete=models.CASCADE) # Vinculado a Estudiante
    carrera = models.ForeignKey(Profesorado, on_delete=models.PROTECT)
    anio = models.IntegerField() # Año de la preinscripción
    datos_extra = models.JSONField(default=dict, blank=True)
    activa = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    cuil = models.CharField(max_length=13, blank=True, null=True, unique=True, validators=[RegexValidator(r'^\d{2}-\d{8}-\d{1}', message="El CUIL debe tener el formato XX-XXXXXXXX-X.")])

    def __str__(self):
        return f"Preinscripción {self.codigo} para {self.alumno}"

    class Meta:
        managed = True
        db_table = "preinscripciones"
        unique_together = ('alumno', 'carrera', 'anio')


# --- Otros Modelos Gestionados ---

class Documento(models.Model):
    nombre = models.CharField(max_length=255, unique=True)
    obligatorio = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre

class PlanDeEstudio(models.Model):
    profesorado = models.ForeignKey(Profesorado, on_delete=models.CASCADE, related_name="planes")
    resolucion = models.CharField(max_length=100, unique=True, help_text="Número de resolución o normativa del plan")
    anio_inicio = models.IntegerField(help_text="Año en que el plan entró en vigencia")
    anio_fin = models.IntegerField(null=True, blank=True, help_text="Año en que el plan dejó de estar vigente (opcional)")
    vigente = models.BooleanField(default=True, help_text="Indica si este plan de estudio está actualmente en uso")

    def __str__(self):
        return f"{self.profesorado.nombre} - Plan {self.resolucion}"

class Docente(models.Model):
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    dni = models.CharField(max_length=20, unique=True, help_text="DNI del docente")
    email = models.EmailField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    cuil = models.CharField(max_length=13, unique=True, null=True, blank=True, help_text="CUIL sin guiones (opcional)")
    
    def __str__(self):
        return f"{self.apellido}, {self.nombre} (DNI: {self.dni})"

class Materia(models.Model):
    class FormatoMateria(models.TextChoices):
        ASIGNATURA = 'ASI', 'Asignatura'
        PRACTICA = 'PRA', 'Práctica'
        MODULO = 'MOD', 'Módulo'
        TALLER = 'TAL', 'Taller'
        LABORATORIO = 'LAB', 'Laboratorio'
        SEMINARIO = 'SEM', 'Seminario'

    class TipoCursada(models.TextChoices):
        ANUAL = 'ANU', 'Anual'
        PRIMER_CUATRIMESTRE = 'PCU', 'Primer Cuatrimestre'
        SEGUNDO_CUATRIMESTRE = 'SCU', 'Segundo Cuatrimestre'

    plan_de_estudio = models.ForeignKey(PlanDeEstudio, on_delete=models.CASCADE, related_name="materias")
    nombre = models.CharField(max_length=255)
    anio_cursada = models.IntegerField(help_text="Año de la carrera al que pertenece la materia (1, 2, 3, 4, ...)")
    horas_semana = models.IntegerField(default=0, help_text="Carga horaria semanal requerida") # New field
    formato = models.CharField(max_length=3, choices=FormatoMateria.choices)
    regimen = models.CharField(max_length=3, choices=TipoCursada.choices, default=TipoCursada.ANUAL) # Replaced tipo_cursada with regimen


    class Meta:
        unique_together = ('plan_de_estudio', 'anio_cursada', 'nombre')
        ordering = ['anio_cursada', 'nombre']

    def __str__(self):
        return f"{self.nombre} ({self.anio_cursada}° Año) - Plan: {self.plan_de_estudio.resolucion}"

class Correlatividad(models.Model):
    class TipoCorrelatividad(models.TextChoices):
        REGULAR_PARA_CURSAR = 'RPC', 'Regular para Cursar'
        APROBADA_PARA_CURSAR = 'APC', 'Aprobada para Cursar'
        APROBADA_PARA_RENDIR = 'APR', 'Aprobada para Rendir Final'

    materia_origen = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="correlativas_requeridas",
        help_text="Materia que requiere la correlatividad (ej: Didáctica II)"
    )
    materia_correlativa = models.ForeignKey(
        Materia,
        on_delete=models.CASCADE,
        related_name="es_correlativa_de",
        help_text="Materia que debe ser aprobada/regularizada (ej: Pedagogía)"
    )
    tipo = models.CharField(max_length=3, choices=TipoCorrelatividad.choices)

    def __str__(self):
        return f"{self.materia_origen.nombre} requiere {self.materia_correlativa.nombre} como {self.get_tipo_display()}"

    class Meta:
        unique_together = ('materia_origen', 'materia_correlativa', 'tipo')

class Estudiante(models.Model):
    class EstadoLegajo(models.TextChoices):
        COMPLETO = 'COM', 'Completo'
        INCOMPLETO = 'INC', 'Incompleto / Condicional'
        PENDIENTE = 'PEN', 'Pendiente de Revisión'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="estudiante")
    legajo = models.CharField(max_length=20, unique=True, null=True, blank=True, help_text="Número de legajo único del estudiante")
    dni = models.CharField(max_length=10, unique=True)
    fecha_nacimiento = models.DateField(null=True, blank=True)
    telefono = models.CharField(max_length=20, blank=True)
    domicilio = models.CharField(max_length=255, blank=True)
    carreras = models.ManyToManyField(Profesorado, related_name="estudiantes")
    estado_legajo = models.CharField(
        max_length=3,
        choices=EstadoLegajo.choices,
        default=EstadoLegajo.PENDIENTE
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="Si está activo, el estudiante debe cambiar la contraseña al iniciar sesión."
    )
    documentacion_presentada = models.ManyToManyField(
        Documento,
        blank=True,
        related_name="estudiantes_que_presentaron"
    )

    def __str__(self):
        return f"{self.user.get_full_name()} (DNI: {self.dni})"


class Turno(models.Model):
    nombre = models.CharField(max_length=50, unique=True) # Mañana, Tarde, Noche

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Turno"
        verbose_name_plural = "Turnos"

class Bloque(models.Model):
    DIA_CHOICES = [
        (1, 'Lunes'), (2, 'Martes'), (3, 'Miércoles'), (4, 'Jueves'), (5, 'Viernes'), (6, 'Sábado')
    ]
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name='bloques')
    dia = models.IntegerField(choices=DIA_CHOICES)
    hora_desde = models.TimeField()
    hora_hasta = models.TimeField()
    es_recreo = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_dia_display()} {self.hora_desde}-{self.hora_hasta} ({self.turno.nombre})"

    class Meta:
        verbose_name = "Bloque Horario"
        verbose_name_plural = "Bloques Horarios"
        unique_together = ('turno', 'dia', 'hora_desde', 'hora_hasta')
        ordering = ['dia', 'hora_desde']

class HorarioCatedra(models.Model):
    # Using Materia.TipoCursada.choices for consistency with regimen
    REGIMEN_CHOICES = Materia.TipoCursada.choices

    espacio = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='horarios_catedra')
    turno = models.ForeignKey(Turno, on_delete=models.CASCADE, related_name='horarios_catedra')
    anio_cursada = models.IntegerField() # Año de cursada (e.g., 2025)
    cuatrimestre = models.CharField(max_length=3, choices=REGIMEN_CHOICES, blank=True, null=True) # C1, C2, or NULL for ANUAL

    def __str__(self):
        return f"Horario de {self.espacio.nombre} - {self.anio_cursada} ({self.turno.nombre})"

    class Meta:
        verbose_name = "Horario de Cátedra"
        verbose_name_plural = "Horarios de Cátedra"
        # A course can only have one schedule per turn/year/quarter
        unique_together = ('espacio', 'turno', 'anio_cursada', 'cuatrimestre')

class HorarioCatedraDetalle(models.Model):
    horario_catedra = models.ForeignKey(HorarioCatedra, on_delete=models.CASCADE, related_name='detalles')
    bloque = models.ForeignKey(Bloque, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.horario_catedra} - {self.bloque}"

    class Meta:
        verbose_name = "Detalle de Horario de Cátedra"
        verbose_name_plural = "Detalles de Horario de Cátedra"
        unique_together = ('horario_catedra', 'bloque') # A block can only be assigned once per schedule


class Comision(models.Model):
    class Estado(models.TextChoices):
        ABIERTA = 'ABI', 'Abierta'
        CERRADA = 'CER', 'Cerrada'
        SUSPENDIDA = 'SUS', 'Suspendida'

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='comisiones')
    anio_lectivo = models.IntegerField(help_text="Año académico en el que se dicta la comisión")
    codigo = models.CharField(max_length=32, help_text="Identificador interno de la comisión")
    turno = models.ForeignKey(Turno, on_delete=models.PROTECT, related_name='comisiones')
    docente = models.ForeignKey(Docente, on_delete=models.SET_NULL, null=True, blank=True, related_name='comisiones')
    horario = models.ForeignKey('HorarioCatedra', on_delete=models.SET_NULL, null=True, blank=True, related_name='comisiones')
    cupo_maximo = models.IntegerField(null=True, blank=True)
    estado = models.CharField(max_length=3, choices=Estado.choices, default=Estado.ABIERTA)
    observaciones = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('materia', 'anio_lectivo', 'codigo')
        ordering = ['anio_lectivo', 'materia__nombre', 'codigo']

    def __str__(self):
        return f"{self.materia.nombre} - {self.codigo} ({self.anio_lectivo})"


class VentanaHabilitacion(models.Model):
    class Tipo(models.TextChoices):
        INSCRIPCION = 'INSCRIPCION', 'Inscripción (general)'
        MESAS_FINALES = 'MESAS_FINALES', 'Mesas de examen - Finales'
        MESAS_EXTRA = 'MESAS_EXTRA', 'Mesas de examen - Extraordinarias'
        MESAS_LIBRES = 'MESAS_LIBRES', 'Mesas de examen - Libres'
        MATERIAS = 'MATERIAS', 'Inscripciones a Materias'
        CARRERAS = 'CARRERAS', 'Inscripciones a Carreras'
        COMISION = 'COMISION', 'Cambios de Comisión'
        ANALITICOS = 'ANALITICOS', 'Pedidos de Analíticos'
        PREINSCRIPCION = 'PREINSCRIPCION', 'Preinscripción'

    tipo = models.CharField(max_length=32, choices=Tipo.choices)
    desde = models.DateField()
    hasta = models.DateField()
    activo = models.BooleanField(default=False)
    periodo = models.CharField(
        max_length=16,
        null=True,
        blank=True,
        help_text="Solo para inscripciones a materias: '1C_ANUALES' o '2C'.",
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
    preinscripcion = models.OneToOneField('Preinscripcion', on_delete=models.CASCADE, related_name='checklist')

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
        docs_base = [self.dni_legalizado, self.certificado_salud, self.fotos_4x4, (self.folios_oficio or 0) >= 3]

        if self.es_certificacion_docente:
            completos = all(docs_base + [self.titulo_terciario_univ])
            return Estudiante.EstadoLegajo.COMPLETO if completos else Estudiante.EstadoLegajo.INCOMPLETO

        # Vía secundaria: una (y solo una) de las tres alternativas
        alternativas_cnt = sum([
            1 if self.titulo_secundario_legalizado else 0,
            1 if self.certificado_titulo_en_tramite else 0,
            1 if self.analitico_legalizado else 0,
        ])

        cond_alternativas = alternativas_cnt >= 1

        # Si presentó analítico, exigir constancia de alumno regular y detalle de adeuda (si marcó adeuda)
        extra_ok = True
        if self.analitico_legalizado:
            extra_ok = self.certificado_alumno_regular_sec
            if self.adeuda_materias:
                extra_ok = extra_ok and bool(self.adeuda_materias_detalle.strip()) and bool(self.escuela_secundaria.strip())

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


class EquivalenciaCurricular(models.Model):
    """Agrupa materias equivalentes entre profesorados/planes.

    Ej.: código "P101" (Pedagogía) relaciona Materia de distintos planes.
    """
    codigo = models.CharField(max_length=32, unique=True)
    nombre = models.CharField(max_length=255, blank=True, null=True)
    materias = models.ManyToManyField(Materia, related_name='equivalencias', blank=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre or ''}".strip()


class InscripcionMateriaAlumno(models.Model):
    """Inscripción anual de un estudiante a una materia/comisión."""

    class Estado(models.TextChoices):
        CONFIRMADA = 'CONF', 'Confirmada'
        PENDIENTE = 'PEND', 'Pendiente'
        RECHAZADA = 'RECH', 'Rechazada'
        ANULADA = 'ANUL', 'Anulada'

    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name='inscripciones_materia')
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='inscripciones_alumnos')
    comision = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='inscripciones'
    )
    comision_solicitada = models.ForeignKey(
        Comision,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='inscripciones_solicitadas'
    )
    anio = models.IntegerField()
    estado = models.CharField(max_length=4, choices=Estado.choices, default=Estado.CONFIRMADA)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('estudiante', 'materia', 'anio')
        ordering = ['-anio', '-created_at']
        indexes = [
            models.Index(fields=['estudiante', 'anio']),
            models.Index(fields=['estudiante', 'estado']),
        ]

    def __str__(self):
        materia_nombre = self.materia.nombre if self.materia_id else 'Materia'
        codigo = f" [{self.comision.codigo}]" if self.comision_id else ''
        return f"{self.estudiante.dni} -> {materia_nombre}{codigo} ({self.anio}) {self.get_estado_display()}"


class PedidoAnalitico(models.Model):
    class Motivo(models.TextChoices):
        EQUIVALENCIA = 'equivalencia', 'Pedido de equivalencia'
        BECA = 'beca', 'Becas'
        CONTROL = 'control', 'Control'
        OTRO = 'otro', 'Otro'

    estudiante = models.ForeignKey('Estudiante', on_delete=models.CASCADE, related_name='pedidos_analitico')
    ventana = models.ForeignKey(VentanaHabilitacion, on_delete=models.PROTECT, related_name='pedidos_analitico')
    motivo = models.CharField(max_length=20, choices=Motivo.choices)
    motivo_otro = models.CharField(max_length=255, blank=True, null=True)
    profesorado = models.ForeignKey(Profesorado, on_delete=models.SET_NULL, null=True, blank=True)
    cohorte = models.IntegerField(null=True, blank=True, help_text='Año de ingreso (cohorte)')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Analítico {self.estudiante.dni} {self.created_at.date()} ({self.get_motivo_display()})"


class MesaExamen(models.Model):
    class Tipo(models.TextChoices):
        PARCIAL = 'PAR', 'Parcial'
        FINAL = 'FIN', 'Final'
        LIBRE = 'LIB', 'Libre'
        EXTRAORDINARIA = 'EXT', 'Extraordinaria'

    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='mesas')
    tipo = models.CharField(max_length=3, choices=Tipo.choices)
    fecha = models.DateField()
    hora_desde = models.TimeField(null=True, blank=True)
    hora_hasta = models.TimeField(null=True, blank=True)
    aula = models.CharField(max_length=64, blank=True, null=True)
    cupo = models.IntegerField(default=0)
    ventana = models.ForeignKey(VentanaHabilitacion, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Mesa {self.get_tipo_display()} {self.materia.nombre} {self.fecha}"


class InscripcionMesa(models.Model):
    class Estado(models.TextChoices):
        INSCRIPTO = 'INS', 'Inscripto'
        CANCELADO = 'CAN', 'Cancelado'

    mesa = models.ForeignKey(MesaExamen, on_delete=models.CASCADE, related_name='inscripciones')
    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name='inscripciones_mesa')
    estado = models.CharField(max_length=3, choices=Estado.choices, default=Estado.INSCRIPTO)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('mesa', 'estudiante')


class Regularidad(models.Model):
    class Situacion(models.TextChoices):
        PROMOCIONADO = 'PRO', 'Promocionado'
        REGULAR = 'REG', 'Regular'
        APROBADO = 'APR', 'Aprobado (sin final)'
        DESAPROBADO_PA = 'DPA', 'Desaprobado por Parciales'
        DESAPROBADO_TP = 'DTP', 'Desaprobado por Trabajos Prácticos'
        LIBRE_I = 'LBI', 'Libre por Inasistencias'
        LIBRE_AT = 'LAT', 'Libre Antes de Tiempo'

    inscripcion = models.ForeignKey(
        'InscripcionMateriaAlumno',
        on_delete=models.CASCADE,
        related_name='regularidades_historial',
        null=True,
        blank=True,
    )
    estudiante = models.ForeignKey('Estudiante', on_delete=models.CASCADE, related_name='regularidades')
    materia = models.ForeignKey(Materia, on_delete=models.CASCADE, related_name='regularidades')
    fecha_cierre = models.DateField()
    nota_trabajos_practicos = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    nota_final_cursada = models.IntegerField(null=True, blank=True)
    asistencia_porcentaje = models.IntegerField(null=True, blank=True)
    excepcion = models.BooleanField(default=False)
    situacion = models.CharField(max_length=3, choices=Situacion.choices)
    observaciones = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('estudiante', 'materia', 'fecha_cierre')
        ordering = ['-fecha_cierre']

    def __str__(self):
        return f"Reg {self.estudiante.dni} {self.materia.nombre} {self.get_situacion_display()}"
