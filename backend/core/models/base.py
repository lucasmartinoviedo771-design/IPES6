from django.contrib.auth.models import User
from django.db import models


class Persona(models.Model):
    class EstadoCivil(models.TextChoices):
        SOLTERO = "SOL", "Soltero/a"
        CASADO = "CAS", "Casado/a"
        DIVORCIADO = "DIV", "Divorciado/a"
        VIUDO = "VIU", "Viudo/a"
        CONVIVIENTE = "CON", "Conviviente"
        OTRO = "OTR", "Otro"

    GENERO_CHOICES = [
        ("M", "Masculino"),
        ("F", "Femenino"),
        ("X", "No binario / Otro"),
    ]

    dni = models.CharField(max_length=20, unique=True, db_index=True)
    cuil = models.CharField(max_length=20, blank=True, null=True, db_index=True)
    nombre = models.CharField(max_length=150)
    apellido = models.CharField(max_length=150)
    email = models.EmailField(max_length=255, blank=True, null=True)
    telefono = models.CharField(max_length=50, blank=True, null=True)
    telefono_emergencia = models.CharField(max_length=50, blank=True, null=True)
    parentesco_emergencia = models.CharField(max_length=100, blank=True, null=True)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    genero = models.CharField(max_length=1, choices=GENERO_CHOICES, blank=True, null=True)
    nacionalidad = models.CharField(max_length=100, blank=True, default="Argentina")
    domicilio = models.CharField(max_length=255, blank=True, null=True)
    localidad = models.CharField(max_length=150, blank=True, null=True)
    provincia = models.CharField(max_length=150, blank=True, default="Tierra del Fuego")
    pais = models.CharField(max_length=100, blank=True, default="Argentina")

    lugar_nacimiento = models.CharField(max_length=255, blank=True, null=True)
    estado_civil = models.CharField(max_length=3, choices=EstadoCivil.choices, blank=True, null=True)
    localidad_nac = models.CharField(max_length=150, blank=True, null=True)
    provincia_nac = models.CharField(max_length=150, blank=True, null=True)
    pais_nac = models.CharField(max_length=150, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Persona"
        verbose_name_plural = "Personas"
        ordering = ["apellido", "nombre"]

    def __str__(self):
        return f"{self.apellido}, {self.nombre} (DNI: {self.dni})"


class Docente(models.Model):
    persona = models.OneToOneField(
        "Persona",
        on_delete=models.CASCADE,
        related_name="docente_perfil",
        null=True,
        blank=True,
    )
    @property
    def nombre(self):
        return self.persona.nombre if self.persona else ""

    @property
    def apellido(self):
        return self.persona.apellido if self.persona else ""

    @property
    def dni(self):
        return self.persona.dni if self.persona else ""

    @property
    def email(self):
        return self.persona.email if self.persona else ""

    @property
    def telefono(self):
        return self.persona.telefono if self.persona else ""

    @property
    def cuil(self):
        return self.persona.cuil if self.persona else ""

    @property
    def fecha_nacimiento(self):
        return self.persona.fecha_nacimiento if self.persona else None

    def __str__(self):
        if self.persona:
            return f"{self.persona.apellido}, {self.persona.nombre} (DNI: {self.persona.dni})"
        return f"Docente ID: {self.id}"


class UserProfile(models.Model):
    """
    Perfil extendido para usuarios del sistema (docentes, staff, etc.)
    Proporciona funcionalidad adicional como cambio de contraseña obligatorio.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    persona = models.OneToOneField(
        "Persona",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_profile",
    )
    must_change_password = models.BooleanField(
        default=False,
        help_text="Si está activo, el usuario debe cambiar la contraseña al iniciar sesión.",
    )
    temp_password = models.CharField(
        max_length=128,
        blank=True,
        null=True,
        help_text="Contraseña temporal para envío por email (se borra después del primer login o envío)"
    )
    credentials_sent_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Fecha y hora en que se enviaron las credenciales por email"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil de Usuario"
        verbose_name_plural = "Perfiles de Usuario"

    def __str__(self):
        return f"Perfil de {self.user.username}"
