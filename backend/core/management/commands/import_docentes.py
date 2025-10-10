import re
from django.core.management.base import BaseCommand, CommandError
from core.models import Docente

class Command(BaseCommand):
    help = 'Imports docentes from a given text input.'

    def add_arguments(self, parser):
        parser.add_argument('docentes_data', type=str, help='A string containing docente data, one per line, with name and DNI.')

    def handle(self, *args, **options):
        docentes_data = options['docentes_data']
        lines = docentes_data.strip().split('\n')
        
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            dni_match = re.match(r'^(\d{8})', line)
            if not dni_match:
                self.stdout.write(self.style.WARNING(f"Skipping line (DNI not found at beginning): {line}"))
                skipped_count += 1
                continue

            dni = dni_match.group(1)
            name_string_raw = line[dni_match.end():].strip()

            if ',' not in name_string_raw:
                self.stdout.write(self.style.WARNING(f"Skipping line (comma separator not found in name): {line}"))
                skipped_count += 1
                continue

            apellido_part, nombre_part = name_string_raw.split(',', 1)
            apellido = apellido_part.strip()
            nombre = nombre_part.strip()

            if not nombre or not apellido:
                self.stdout.write(self.style.WARNING(f"Skipping line (could not parse nombre or apellido): {line}"))
                skipped_count += 1
                continue


            docente, created = Docente.objects.update_or_create(
                dni=dni,
                defaults={'nombre': nombre, 'apellido': apellido, 'cuil': None}
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created Docente: {docente.nombre} {docente.apellido} ({docente.dni})"))
            else:
                updated_count += 1
                self.stdout.write(self.style.SUCCESS(f"Updated Docente: {docente.nombre} {docente.apellido} ({docente.dni})"))

        self.stdout.write(self.style.SUCCESS(f"\nImport process finished."))
        self.stdout.write(self.style.SUCCESS(f"Total created: {created_count}"))
        self.stdout.write(self.style.SUCCESS(f"Total updated: {updated_count}"))
        self.stdout.write(self.style.WARNING(f"Total skipped: {skipped_count}"))
