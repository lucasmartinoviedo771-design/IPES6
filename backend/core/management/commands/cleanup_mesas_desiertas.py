"""
Management command para eliminar mesas de examen desiertas.

Uso:
    python manage.py cleanup_mesas_desiertas
    python manage.py cleanup_mesas_desiertas --dias-gracia 7
    python manage.py cleanup_mesas_desiertas --dry-run

Configuración sugerida en cron (ejecutar cada noche a las 2am):
    0 2 * * * cd /ruta/al/proyecto && python manage.py cleanup_mesas_desiertas
"""

from django.core.management.base import BaseCommand

from core.models import MesaExamen


class Command(BaseCommand):
    help = "Elimina mesas de examen sin inscriptos activos que superaron el período de gracia post-ventana."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dias-gracia",
            type=int,
            default=5,
            help="Días de gracia después del cierre de la ventana (default: 5).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué mesas serían eliminadas sin borrarlas.",
        )

    def handle(self, *args, **options):
        from datetime import date, timedelta

        from django.db.models import Count, Q

        dias_gracia = options["dias_gracia"]
        dry_run = options["dry_run"]
        hoy = date.today()

        mesas_candidatas = (
            MesaExamen.objects.select_related("ventana", "materia")
            .filter(fecha__lt=hoy)
            .annotate(count_inscriptos=Count("inscripciones", filter=Q(inscripciones__estado="INS")))
            .filter(count_inscriptos=0)
        )

        a_eliminar = []
        for mesa in mesas_candidatas:
            if mesa.ventana:
                fecha_limite = mesa.ventana.hasta + timedelta(days=dias_gracia)
            else:
                fecha_limite = mesa.fecha + timedelta(days=dias_gracia)

            if hoy > fecha_limite:
                a_eliminar.append(mesa)

        if not a_eliminar:
            self.stdout.write(self.style.SUCCESS("No hay mesas desiertas para eliminar."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[DRY RUN] Se eliminarían {len(a_eliminar)} mesa(s):"))
            for mesa in a_eliminar:
                ventana_info = f"ventana hasta {mesa.ventana.hasta}" if mesa.ventana else "sin ventana"
                self.stdout.write(f"  - {mesa} ({ventana_info})")
            return

        for mesa in a_eliminar:
            mesa.delete()

        self.stdout.write(self.style.SUCCESS(f"Se eliminaron {len(a_eliminar)} mesa(s) desierta(s) correctamente."))
