"""
Calcula y persiste los snapshots diarios que alimentan las series temporales
del dashboard analítico.

Pensado para correr una vez por noche vía cron:
    0 23 * * * cd /app && .venv/bin/python manage.py calcular_snapshots

Es idempotente: volver a correrlo para la misma fecha recalcula y pisa los
valores de esa fecha, sin tocar el histórico de otras fechas.
"""

from datetime import datetime

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.asistencia.models import AsistenciaEstudiante
from apps.metrics.models import (
    AsistenciaSnapshot,
    AusentismoSnapshot,
    MatriculaSnapshot,
)
from core.models import Comision, EstudianteCarrera, Profesorado, Regularidad

# Estados reales de AsistenciaEstudiante
PRESENTE = "presente"
AUSENTE = "ausente"
AUSENTE_JUST = "ausente_justificada"
TARDE = "tarde"

UMBRAL_ESTUDIANTE_CRITICO = 0.30  # >30% de ausencias


class Command(BaseCommand):
    help = "Calcula y guarda los snapshots diarios de métricas analíticas"

    def add_arguments(self, parser):
        parser.add_argument(
            "--fecha",
            type=str,
            default=None,
            help="Fecha del snapshot (YYYY-MM-DD). Por defecto: hoy.",
        )
        parser.add_argument(
            "--profesorado-id",
            type=int,
            default=None,
            help="Limitar el cálculo a un profesorado.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Calcula e informa, pero no escribe en la base.",
        )

    def handle(self, *args, **options):
        fecha_str = options.get("fecha")
        if fecha_str:
            try:
                fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(self.style.ERROR(f"Fecha inválida: {fecha_str} (usar YYYY-MM-DD)"))
                return
        else:
            fecha = timezone.now().date()

        prof_id = options.get("profesorado_id")
        self.dry_run = options.get("dry_run", False)

        if self.dry_run:
            self.stdout.write(self.style.WARNING("DRY-RUN: no se escribirá nada"))

        self.stdout.write(f"Calculando snapshots para {fecha.isoformat()}...")

        n_mat = self._matricula(fecha, prof_id)
        n_asi = self._asistencia(fecha, prof_id)
        n_aus = self._ausentismo(fecha, prof_id)

        self.stdout.write(
            self.style.SUCCESS(
                f"Listo: {n_mat} matrícula, {n_asi} asistencia, {n_aus} ausentismo."
            )
        )

    def _guardar(self, model, defaults, **claves):
        if self.dry_run:
            return
        model.objects.update_or_create(defaults=defaults, **claves)

    def _profesorados(self, prof_id):
        qs = Profesorado.objects.all()
        return qs.filter(id=prof_id) if prof_id else qs

    def _matricula(self, fecha, prof_id):
        """Matrícula total y por estado, más promedios académicos, por profesorado."""
        n = 0
        for prof in self._profesorados(prof_id):
            ec = EstudianteCarrera.objects.filter(profesorado=prof)

            por_estado = {
                fila["estado_academico"]: fila["total"]
                for fila in ec.values("estado_academico").annotate(total=Count("id"))
            }

            reg = Regularidad.objects.filter(materia__plan_de_estudio__profesorado=prof)
            agg = reg.aggregate(
                nota=Avg("nota_final_cursada"), asis=Avg("asistencia_porcentaje")
            )

            self._guardar(
                MatriculaSnapshot,
                {
                    "total_matriculados": ec.count(),
                    "por_estado": por_estado,
                    "promedio_notas": round(agg["nota"], 2) if agg["nota"] else None,
                    "promedio_asistencia": round(agg["asis"], 2) if agg["asis"] else None,
                },
                profesorado=prof,
                fecha_snapshot=fecha,
            )
            n += 1

        self.stdout.write(f"  matrícula: {n} profesorados")
        return n

    def _asistencia(self, fecha, prof_id):
        """Asistencia agregada de estudiantes, por profesorado."""
        n = 0
        for prof in self._profesorados(prof_id):
            qs = AsistenciaEstudiante.objects.filter(
                clase__comision__materia__plan_de_estudio__profesorado=prof
            )

            conteos = qs.aggregate(
                total=Count("id"),
                presentes=Count("id", filter=Q(estado=PRESENTE)),
                ausentes=Count("id", filter=Q(estado=AUSENTE)),
                tardias=Count("id", filter=Q(estado=TARDE)),
                justificadas=Count("id", filter=Q(estado=AUSENTE_JUST)),
            )

            total = conteos["total"]
            porcentaje = round(conteos["presentes"] / total * 100, 2) if total else None

            self._guardar(
                AsistenciaSnapshot,
                {
                    "total_registros": total,
                    "presentes": conteos["presentes"],
                    "ausentes": conteos["ausentes"],
                    "tardias": conteos["tardias"],
                    "justificadas": conteos["justificadas"],
                    "porcentaje_asistencia": porcentaje,
                },
                profesorado=prof,
                fecha_snapshot=fecha,
            )
            n += 1

        self.stdout.write(f"  asistencia: {n} profesorados")
        return n

    def _ausentismo(self, fecha, prof_id):
        """Ausentismo por comisión, con conteo de estudiantes críticos."""
        comisiones = Comision.objects.select_related(
            "materia__plan_de_estudio__profesorado"
        )
        if prof_id:
            comisiones = comisiones.filter(
                materia__plan_de_estudio__profesorado_id=prof_id
            )

        n = 0
        for comision in comisiones:
            qs = AsistenciaEstudiante.objects.filter(clase__comision=comision)

            conteos = qs.aggregate(
                total=Count("id"),
                ausencias=Count("id", filter=Q(estado__in=[AUSENTE, AUSENTE_JUST])),
                tardias=Count("id", filter=Q(estado=TARDE)),
                estudiantes=Count("estudiante_id", distinct=True),
            )
            total = conteos["total"]
            if not total:
                continue

            # Estudiantes críticos: una sola query agregada por estudiante
            criticos = 0
            por_estudiante = qs.values("estudiante_id").annotate(
                n=Count("id"),
                aus=Count("id", filter=Q(estado__in=[AUSENTE, AUSENTE_JUST])),
            )
            for fila in por_estudiante:
                if fila["n"] and fila["aus"] / fila["n"] > UMBRAL_ESTUDIANTE_CRITICO:
                    criticos += 1

            plan = getattr(comision.materia, "plan_de_estudio", None)
            profesorado = getattr(plan, "profesorado", None) if plan else None

            self._guardar(
                AusentismoSnapshot,
                {
                    "profesorado": profesorado,
                    "tasa_ausentismo": round(conteos["ausencias"] / total * 100, 2),
                    "total_estudiantes": conteos["estudiantes"],
                    "estudiantes_sin_registro": 0,
                    "estudiantes_críticos": criticos,
                    "detalles": {
                        "ausencias": conteos["ausencias"],
                        "tardias": conteos["tardias"],
                        "total_registros": total,
                    },
                },
                comision=comision,
                fecha_snapshot=fecha,
            )
            n += 1

        self.stdout.write(f"  ausentismo: {n} comisiones con registros")
        return n
