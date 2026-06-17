"""
Management command: verifica residencias condicionales vencidas.

Corre después del 01/06 de cada año. Para cada ResidenciaCondicional sin resolver:
- Si el estudiante aprobó la materia pendiente → marca resuelta=True
- Si no aprobó → marca caida=True y pone la regularidad de Residencia en resguardo

Usar:
    python manage.py verificar_residencias_condicionales
    python manage.py verificar_residencias_condicionales --dry-run
    python manage.py verificar_residencias_condicionales --ciclo 2025

Cron sugerido (primer semana de junio):
    0 6 1 6 * cd /app && python manage.py verificar_residencias_condicionales
"""

from datetime import date

from django.core.management.base import BaseCommand

from apps.estudiantes.api.helpers.misc_utils import _tiene_aprobacion_valida
from core.models import Regularidad, ResidenciaCondicional


class Command(BaseCommand):
    help = "Verifica residencias condicionales: resuelve las aprobadas, hace caer las vencidas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--ciclo", type=int, default=None, help="Año lectivo a procesar (por defecto: año actual).")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        ciclo = options["ciclo"] or date.today().year
        prefijo = "[DRY-RUN] " if dry_run else ""

        hoy = date.today()
        pendientes = ResidenciaCondicional.objects.filter(
            ciclo_lectivo=ciclo,
            resuelta=False,
            caida=False,
        ).select_related("estudiante__persona", "materia_residencia", "materia_pendiente")

        total = pendientes.count()
        self.stdout.write(f"Procesando {total} residencias condicionales del ciclo {ciclo}...\n")

        resueltas = 0
        caidas = 0

        for rc in pendientes:
            est = rc.estudiante
            dni = est.persona.dni if est.persona_id else str(est.id)
            nombre = f"{est.persona.apellido}, {est.persona.nombre}" if est.persona_id else str(est)

            aprobada = _tiene_aprobacion_valida(est, rc.materia_pendiente)

            if aprobada:
                resueltas += 1
                self.stdout.write(
                    f"{prefijo}RESUELTA: {dni} — {nombre} | "
                    f"Residencia: {rc.materia_residencia.nombre} | "
                    f"Aprobó: {rc.materia_pendiente.nombre}"
                )
                if not dry_run:
                    rc.resuelta = True
                    rc.save(update_fields=["resuelta"])
            elif hoy >= rc.fecha_limite:
                caidas += 1
                self.stdout.write(
                    f"{prefijo}CAÍDA: {dni} — {nombre} | "
                    f"Residencia: {rc.materia_residencia.nombre} | "
                    f"No aprobó: {rc.materia_pendiente.nombre}"
                )
                if not dry_run:
                    rc.caida = True
                    rc.save(update_fields=["caida"])
                    # Poner la regularidad de Residencia en resguardo
                    Regularidad.objects.filter(
                        estudiante=est,
                        materia=rc.materia_residencia,
                        situacion__in=[
                            Regularidad.Situacion.REGULAR,
                            Regularidad.Situacion.APROBADO,
                            Regularidad.Situacion.PROMOCIONADO,
                        ],
                    ).update(en_resguardo=True)
            else:
                self.stdout.write(
                    f"  VIGENTE: {dni} — {nombre} | "
                    f"Residencia: {rc.materia_residencia.nombre} | "
                    f"Pendiente: {rc.materia_pendiente.nombre} | "
                    f"Límite: {rc.fecha_limite}"
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{prefijo}Ciclo {ciclo}: {resueltas} resueltas, {caidas} caídas, {total - resueltas - caidas} vigentes."
            )
        )
