from django.apps import AppConfig


class AsistenciaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.asistencia"
    verbose_name = "Módulo de Asistencia"

    def ready(self):
        try:
            import apps.asistencia.cargos_models  # noqa
        except ImportError:
            pass
