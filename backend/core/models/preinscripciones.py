from django.core.validators import RegexValidator
from django.db import models

from .carreras import Profesorado
from .estudiantes import Estudiante


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
                r"^\d{2}-\d{8}-\d{1}$",
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
    folios_oficio = models.BooleanField(default=False)

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
    incumbencia = models.BooleanField(default=False)
    curso_introductorio_aprobado = models.BooleanField(default=False)

    # Mayores de 25, sin título secundario (Art. 7mo)
    articulo_7 = models.BooleanField(default=False)

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
            self.folios_oficio,
        ]

        if self.es_certificacion_docente:
            completos = all(docs_base + [self.titulo_terciario_univ, self.incumbencia])
            return Estudiante.EstadoLegajo.COMPLETO if completos else Estudiante.EstadoLegajo.INCOMPLETO

        # Según usuario: "titulo en tramite no habilita legajo completo"
        # "legajo completo es DNI true, folio true, fotos true certificado true y titulo secundario true"
        # Exception: articulo_7
        titulo_ok = bool(self.titulo_secundario_legalizado)
        es_articulo_7 = bool(self.articulo_7)

        # Para ser COMPLETO debe tener básicos y (Título Secundario o Art 7)
        completos = all(docs_base) and (titulo_ok or es_articulo_7)
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
