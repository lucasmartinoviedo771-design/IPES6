"""
Management command: sincroniza el estado_academico de estudiantes en un profesorado.

Dado un profesorado y una lista de DNIs, marca esos estudiantes como ACTIVO y
todos los demás como INACTIVO en ese profesorado.

Uso:
    # Leer DNIs desde stdin (uno por línea o separados por espacios/comas):
    echo "12345678 87654321" | python manage.py sincronizar_activos_profesorado --profesorado 9

    # Leer DNIs desde un archivo:
    python manage.py sincronizar_activos_profesorado --profesorado 9 --archivo /tmp/dnis.txt

    # Simular sin guardar:
    python manage.py sincronizar_activos_profesorado --profesorado 9 --dry-run < dnis.txt

    # Buscar profesorado por nombre parcial:
    python manage.py sincronizar_activos_profesorado --nombre-profesorado "Biología" < dnis.txt
"""

import re
import sys

from django.core.management.base import BaseCommand, CommandError

from core.models.carreras import Profesorado
from core.models.estudiantes import EstudianteCarrera


class Command(BaseCommand):
    help = "Marca como ACTIVO a los estudiantes de la lista y como INACTIVO al resto en un profesorado."

    def add_arguments(self, parser):
        grupo = parser.add_mutually_exclusive_group(required=True)
        grupo.add_argument("--profesorado", type=int, metavar="ID", help="ID del profesorado.")
        grupo.add_argument(
            "--nombre-profesorado",
            type=str,
            metavar="NOMBRE",
            help="Nombre parcial del profesorado (búsqueda case-insensitive).",
        )
        parser.add_argument(
            "--archivo",
            type=str,
            default=None,
            metavar="RUTA",
            help="Archivo con DNIs (uno por línea o separados por espacios/comas). Si se omite, lee desde stdin.",
        )
        parser.add_argument("--dry-run", action="store_true", help="Simula sin guardar cambios.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Resolver profesorado
        if options["profesorado"]:
            try:
                profesorado = Profesorado.objects.get(pk=options["profesorado"])
            except Profesorado.DoesNotExist:
                raise CommandError(f"No existe un profesorado con ID {options['profesorado']}.")
        else:
            nombre = options["nombre_profesorado"]
            matches = Profesorado.objects.filter(nombre__icontains=nombre)
            if matches.count() == 0:
                raise CommandError(f"No se encontró ningún profesorado con nombre que contenga '{nombre}'.")
            if matches.count() > 1:
                nombres = "\n  ".join(f"[{p.id}] {p.nombre}" for p in matches)
                raise CommandError(
                    f"Hay {matches.count()} profesorados que coinciden con '{nombre}'. Usá --profesorado con el ID:\n  {nombres}"
                )
            profesorado = matches.first()

        self.stdout.write(f"Profesorado: [{profesorado.id}] {profesorado.nombre}")

        # Leer DNIs
        if options["archivo"]:
            with open(options["archivo"], encoding="utf-8") as f:
                contenido = f.read()
        else:
            self.stdout.write("Leyendo DNIs desde stdin...")
            contenido = sys.stdin.read()

        dnis_activos = set(re.findall(r"\d{7,9}", contenido))

        if not dnis_activos:
            raise CommandError("No se encontraron DNIs válidos en la entrada.")

        self.stdout.write(f"DNIs en la lista: {len(dnis_activos)}")

        # Obtener todos los EstudianteCarrera de este profesorado
        todos = EstudianteCarrera.objects.filter(profesorado=profesorado).select_related("estudiante")
        total = todos.count()
        self.stdout.write(f"Asignaciones en el profesorado: {total}")

        activos_lista = []
        inactivos_lista = []

        for ec in todos:
            if ec.estudiante.dni in dnis_activos:
                activos_lista.append(ec)
            else:
                inactivos_lista.append(ec)

        dnis_no_encontrados = dnis_activos - {ec.estudiante.dni for ec in activos_lista}

        # Mostrar resumen antes de actuar
        self.stdout.write("\nResultado esperado:")
        self.stdout.write(f"  → ACTIVO  : {len(activos_lista)} estudiantes")
        self.stdout.write(f"  → INACTIVO: {len(inactivos_lista)} estudiantes")

        if dnis_no_encontrados:
            self.stdout.write(
                self.style.WARNING(
                    f"\n  ⚠ {len(dnis_no_encontrados)} DNI(s) de la lista NO están en este profesorado:"
                )
            )
            for dni in sorted(dnis_no_encontrados):
                self.stdout.write(f"      {dni}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] Sin cambios guardados."))
            return

        # Aplicar cambios
        ya_activos = [ec for ec in activos_lista if ec.estado_academico == "ACT"]
        a_activar = [ec for ec in activos_lista if ec.estado_academico != "ACT"]
        ya_inactivos = [ec for ec in inactivos_lista if ec.estado_academico == "INA"]
        a_inactivar = [ec for ec in inactivos_lista if ec.estado_academico != "INA"]

        self.stdout.write(f"\n  Ya estaban activos   : {len(ya_activos)}")
        self.stdout.write(f"  Se van a activar     : {len(a_activar)}")
        self.stdout.write(f"  Ya estaban inactivos : {len(ya_inactivos)}")
        self.stdout.write(f"  Se van a inactivar   : {len(a_inactivar)}")

        if a_activar:
            ids = [ec.pk for ec in a_activar]
            EstudianteCarrera.objects.filter(pk__in=ids).update(estado_academico="ACT")

        if a_inactivar:
            ids = [ec.pk for ec in a_inactivar]
            EstudianteCarrera.objects.filter(pk__in=ids).update(estado_academico="INA")

        self.stdout.write(self.style.SUCCESS(f"\n✓ Listo. {len(a_activar)} activados, {len(a_inactivar)} inactivados."))
