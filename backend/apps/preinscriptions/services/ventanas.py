from django.utils import timezone
from core.models import VentanaHabilitacion


def ventana_preinscripcion_activa():
    """Retorna la ventana de preinscripción activa (si existe)."""
    hoy = timezone.now().date()
    return (
        VentanaHabilitacion.objects.filter(
            tipo=VentanaHabilitacion.Tipo.PREINSCRIPCION,
            desde__lte=hoy,
            hasta__gte=hoy,
            activo=True,
        )
        .order_by("-desde")
        .first()
    )
