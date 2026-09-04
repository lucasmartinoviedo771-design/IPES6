from django.apps import AppConfig


class MetricsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.metrics"

    def ready(self):
        """
        Conecta la invalidacion del cache de analytics.

        Solo invalida cache. Ver la advertencia en cache_invalidation.py sobre
        no tocar los snapshots desde una señal.
        """
        from apps.metrics.cache_invalidation import _conectar

        _conectar()
