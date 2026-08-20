from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import MesaActaOral


class Command(BaseCommand):
    help = "Cierra automáticamente por timeout (10 min) las actas orales pendientes de conformidad del estudiante."

    def add_arguments(self, parser):
        parser.add_argument(
            "--minutos",
            type=int,
            default=10,
            help="Ventana de tiempo en minutos para considerar expirada el acta (default: 10).",
        )

    def handle(self, *args, **options):
        minutos = options["minutos"]
        ahora = timezone.now()
        limite = ahora - timedelta(minutes=minutos)

        actas_expiradas = MesaActaOral.objects.filter(
            estado_conformidad=MesaActaOral.EstadoConformidad.PENDIENTE,
            notificado_en__isnull=False,
            notificado_en__lte=limite,
        )

        total_cerradas = 0
        for acta in actas_expiradas:
            acta.estado_conformidad = MesaActaOral.EstadoConformidad.TIMEOUT
            acta.respondido_en = acta.notificado_en + timedelta(minutes=minutos)
            acta.save(update_fields=["estado_conformidad", "respondido_en", "updated_at"])
            total_cerradas += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"Acta oral #{acta.id} (Inscripcion {acta.inscripcion_id}) cerrada por timeout (10 min cumplidos)."
                )
            )

        if total_cerradas == 0:
            self.stdout.write("No se encontraron actas orales pendientes de conformidad expiradas.")
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Se cerraron un total de {total_cerradas} actas orales por timeout.")
            )
