from django.conf import settings
from django.core.exceptions import ValidationError
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


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
