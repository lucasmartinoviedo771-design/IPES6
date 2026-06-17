"""
Management command: resguardo masivo de regularidades para ingresantes con legajo incompleto.

Lógica:
- Se ejecuta a partir del 31 de marzo de cada año.
- Aplica a estudiantes cuyo año de ingreso es el año anterior (ingresantes recientes).
- Si el legajo sigue incompleto (estado != COMPLETO) y no tienen prórroga vigente,
  todas sus regularidades con situación positiva pasan a en_resguardo=True.
- Modo --liberar: hace el proceso inverso (libera resguardos de quienes completaron legajo).
- Modo --dry-run: muestra qué haría sin hacer cambios.

Uso:
    python manage.py resguardo_ingresantes
    python manage.py resguardo_ingresantes --dry-run
    python manage.py resguardo_ingresantes --liberar
    python manage.py resguardo_ingresantes --anio-ingreso 2024
"""
from datetime import date
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import Estudiante, ProrrogaTituloSecundario, Regularidad


SITUACIONES_POSITIVAS = (
    Regularidad.Situacion.REGULAR,
    Regularidad.Situacion.APROBADO,
    Regularidad.Situacion.PROMOCIONADO,
)


class Command(BaseCommand):
    help = "Aplica o libera resguardo masivo de regularidades para ingresantes con legajo incompleto (plazo 31/3)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué haría sin realizar cambios.",
        )
        parser.add_argument(
            "--liberar",
            action="store_true",
            help="Libera resguardos de estudiantes que completaron su legajo.",
        )
        parser.add_argument(
            "--anio-ingreso",
            type=int,
            default=None,
            help="Año de ingreso a procesar (por defecto: año anterior al actual).",
        )
        parser.add_argument(
            "--forzar",
            action="store_true",
            help="Ejecutar aunque no haya pasado el 31 de marzo.",
        )

    def handle(self, *args, **options):
        hoy = timezone.localdate()
        dry_run = options["dry_run"]
        liberar = options["liberar"]
        anio_ingreso = options["anio_ingreso"] or (hoy.year - 1)
        forzar = options["forzar"]

        plazo_31_marzo = date(hoy.year, 3, 31)
        if not liberar and not forzar and hoy < plazo_31_marzo:
            self.stdout.write(self.style.WARNING(
                f"El plazo del 31/3/{hoy.year} aún no venció. "
                f"Usá --forzar para ejecutar de todas formas."
            ))
            return

        prefijo = "[DRY-RUN] " if dry_run else ""

        if liberar:
            self._liberar(hoy, anio_ingreso, dry_run, prefijo)
        else:
            self._aplicar_resguardo(hoy, anio_ingreso, dry_run, prefijo)

    def _aplicar_resguardo(self, hoy, anio_ingreso, dry_run, prefijo):
        """Pone en resguardo las regularidades de ingresantes con legajo incompleto."""
        estudiantes_qs = Estudiante.objects.filter(
            anio_ingreso=anio_ingreso,
        ).exclude(
            estado_legajo=Estudiante.EstadoLegajo.COMPLETO,
        ).select_related("persona")

        total_est = 0
        total_regs = 0

        for est in estudiantes_qs:
            # Verificar si tiene prórroga vigente
            tiene_prorroga = ProrrogaTituloSecundario.objects.filter(
                estudiante=est,
                fecha_vencimiento__gte=hoy,
            ).exists()
            if tiene_prorroga:
                self.stdout.write(
                    f"  SKIP {est.persona.dni if est.persona else est.id} — tiene prórroga vigente."
                )
                continue

            regs_qs = Regularidad.objects.filter(
                estudiante=est,
                situacion__in=SITUACIONES_POSITIVAS,
                en_resguardo=False,
            )
            count = regs_qs.count()
            if count == 0:
                continue

            total_est += 1
            total_regs += count
            nombre = est.persona.apellido_nombre if est.persona else str(est.id)
            self.stdout.write(
                f"{prefijo}Resguardando {count} regularidad(es) → {nombre} "
                f"(DNI: {est.persona.dni if est.persona else '-'}, ingreso {anio_ingreso})"
            )
            if not dry_run:
                regs_qs.update(en_resguardo=True)

        self.stdout.write(self.style.SUCCESS(
            f"\n{prefijo}Total: {total_regs} regularidades en resguardo sobre {total_est} estudiantes."
        ))

    def _liberar(self, hoy, anio_ingreso, dry_run, prefijo):
        """Libera resguardos de ingresantes que completaron su legajo."""
        estudiantes_qs = Estudiante.objects.filter(
            anio_ingreso=anio_ingreso,
            estado_legajo=Estudiante.EstadoLegajo.COMPLETO,
        ).select_related("persona")

        total_est = 0
        total_regs = 0

        for est in estudiantes_qs:
            regs_qs = Regularidad.objects.filter(
                estudiante=est,
                en_resguardo=True,
            )
            count = regs_qs.count()
            if count == 0:
                continue

            total_est += 1
            total_regs += count
            nombre = est.persona.apellido_nombre if est.persona else str(est.id)
            self.stdout.write(
                f"{prefijo}Liberando {count} regularidad(es) → {nombre} "
                f"(DNI: {est.persona.dni if est.persona else '-'})"
            )
            if not dry_run:
                regs_qs.update(en_resguardo=False)

        self.stdout.write(self.style.SUCCESS(
            f"\n{prefijo}Total: {total_regs} regularidades liberadas sobre {total_est} estudiantes."
        ))
