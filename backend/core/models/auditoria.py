from django.contrib.auth.models import User
from django.db import models


class AuditLog(models.Model):
    class Accion(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"
        LOGIN = "LOGIN", "Login"
        LOGOUT = "LOGOUT", "Logout"
        OTHER = "OTHER", "Other"

    class TipoAccion(models.TextChoices):
        CRUD = "CRUD", "CRUD"
        AUTH = "AUTH", "Authentication"
        SYSTEM = "SYSTEM", "System"
        OTHER = "OTHER", "Other"

    class Resultado(models.TextChoices):
        OK = "OK", "Ok"
        ERROR = "ERROR", "Error"

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    nombre_usuario = models.CharField(max_length=100, blank=True)
    roles = models.JSONField(default=list, blank=True)
    accion = models.CharField(max_length=16, choices=Accion.choices)
    tipo_accion = models.CharField(max_length=16, choices=TipoAccion.choices)
    detalle_accion = models.CharField(max_length=100, blank=True)
    entidad_afectada = models.CharField(max_length=50, blank=True)
    id_entidad = models.CharField(max_length=64, blank=True)
    resultado = models.CharField(max_length=8, choices=Resultado.choices, default=Resultado.OK)
    ip_origen = models.CharField(max_length=45, blank=True)
    session_id = models.CharField(max_length=100, blank=True)
    request_id = models.CharField(max_length=100, blank=True)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "audit_log"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["usuario"]),
            models.Index(fields=["accion"]),
            models.Index(fields=["tipo_accion"]),
            models.Index(fields=["entidad_afectada", "id_entidad"]),
            models.Index(fields=["request_id"]),
        ]

    def __str__(self) -> str:
        return f"[{self.timestamp}] {self.accion} {self.detalle_accion or ''} ({self.nombre_usuario or 'sistema'})"


class SystemLog(models.Model):
    TIPOS = (
        ("REGULARIDAD_MISMATCH", "Discrepancia Regularidad"),
        ("ACTA_MISMATCH", "Discrepancia Acta Examen"),
        ("EQUIVALENCIA_MISMATCH", "Discrepancia Equivalencia"),
        ("IMPORT_ERROR", "Error de Importación"),
        ("SYSTEM_ERROR", "Error del Sistema"),
        ("SECURITY_ALERT", "Alerta de Seguridad"),
    )

    tipo = models.CharField(max_length=50, choices=TIPOS, default="SYSTEM_ERROR")
    mensaje = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    resuelto = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Registro de Auditoría"
        verbose_name_plural = "Registros de Auditoría"

    def __str__(self):
        return f"[{self.get_tipo_display()}] {self.mensaje[:50]}"
