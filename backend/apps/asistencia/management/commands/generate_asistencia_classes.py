from datetime import date, datetime

from django.core.management.base import BaseCommand, CommandParser

from apps.asistencia.services import generate_classes_for_date, generate_classes_for_range


class Command(BaseCommand):
    help = "Genera clases programadas y registros de asistencia para la fecha o rango indicado."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--fecha", help="Fecha específica en formato AAAA-MM-DD.")
        parser.add_argument("--desde", help="Fecha desde (incluida) en formato AAAA-MM-DD.")
        parser.add_argument("--hasta", help="Fecha hasta (incluida) en formato AAAA-MM-DD.")

    def handle(self, *args, **options):
        fecha_str = options.get("fecha")
        desde_str = options.get("desde")
        hasta_str = options.get("hasta")

        if fecha_str:
            target = datetime.strptime(fecha_str, "%Y-%m-%d").date()
            result = generate_classes_for_date(target)
            self.stdout.write(self.style.SUCCESS(f"Generadas/verificadas {len(result)} clases para {target}"))
            return

        if desde_str and hasta_str:
            desde = datetime.strptime(desde_str, "%Y-%m-%d").date()
            hasta = datetime.strptime(hasta_str, "%Y-%m-%d").date()
            result = generate_classes_for_range(desde, hasta)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Generadas/verificadas {len(result)} clases entre {desde} y {hasta}",
                )
            )
            return

        # Sin argumentos, usa la fecha actual.
        hoy = date.today()
        result = generate_classes_for_date(hoy)
        self.stdout.write(self.style.SUCCESS(f"Generadas/verificadas {len(result)} clases para {hoy}"))
