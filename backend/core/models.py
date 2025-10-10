from django.db import models
from django.contrib.auth.models import User

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
    foto_4x4_dataurl = models.TextField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    fecha_nacimiento = models.DateField()
    telefono = models.CharField(max_length=20, blank=True)
    domicilio = models.CharField(max_length=255, blank=True)
    carreras = models.ManyToManyField(Profesorado, related_name="estudiantes")
    estado_legajo = models.CharField(
        max_length=3,
        choices=EstadoLegajo.choices,
        default=EstadoLegajo.PENDIENTE
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
