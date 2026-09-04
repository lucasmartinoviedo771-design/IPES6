from datetime import datetime, timedelta
from typing import Optional

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q
from django.utils import timezone

from apps.asistencia.models import AsistenciaEstudiante, ClaseProgramada
from apps.metrics.models import (
    AsistenciaSnapshot,
    AusentismoSnapshot,
    MatriculaSnapshot,
)
from core.models import (
    Comision,
    EstudianteCarrera,
    Profesorado,
    Regularidad,
    RiesgoAcademicoEstudiante,
)


class Command(BaseCommand):
    help = "Calcula y guarda snapshots diarios de métricas analíticas"

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
            help="ID de profesorado específico. Si no se pasa, se calcula para todos.",
        )

    def handle(self, *args, **options):
        fecha_str = options.get("fecha")
        if fecha_str:
            try:
                fecha_snapshot = datetime.strptime(fecha_str, "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(
                    self.style.ERROR(
                        f"Fecha inválida: {fecha_str}. Use formato YYYY-MM-DD"
                    )
                )
                return
        else:
            fecha_snapshot = timezone.now().date()

        profesorado_id = options.get("profesorado_id")

        self.stdout.write(
            f"Calculando snapshots para {fecha_snapshot.isoformat()}..."
        )

        # 1. Calcular MatriculaSnapshot
        self._calcular_matricula(fecha_snapshot, profesorado_id)

        # 2. Calcular AsistenciaSnapshot
        self._calcular_asistencia(fecha_snapshot, profesorado_id)

        # 3. Calcular AusentismoSnapshot
        self._calcular_ausentismo(fecha_snapshot, profesorado_id)

        self.stdout.write(
            self.style.SUCCESS("Snapshots calculados exitosamente.")
        )

    def _calcular_matricula(
        self, fecha_snapshot, profesorado_id: Optional[int] = None
    ):
        """Calcula y guarda MatriculaSnapshot."""
        profesorados = Profesorado.objects.all()
        if profesorado_id:
            profesorados = profesorados.filter(id=profesorado_id)

        for prof in profesorados:
            ec_qs = EstudianteCarrera.objects.filter(profesorado=prof)
            total = ec_qs.count()

            # Desglose por estado
            por_estado = {}
            for row in ec_qs.values("estado_academico").annotate(
                total=Count("id")
            ):
                por_estado[row["estado_academico"]] = row["total"]

            # Promedios de notas y asistencia
            reg_qs = Regularidad.objects.filter(
                materia__plan_de_estudio__profesorado=prof
            )
            promedio_notas = reg_qs.aggregate(avg=Avg("nota_final_cursada"))[
                "avg"
            ]
            promedio_asistencia = reg_qs.aggregate(
                avg=Avg("asistencia_porcentaje")
            )["avg"]

            MatriculaSnapshot.objects.update_or_create(
                profesorado=prof,
                fecha_snapshot=fecha_snapshot,
                defaults={
                    "total_matriculados": total,
                    "por_estado": por_estado,
                    "promedio_notas": (
                        round(promedio_notas, 2) if promedio_notas else None
                    ),
                    "promedio_asistencia": (
                        round(promedio_asistencia, 2)
                        if promedio_asistencia
                        else None
                    ),
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"MatriculaSnapshot calculado para {fecha_snapshot}"
            )
        )

    def _calcular_asistencia(
        self, fecha_snapshot, profesorado_id: Optional[int] = None
    ):
        """Calcula y guarda AsistenciaSnapshot de estudiantes por profesorado."""
        profesorados = Profesorado.objects.all()
        if profesorado_id:
            profesorados = profesorados.filter(id=profesorado_id)

        for prof in profesorados:
            # Filtra asistencias por comisiones de este profesorado
            comisiones = Comision.objects.filter(
                horario_catedra__profesorado=prof
            ).distinct()

            qs_asistencia = AsistenciaEstudiante.objects.filter(
                clase_programada__comision__in=comisiones
            )

            total_registros = qs_asistencia.count()
            if total_registros == 0:
                # Si no hay asistencias, crear snapshot con ceros
                AsistenciaSnapshot.objects.update_or_create(
                    profesorado=prof,
                    fecha_snapshot=fecha_snapshot,
                    defaults={
                        "total_registros": 0,
                        "presentes": 0,
                        "ausentes": 0,
                        "tardias": 0,
                        "justificadas": 0,
                        "porcentaje_asistencia": None,
                    },
                )
                continue

            # Contar estados
            presentes = qs_asistencia.filter(estado="presente").count()
            ausentes = qs_asistencia.filter(estado="ausente").count()
            tardias = qs_asistencia.filter(estado="tarde").count()
            justificadas = qs_asistencia.filter(
                estado="ausente", justificacion__isnull=False
            ).count()

            porcentaje = (
                (presentes / total_registros * 100)
                if total_registros > 0
                else None
            )

            AsistenciaSnapshot.objects.update_or_create(
                profesorado=prof,
                fecha_snapshot=fecha_snapshot,
                defaults={
                    "total_registros": total_registros,
                    "presentes": presentes,
                    "ausentes": ausentes,
                    "tardias": tardias,
                    "justificadas": justificadas,
                    "porcentaje_asistencia": (
                        round(porcentaje, 2) if porcentaje else None
                    ),
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"AsistenciaSnapshot calculado para {fecha_snapshot}"
            )
        )

    def _calcular_ausentismo(
        self, fecha_snapshot, profesorado_id: Optional[int] = None
    ):
        """Calcula y guarda AusentismoSnapshot por comisión."""
        comisiones = Comision.objects.all()
        if profesorado_id:
            comisiones = comisiones.filter(
                horario_catedra__profesorado_id=profesorado_id
            ).distinct()

        for comision in comisiones:
            prof = (
                comision.horario_catedra.first().profesorado
                if comision.horario_catedra.exists()
                else None
            )

            qs_asistencia = AsistenciaEstudiante.objects.filter(
                clase_programada__comision=comision
            )

            if not qs_asistencia.exists():
                continue

            total_registros = qs_asistencia.count()
            ausencias = qs_asistencia.filter(estado="ausente").count()
            tardias = qs_asistencia.filter(estado="tarde").count()

            tasa_ausentismo = (
                (ausencias / total_registros * 100)
                if total_registros > 0
                else 0
            )

            # Estudiantes únicos
            estudiantes = (
                qs_asistencia.values_list("estudiante", flat=True)
                .distinct()
                .count()
            )

            # Estudiantes críticos (>30% de ausencias)
            estudiantes_con_alta_ausencia = set()
            for est_id in (
                qs_asistencia.values_list("estudiante_id", flat=True)
                .distinct()
            ):
                qs_est = qs_asistencia.filter(estudiante_id=est_id)
                total_est = qs_est.count()
                ausencias_est = qs_est.filter(estado="ausente").count()
                if total_est > 0 and (ausencias_est / total_est > 0.3):
                    estudiantes_con_alta_ausencia.add(est_id)

            AusentismoSnapshot.objects.update_or_create(
                comision=comision,
                fecha_snapshot=fecha_snapshot,
                defaults={
                    "profesorado": prof,
                    "tasa_ausentismo": round(tasa_ausentismo, 2),
                    "total_estudiantes": estudiantes,
                    "estudiantes_críticos": len(estudiantes_con_alta_ausencia),
                    "detalles": {
                        "ausencias": ausencias,
                        "tardias": tardias,
                        "total_registros": total_registros,
                    },
                },
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"AusentismoSnapshot calculado para {fecha_snapshot}"
            )
        )
