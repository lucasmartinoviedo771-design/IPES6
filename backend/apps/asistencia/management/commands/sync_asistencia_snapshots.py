from django.core.management.base import BaseCommand, CommandParser

from core.models import Comision

from apps.asistencia.services import sync_course_snapshots


class Command(BaseCommand):
    help = "Sincroniza los snapshots de asistencia (horarios y estudiantes) con las comisiones actuales."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--anio", type=int, help="Filtra inscripciones por año lectivo.")
        parser.add_argument(
            "--comision",
            type=int,
            action="append",
            help="ID de comisión a sincronizar (puede indicarse varias veces).",
        )

    def handle(self, *args, **options):
        anio = options.get("anio")
        comisiones_ids = options.get("comision")

        if comisiones_ids:
            comisiones = Comision.objects.filter(id__in=comisiones_ids)
        else:
            comisiones = Comision.objects.all()

        total = comisiones.count()
        self.stdout.write(f"Sincronizando {total} comisiones...")
        sync_course_snapshots(comisiones=comisiones, anio=anio)
        self.stdout.write(self.style.SUCCESS("Sincronización completada."))
