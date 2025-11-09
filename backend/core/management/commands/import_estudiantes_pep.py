from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.primera_carga.services import process_estudiantes_csv


class Command(BaseCommand):
    help = "Importa estudiantes del Profesorado de Educación Primaria desde un CSV delimitado por ';'."

    def add_arguments(self, parser):
        default_csv = Path(settings.BASE_DIR).parent / "docs" / "lista de estudiantes PEP 2025.csv"
        parser.add_argument(
            "--csv-path",
            type=str,
            default=str(default_csv),
            help=f"Ruta del CSV a importar (por defecto: {default_csv})",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula la importación sin guardar cambios.",
        )

    def handle(self, *args, csv_path: str, dry_run: bool = False, **options):
        csv_file = Path(csv_path)
        if not csv_file.exists():
            raise CommandError(f"No se encontró el archivo CSV: {csv_file}")

        # Read the file content
        with csv_file.open("r", encoding="utf-8-sig", newline="") as fh:
            file_content = fh.read()

        # Call the service function
        result = process_estudiantes_csv(file_content, dry_run=dry_run)

        self.stdout.write("")
        if result["ok"]:
            self.stdout.write(self.style.SUCCESS("Importación completada."))
            self.stdout.write(f"Procesados: {result['processed']}, Omitidos: {result['skipped']}")
        else:
            self.stdout.write(self.style.ERROR("Importación con errores."))
            self.stdout.write(f"Procesados: {result['processed']}, Omitidos: {result['skipped']}")
            for error in result["errors"]:
                self.stdout.write(self.style.ERROR(f"Error: {error}"))
