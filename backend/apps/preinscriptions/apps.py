from django.apps import AppConfig


class PreinscriptionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.preinscriptions"
    verbose_name = "Preinscripciones"

    def ready(self) -> None:
        # Importa señales para sincronizar requisitos documentales al crear profesorados.
        from . import signals  # noqa: F401
