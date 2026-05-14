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
from datetime import date
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
        parser.add_argument("--solo-activos", action="store_true",
                            help="Procesar solo estudiantes con estado académico ACTIVO.")
        parser.add_argument("--profesorado", type=int, default=None,
                            help="Filtrar por ID de profesorado.")

    def handle(self, *args, **options):
        from apps.estudiantes.api.helpers import (
            _tiene_aprobacion_valida,
            _calcular_resguardo_equivalencia,
        )

        dry_run = options["dry_run"]
        solo_equiv = options["solo_equivalencias"]
        solo_reg = options["solo_regularidades"]
        dni = options["dni"]
        solo_activos = options["solo_activos"]
        profesorado_id = options["profesorado"]
        prefijo = "[DRY-RUN] " if dry_run else ""

        est_qs = Estudiante.objects.select_related("persona").prefetch_related("materias_autorizadas")
        if dni:
            est_qs = est_qs.filter(persona__dni=dni)
        if solo_activos or profesorado_id:
            from core.models import EstudianteCarrera
            ec_qs = EstudianteCarrera.objects.all()
            if solo_activos:
                ec_qs = ec_qs.filter(estado_academico="ACT")
            if profesorado_id:
                ec_qs = ec_qs.filter(profesorado_id=profesorado_id)
            ids_filtrados = ec_qs.values_list("estudiante_id", flat=True).distinct()
            est_qs = est_qs.filter(id__in=ids_filtrados)

        total_reg_marcadas = 0
        total_reg_liberadas = 0
        total_eq_marcadas = 0
        total_eq_liberadas = 0

        for est in est_qs:
            autorizadas_ids = set(est.materias_autorizadas.values_list("id", flat=True))

            # --- Regularidades ---
            if not solo_equiv:
                reg_qs = Regularidad.objects.filter(
                    estudiante=est,
                    situacion__in=SITUACIONES_POSITIVAS,
                ).select_related("materia")
                if profesorado_id:
                    reg_qs = reg_qs.filter(materia__plan_de_estudio__profesorado_id=profesorado_id)
                for reg in reg_qs:
                    from apps.estudiantes.api.helpers.misc_utils import _calcular_resguardo_equivalencia
                    from apps.estudiantes.api.helpers import _tiene_aprobacion_valida
                    from core.models import Correlatividad, Materia as Mat
                    deberia_resguardo = _calcular_resguardo_equivalencia(
                        est, reg.materia, autorizadas_ids=autorizadas_ids,
                        situacion=reg.situacion,
                    )

                    if deberia_resguardo and not reg.en_resguardo:
                        total_reg_marcadas += 1
                        nombre = f"{est.persona.apellido}, {est.persona.nombre}" if est.persona else str(est.id)
                        from core.models import Correlatividad as Corr
                        from apps.estudiantes.api.helpers.misc_utils import _calcular_vigencia_regularidad
                        hoy = date.today()
                        faltantes = []
                        # Correlativas de APROBACIÓN
                        for corr in Corr.objects.filter(
                            materia_origen=reg.materia,
                            tipo=Corr.TipoCorrelatividad.APROBADA_PARA_CURSAR,
                        ).select_related("materia_correlativa"):
                            if not _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                                faltantes.append(f"Necesita APROBAR: {corr.materia_correlativa.nombre}")
                        # Correlativas de REGULARIDAD — chequeo con vigencia
                        for corr in Corr.objects.filter(
                            materia_origen=reg.materia,
                            tipo=Corr.TipoCorrelatividad.REGULAR_PARA_CURSAR,
                        ).select_related("materia_correlativa"):
                            if _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                                continue  # aprobada, ok
                            regs_corr = Regularidad.objects.filter(
                                estudiante=est,
                                materia=corr.materia_correlativa,
                                situacion=Regularidad.Situacion.REGULAR,
                                en_resguardo=False,
                            )
                            if not regs_corr.exists():
                                faltantes.append(f"Necesita REGULARIZAR: {corr.materia_correlativa.nombre}")
                            else:
                                for rc in regs_corr:
                                    limite, intentos, max_i = _calcular_vigencia_regularidad(est, rc)
                                    if hoy > limite:
                                        faltantes.append(f"Regularidad VENCIDA ({rc.fecha_cierre}): {corr.materia_correlativa.nombre}")
                                    elif intentos >= max_i:
                                        faltantes.append(f"Regularidad AGOTADA ({intentos}/{max_i} intentos): {corr.materia_correlativa.nombre}")
                        # Para APROBADO/PROMOCIONADO: correlativas APROBADA_PARA_RENDIR
                        if reg.situacion in (Regularidad.Situacion.APROBADO, Regularidad.Situacion.PROMOCIONADO):
                            for corr in Corr.objects.filter(
                                materia_origen=reg.materia,
                                tipo=Corr.TipoCorrelatividad.APROBADA_PARA_RENDIR,
                            ).select_related("materia_correlativa"):
                                if not _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                                    faltantes.append(f"Necesita APROBAR (para rendir): {corr.materia_correlativa.nombre}")
                        faltantes_str = "\n    ".join(dict.fromkeys(faltantes)) if faltantes else "Sin detalle"
                        self.stdout.write(
                            f"{prefijo}REG en resguardo: {est.persona.dni if est.persona else est.id} "
                            f"| {nombre}\n"
                            f"  Materia en resguardo : {reg.materia.nombre} ({reg.get_situacion_display()})\n"
                            f"  Motivo               : {faltantes_str}\n"
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
                        nombre = f"{est.persona.apellido}, {est.persona.nombre}" if est.persona else str(est.id)
                        from core.models import Correlatividad as Corr
                        from apps.estudiantes.api.helpers.misc_utils import _calcular_vigencia_regularidad
                        hoy = date.today()
                        faltantes = []
                        for corr in Corr.objects.filter(
                            materia_origen=eq.materia,
                            tipo=Corr.TipoCorrelatividad.APROBADA_PARA_CURSAR,
                        ).select_related("materia_correlativa"):
                            if not _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                                faltantes.append(f"Necesita APROBAR: {corr.materia_correlativa.nombre}")
                        for corr in Corr.objects.filter(
                            materia_origen=eq.materia,
                            tipo=Corr.TipoCorrelatividad.REGULAR_PARA_CURSAR,
                        ).select_related("materia_correlativa"):
                            if _tiene_aprobacion_valida(est, corr.materia_correlativa, autorizadas_ids=autorizadas_ids):
                                continue
                            regs_corr = Regularidad.objects.filter(
                                estudiante=est,
                                materia=corr.materia_correlativa,
                                situacion=Regularidad.Situacion.REGULAR,
                                en_resguardo=False,
                            )
                            if not regs_corr.exists():
                                faltantes.append(f"Necesita REGULARIZAR: {corr.materia_correlativa.nombre}")
                            else:
                                for rc in regs_corr:
                                    limite, intentos, max_i = _calcular_vigencia_regularidad(est, rc)
                                    if hoy > limite:
                                        faltantes.append(f"Regularidad VENCIDA ({rc.fecha_cierre}): {corr.materia_correlativa.nombre}")
                                    elif intentos >= max_i:
                                        faltantes.append(f"Regularidad AGOTADA ({intentos}/{max_i} intentos): {corr.materia_correlativa.nombre}")
                        faltantes_str = "\n    ".join(dict.fromkeys(faltantes)) if faltantes else "Sin detalle"
                        self.stdout.write(
                            f"{prefijo}EQUIV en resguardo: {est.persona.dni if est.persona else est.id} "
                            f"| {nombre}\n"
                            f"  Materia en resguardo : {eq.materia.nombre}\n"
                            f"  Motivo               : {faltantes_str}\n"
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
