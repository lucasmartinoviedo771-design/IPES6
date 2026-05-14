"""
Management command: recalcula el flag en_resguardo en Regularidades y Equivalencias.

Evalúa cada aprobación (REGULAR, APROBADO, PROMOCIONADO y equivalencias) y verifica
si las correlativas están satisfechas. Actualiza en_resguardo en consecuencia.

Usar:
    python manage.py recalcular_resguardo
    python manage.py recalcular_resguardo --dry-run
    python manage.py recalcular_resguardo --solo-equivalencias
    python manage.py recalcular_resguardo --solo-regularidades
    python manage.py recalcular_resguardo --dni 12345678

Cron sugerido (noche, una vez por semana):
    0 3 * * 0 cd /app && python manage.py recalcular_resguardo
"""
from django.core.management.base import BaseCommand
from core.models import Estudiante, Regularidad, EquivalenciaDisposicionDetalle


SITUACIONES_POSITIVAS = (
    Regularidad.Situacion.REGULAR,
    Regularidad.Situacion.APROBADO,
    Regularidad.Situacion.PROMOCIONADO,
)


class Command(BaseCommand):
    help = "Recalcula en_resguardo en Regularidades y Equivalencias según correlativas."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--solo-equivalencias", action="store_true")
        parser.add_argument("--solo-regularidades", action="store_true")
        parser.add_argument("--dni", type=str, default=None,
                            help="Procesar solo un estudiante por DNI.")

    def handle(self, *args, **options):
        from apps.estudiantes.api.helpers import (
            _tiene_aprobacion_valida,
            _calcular_resguardo_equivalencia,
        )

        dry_run = options["dry_run"]
        solo_equiv = options["solo_equivalencias"]
        solo_reg = options["solo_regularidades"]
        dni = options["dni"]
        prefijo = "[DRY-RUN] " if dry_run else ""

        est_qs = Estudiante.objects.select_related("persona").prefetch_related("materias_autorizadas")
        if dni:
            est_qs = est_qs.filter(persona__dni=dni)

        total_reg_marcadas = 0
        total_reg_liberadas = 0
        total_eq_marcadas = 0
        total_eq_liberadas = 0

        for est in est_qs:
            autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))

            # --- Regularidades ---
            if not solo_equiv:
                for reg in Regularidad.objects.filter(
                    estudiante=est,
                    situacion__in=SITUACIONES_POSITIVAS,
                ).select_related("materia"):
                    # Calcular si debería estar en resguardo
                    # Una regularidad está en resguardo si sus correlativas de cursada
                    # no están satisfechas de forma válida.
                    from apps.estudiantes.api.helpers.misc_utils import _calcular_resguardo_equivalencia
                    deberia_resguardo = _calcular_resguardo_equivalencia(
                        est, reg.materia, autorizadas_ids=autorizadas_ids
                    )

                    if deberia_resguardo and not reg.en_resguardo:
                        total_reg_marcadas += 1
                        self.stdout.write(
                            f"{prefijo}REG en resguardo: {est.persona.dni if est.persona else est.id} "
                            f"— {reg.materia.nombre} ({reg.get_situacion_display()})"
                        )
                        if not dry_run:
                            reg.en_resguardo = True
                            reg.save(update_fields=["en_resguardo"])
                    elif not deberia_resguardo and reg.en_resguardo:
                        total_reg_liberadas += 1
                        self.stdout.write(
                            f"{prefijo}REG liberada: {est.persona.dni if est.persona else est.id} "
                            f"— {reg.materia.nombre}"
                        )
                        if not dry_run:
                            reg.en_resguardo = False
                            reg.save(update_fields=["en_resguardo"])

            # --- Equivalencias ---
            if not solo_reg:
                for eq in EquivalenciaDisposicionDetalle.objects.filter(
                    disposicion__estudiante=est,
                ).select_related("materia"):
                    deberia_resguardo = _calcular_resguardo_equivalencia(
                        est, eq.materia, autorizadas_ids=autorizadas_ids
                    )

                    if deberia_resguardo and not eq.en_resguardo:
                        total_eq_marcadas += 1
                        self.stdout.write(
                            f"{prefijo}EQUIV en resguardo: {est.persona.dni if est.persona else est.id} "
                            f"— {eq.materia.nombre}"
                        )
                        if not dry_run:
                            eq.en_resguardo = True
                            eq.save(update_fields=["en_resguardo"])
                    elif not deberia_resguardo and eq.en_resguardo:
                        total_eq_liberadas += 1
                        self.stdout.write(
                            f"{prefijo}EQUIV liberada: {est.persona.dni if est.persona else est.id} "
                            f"— {eq.materia.nombre}"
                        )
                        if not dry_run:
                            eq.en_resguardo = False
                            eq.save(update_fields=["en_resguardo"])

        self.stdout.write(self.style.SUCCESS(
            f"\n{prefijo}Regularidades → {total_reg_marcadas} en resguardo, {total_reg_liberadas} liberadas."
        ))
        self.stdout.write(self.style.SUCCESS(
            f"{prefijo}Equivalencias → {total_eq_marcadas} en resguardo, {total_eq_liberadas} liberadas."
        ))
