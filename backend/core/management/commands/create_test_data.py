from datetime import date

from django.core.management.base import BaseCommand

from core.models import Preinscripcion, Profesorado


class Command(BaseCommand):
    help = "Tests the creation of a Preinscripcion object."

    def handle(self, *args, **options):
        # Get a carrera object
        try:
            carrera = Profesorado.objects.get(id=1)
        except Profesorado.DoesNotExist:
            self.stdout.write(self.style.WARNING("Carrera with id=1 not found. Creating a test one."))
            carrera = Profesorado.objects.create(nombre="Profesorado de Prueba", duracion_anios=4)

        # Create the Preinscripcion object
        try:
            Preinscripcion.objects.create(
                carrera=carrera,
                nombres="Test",
                apellido="User",
                cuil="20304050608",  # Changed CUIL to avoid unique constraint violation
                dni="30405061",  # Changed DNI to avoid unique constraint violation
                fecha_nacimiento=date(2000, 1, 1),
                nacionalidad="Argentina",
                estado_civil="Soltero",
                localidad_nac="CABA",
                provincia_nac="CABA",
                pais_nac="Argentina",
                domicilio="Calle Falsa 123",
                tel_movil="1122334455",
                email="test2@example.com",  # Changed email to avoid unique constraint violation
                sec_titulo="Bachiller",
                sec_fecha_egreso=date(2017, 12, 20),
                sec_establecimiento="Escuela Normal 1",
                trabaja=False,
                empleador=None,
                horario_trabajo=None,
                domicilio_trabajo=None,
            )
            self.stdout.write(self.style.SUCCESS("SUCCESS: Preinscripcion object created successfully."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"ERROR: {e}"))
