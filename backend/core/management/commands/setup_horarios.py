from django.core.management.base import BaseCommand
from core.models import Turno, Bloque
from datetime import time, timedelta, datetime, date

class Command(BaseCommand):
    help = 'Sets up initial Turno and Bloque data for timetable management.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Setting up initial Turno and Bloque data...'))

        # Define turn structures
        turnos_data = {
            'TM': {
                'nombre': 'Turno Mañana',
                'blocks': [
                    (time(7,45), time(8,25), False),
                    (time(8,25), time(9,5), False),
                    (time(9,5), time(9,15), True), # Recreo
                    (time(9,15), time(9,55), False),
                    (time(9,55), time(10,35), False),
                    (time(10,35), time(10,45), True), # Recreo
                    (time(10,45), time(11,25), False),
                    (time(11,25), time(12,5), False),
                    (time(12,5), time(12,45), False),
                ]
            },
            'TT': {
                'nombre': 'Turno Tarde',
                'blocks': [
                    (time(13,0), time(13,40), False),
                    (time(13,40), time(14,20), False),
                    (time(14,20), time(14,30), True), # Recreo
                    (time(14,30), time(15,10), False),
                    (time(15,10), time(15,50), False),
                    (time(15,50), time(16,0), True), # Recreo
                    (time(16,0), time(16,40), False),
                    (time(16,40), time(17,20), False),
                    (time(17,20), time(18,0), False),
                ]
            },
            'TVN': {
                'nombre': 'Turno Vespertino',
                'blocks': [
                    (time(18,10), time(18,50), False),
                    (time(18,50), time(19,30), False),
                    (time(19,30), time(19,40), True), # Recreo
                    (time(19,40), time(20,20), False),
                    (time(20,20), time(21,0), False),
                    (time(21,0), time(21,10), True), # Recreo
                    (time(21,10), time(21,50), False),
                    (time(21,50), time(22,30), False),
                    (time(22,30), time(23,10), False),
                ]
            },
            'SAB': {
                'nombre': 'Turno Sábado',
                'blocks': [
                    (time(9,0), time(9,40), False),
                    (time(9,40), time(10,20), False),
                    (time(10,20), time(10,30), True), # Recreo
                    (time(10,30), time(11,10), False),
                    (time(11,10), time(11,50), False),
                    (time(11,50), time(12,0), True), # Recreo
                    (time(12,0), time(12,40), False),
                    (time(12,40), time(13,20), False),
                    (time(13,20), time(14,0), False),
                ]
            },
        }

        # Days of the week (1=Lunes, 6=Sábado)
        days_of_week = range(1, 7)

        for turno_code, data in turnos_data.items():
            turno, created = Turno.objects.get_or_create(nombre=data['nombre'])
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Turno: {turno.nombre}'))
            else:
                self.stdout.write(self.style.WARNING(f'Turno already exists: {turno.nombre}'))

            for day in days_of_week:
                for block_start_time, block_end_time, is_recreo_flag in data['blocks']:
                    bloque, created = Bloque.objects.get_or_create(
                        turno=turno,
                        dia=day,
                        hora_desde=block_start_time,
                        hora_hasta=block_end_time,
                        defaults={'es_recreo': is_recreo_flag}
                    )
                    if created:
                        self.stdout.write(self.style.SUCCESS(f'  Created Bloque: {bloque}'))

        self.stdout.write(self.style.SUCCESS('Initial Turno and Bloque data setup complete.'))
