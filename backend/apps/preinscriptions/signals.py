from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Profesorado

from .services.requisitos import sync_profesorado_requisitos


@receiver(post_save, sender=Profesorado, dispatch_uid="preins_sync_profesorado_requisitos")
def _crear_requisitos_por_profesorado(sender, instance: Profesorado, created: bool, **kwargs) -> None:
    if not created:
        return
    sync_profesorado_requisitos(instance)
