from django.conf import settings
from django.db import models

from .carreras import Materia, PlanDeEstudio, Profesorado
from .horarios import VentanaHabilitacion


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

    class WorkflowEstado(models.TextChoices):
        BORRADOR = "draft", "Borrador"
        PENDIENTE_DOCUMENTACION = "pending_docs", "Pendiente de documentación"
        EN_EVALUACION = "review", "En evaluación"
        EN_TITULOS = "titulos", "En Títulos"
        NOTIFICADO = "notified", "Notificado"

    class ResultadoFinal(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        OTORGADA = "otorgada", "Otorgada"
        DENEGADA = "denegada", "No otorgada"
        MIXTA = "mixta", "Mixta"

    class DocumentoTitulos(models.TextChoices):
        NINGUNO = "ninguno", "Sin documentos"
        NOTA = "nota", "Nota"
        DISPOSICION = "disposicion", "Disposición"
        AMBOS = "ambos", "Nota y Disposición"

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
    workflow_estado = models.CharField(
        max_length=20,
        choices=WorkflowEstado.choices,
        default=WorkflowEstado.BORRADOR,
    )
    formulario_descargado_en = models.DateTimeField(null=True, blank=True)
    inscripcion_verificada_en = models.DateTimeField(null=True, blank=True)
    requiere_tutoria = models.BooleanField(default=False)
    documentacion_presentada = models.BooleanField(default=False)
    documentacion_detalle = models.CharField(max_length=255, blank=True, default="")
    documentacion_cantidad = models.PositiveIntegerField(null=True, blank=True)
    documentacion_registrada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    documentacion_registrada_en = models.DateTimeField(null=True, blank=True)
    evaluacion_observaciones = models.CharField(max_length=255, blank=True, default="")
    evaluacion_registrada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    evaluacion_registrada_en = models.DateTimeField(null=True, blank=True)
    resultado_final = models.CharField(
        max_length=16,
        choices=ResultadoFinal.choices,
        default=ResultadoFinal.PENDIENTE,
    )
    titulos_documento_tipo = models.CharField(
        max_length=12,
        choices=DocumentoTitulos.choices,
        default=DocumentoTitulos.NINGUNO,
    )
    titulos_nota_numero = models.CharField(max_length=128, blank=True, default="")
    titulos_nota_fecha = models.DateField(null=True, blank=True)
    titulos_disposicion_numero = models.CharField(max_length=128, blank=True, default="")
    titulos_disposicion_fecha = models.DateField(null=True, blank=True)
    titulos_observaciones = models.CharField(max_length=255, blank=True, default="")
    titulos_registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    titulos_registrado_en = models.DateTimeField(null=True, blank=True)
    notificado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    notificado_en = models.DateTimeField(null=True, blank=True)
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
    class Resultado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        OTORGADA = "otorgada", "Otorgada"
        RECHAZADA = "rechazada", "No otorgada"

    pedido = models.ForeignKey(
        PedidoEquivalencia,
        on_delete=models.CASCADE,
        related_name="materias",
    )
    nombre = models.CharField(max_length=255)
    formato = models.CharField(max_length=128, blank=True, default="")
    anio_cursada = models.CharField(max_length=64, blank=True, default="")
    nota = models.CharField(max_length=32, blank=True, default="")
    orden = models.PositiveIntegerField(default=0)
    resultado = models.CharField(
        max_length=16,
        choices=Resultado.choices,
        default=Resultado.PENDIENTE,
    )
    observaciones = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["orden", "id"]


class EquivalenciaDisposicion(models.Model):
    origen = models.CharField(
        max_length=32,
        choices=[("primera_carga", "Primera carga"), ("secretaria", "Secretaría")],
    )
    estudiante = models.ForeignKey(
        "Estudiante",
        on_delete=models.CASCADE,
        related_name="equivalencia_disposiciones",
    )
    profesorado = models.ForeignKey(
        Profesorado,
        on_delete=models.PROTECT,
        related_name="equivalencia_disposiciones",
    )
    plan = models.ForeignKey(
        PlanDeEstudio,
        on_delete=models.PROTECT,
        related_name="equivalencia_disposiciones",
    )
    numero_disposicion = models.CharField(max_length=64)
    fecha_disposicion = models.DateField()
    observaciones = models.CharField(max_length=255, blank=True, default="")
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado_en"]
        indexes = [
            models.Index(fields=["estudiante", "profesorado", "numero_disposicion"]),
        ]


class EquivalenciaDisposicionDetalle(models.Model):
    disposicion = models.ForeignKey(
        EquivalenciaDisposicion,
        on_delete=models.CASCADE,
        related_name="detalles",
    )
    materia = models.ForeignKey(
        Materia,
        on_delete=models.PROTECT,
        related_name="equivalencia_disposiciones",
    )
    nota = models.CharField(max_length=32)
    observaciones = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        unique_together = [("disposicion", "materia")]

    def __str__(self):
        return f"{self.materia.nombre} - Nota: {self.nota}"
