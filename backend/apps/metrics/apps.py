from django.apps import AppConfig


class MetricsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.metrics"

    def ready(self):
        """Registra signals de invalidación de cache."""
        import apps.metrics.signals  # noqa: F401
