from django.db import models

class PreinscripcionArchivo(models.Model):
    class Meta:
        db_table = "core_preinscripcion_archivo"

    preinscripcion_id = models.BigIntegerField(db_index=True)
    tipo = models.CharField(max_length=50)
    archivo = models.FileField(upload_to="preinscripciones/%Y/%m/%d/")
    nombre_original = models.CharField(max_length=255)
    tamano = models.BigIntegerField()
    content_type = models.CharField(max_length=100)
    creado_en = models.DateTimeField(auto_now_add=True)
    subido_por_id = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.preinscripcion_id} - {self.tipo} - {self.archivo.name}"
