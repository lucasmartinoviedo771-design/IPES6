from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.asistencia.models import JustificacionDetalle
from core.models import (
    Estudiante,
    EstudianteCarrera,
    InscripcionMateriaEstudiante,
    InscripcionMesa,
    Regularidad,
    RiesgoAcademicoEstudiante,
)


class Command(BaseCommand):
    help = (
        "Calcula el semáforo de riesgo académico (Verde, Amarillo, Rojo) para todos los alumnos activos "
        "y genera un snapshot en RiesgoAcademicoEstudiante."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--anio",
            type=int,
            default=timezone.now().year,
            help="Año lectivo a evaluar (default año actual).",
        )
        parser.add_argument(
            "--fecha",
            type=str,
            default=None,
            help="Fecha del snapshot en formato YYYY-MM-DD (default hoy).",
        )

    def handle(self, *args, **options):
        anio_actual = options["anio"]
        hoy = timezone.now().date()
        if options["fecha"]:
            from datetime import datetime

            hoy = datetime.strptime(options["fecha"], "%Y-%m-%d").date()

        hace_12_meses = hoy - timedelta(days=365)
        hace_6_meses = hoy - timedelta(days=180)

        self.stdout.write(
            f"Iniciando cálculo de semáforo de riesgo para el ciclo {anio_actual} (fecha snapshot: {hoy})..."
        )

        # 1. Estudiantes con al menos una carrera activa
        estudiantes_activos = (
            Estudiante.objects.filter(carreras_detalle__estado_academico=EstudianteCarrera.EstadoAcademico.ACTIVO)
            .select_related("persona")
            .prefetch_related("carreras_detalle__profesorado")
            .distinct()
        )

        total_estudiantes = estudiantes_activos.count()
        self.stdout.write(f"Total estudiantes con carrera activa a procesar: {total_estudiantes}")
        if total_estudiantes == 0:
            self.stdout.write("No hay estudiantes activos para evaluar.")
            return

        est_ids = list(estudiantes_activos.values_list("id", flat=True))

        # 2. Precarga masiva en diccionarios para máxima performance O(1)

        # A) Inscripciones activas del ciclo lectivo actual
        inscripciones_actuales = set(
            InscripcionMateriaEstudiante.objects.filter(
                estudiante_id__in=est_ids,
                anio=anio_actual,
                estado=InscripcionMateriaEstudiante.Estado.CONFIRMADA,
            ).values_list("estudiante_id", flat=True)
        )

        # B) Justificaciones médicas/laborales aprobadas por (estudiante_id, materia_id)
        # Se cruza JustificacionDetalle -> clase (ClaseProgramada) -> comision -> materia_id
        justificaciones_aprobadas_qs = (
            JustificacionDetalle.objects.filter(
                estudiante_id__in=est_ids,
                justificacion__estado="APROBADA",
            )
            .select_related("clase__comision")
            .values_list("estudiante_id", "clase__comision__materia_id")
        )
        justificaciones_por_materia = set(justificaciones_aprobadas_qs)

        # C) Historial de recursados (Regularidades con situacion DPA, DTP, LBI, LAT)
        recursados_qs = (
            Regularidad.objects.filter(
                estudiante_id__in=est_ids,
                situacion__in=["DPA", "DTP", "LBI", "LAT"],
            )
            .values("estudiante_id", "materia_id")
            .annotate(intentos_fallidos=Count("id"))
        )

        recursados_map = {}
        for r in recursados_qs:
            recursados_map.setdefault(r["estudiante_id"], []).append(r["intentos_fallidos"])

        # D) Asistencias de regularidades cerradas recientes
        regularidades_recientes = (
            Regularidad.objects.filter(
                estudiante_id__in=est_ids,
                fecha_cierre__year__gte=anio_actual - 1,
            )
            .select_related("materia")
            .order_by("-fecha_cierre")
        )

        asistencias_por_estudiante = {}
        for reg in regularidades_recientes:
            asistencias_por_estudiante.setdefault(reg.estudiante_id, []).append(reg)

        # E) Finales rendidos (InscripcionMesa) ordenados por fecha ascendente
        mesas_qs = (
            InscripcionMesa.objects.filter(
                estudiante_id__in=est_ids,
                estado=InscripcionMesa.Estado.INSCRIPTO,
                condicion__isnull=False,
            )
            .select_related("mesa__materia")
            .order_by("mesa__fecha")
        )

        finales_por_estudiante = {}
        for im in mesas_qs:
            finales_por_estudiante.setdefault(im.estudiante_id, []).append(im)

        # 3. Evaluación de cada estudiante
        registros_a_guardar = []
        conteo_rojo = 0
        conteo_amarillo = 0
        conteo_verde = 0

        for est in estudiantes_activos:
            motivos_rojo = []
            motivos_amarillo = []

            # Obtener carrera activa y antigüedad
            carrera_activa = est.carreras_detalle.filter(
                estado_academico=EstudianteCarrera.EstadoAcademico.ACTIVO
            ).first()

            profesorado = carrera_activa.profesorado if carrera_activa else None
            anio_ingreso = None
            if carrera_activa and carrera_activa.anio_ingreso:
                anio_ingreso = carrera_activa.anio_ingreso
            elif est.anio_ingreso:
                anio_ingreso = est.anio_ingreso

            es_ingresante = anio_ingreso == anio_actual

            # --- Regla Inactividad 1: 0 inscripciones en ciclo lectivo actual ---
            if est.id not in inscripciones_actuales:
                motivos_rojo.append(f"0 inscripciones a materias en el ciclo lectivo {anio_actual}")

            # --- Regla Finales: Inactividad y Aplazos consecutivos (Criterio 2) ---
            finales = finales_por_estudiante.get(est.id, [])
            if finales:
                ultimo_final = finales[-1].mesa.fecha
                if ultimo_final < hace_12_meses and not es_ingresante:
                    meses = (hoy - ultimo_final).days // 30
                    motivos_rojo.append(f"Más de 12 meses sin rendir finales (último hace {meses} meses)")
                elif ultimo_final < hace_6_meses and not es_ingresante:
                    motivos_amarillo.append("Sin rendir exámenes finales en los últimos 6 meses")

                # Evaluación de aplazos consecutivos:
                # Regla 2 institucional:
                # - 2 aplazos consecutivos en la MISMA materia = ROJO
                # - 2 aplazos en mesas consecutivas de DISTINTAS materias = AMARILLO
                # Racha consecutiva global (reversa):
                aplazos_consecutivos_global = 0
                materias_aplazos = []
                for f in reversed(finales):
                    es_aplazo = (f.nota is not None and f.nota < 6) or f.condicion == "DES"
                    if es_aplazo:
                        aplazos_consecutivos_global += 1
                        materias_aplazos.append(f.mesa.materia_id)
                        if aplazos_consecutivos_global >= 2:
                            break
                    elif f.condicion == "APR":
                        break

                if aplazos_consecutivos_global >= 2:
                    # Chequear si son la misma materia
                    if len(set(materias_aplazos)) == 1:
                        motivos_rojo.append("2 aplazos consecutivos en la misma materia")
                    else:
                        motivos_amarillo.append("2 aplazos consecutivos en materias distintas")
                elif aplazos_consecutivos_global == 1:
                    ultimo_m = finales[-1].mesa.materia.nombre
                    motivos_amarillo.append(f"1 aplazo reciente en {ultimo_m}")

            else:
                # No registra finales
                if not es_ingresante:
                    motivos_amarillo.append("Sin exámenes finales rendidos en su trayectoria")

            # --- Regla Recursado ---
            intentos = recursados_map.get(est.id, [])
            if any(fallos >= 2 for fallos in intentos):
                # 2 cierres no aprobados = cursando por 3ra vez
                motivos_rojo.append("Recursando una misma materia por 3ra vez")
            elif any(fallos == 1 for fallos in intentos):
                motivos_amarillo.append("Recursando materia por 2da vez")

            # --- Regla Asistencia según Formato y Excepciones Puntuales ---
            regularidades = asistencias_por_estudiante.get(est.id, [])
            for reg in regularidades:
                pct = reg.asistencia_porcentaje
                if pct is None:
                    continue

                fmt = reg.materia.formato
                tiene_excepcion = reg.excepcion or (est.id, reg.materia_id) in justificaciones_por_materia

                # Umbrales
                if fmt in ["PRA", "TAL", "LAB"]:  # Grupo 80%
                    umbral_verde = 70 if tiene_excepcion else 80
                else:  # Grupo 65% (ASI, MOD, SEM)
                    umbral_verde = 50 if tiene_excepcion else 65

                if pct <= 50:
                    motivos_rojo.append(f"Asistencia crítica ({pct}%) en {reg.materia.nombre}")
                elif pct < umbral_verde:
                    motivos_amarillo.append(f"Asistencia en alerta ({pct}%) en {reg.materia.nombre}")

            # --- Consolidación del Nivel ---
            if motivos_rojo:
                nivel = RiesgoAcademicoEstudiante.NivelRiesgo.ROJO
                motivos_finales = motivos_rojo
                conteo_rojo += 1
            elif motivos_amarillo:
                nivel = RiesgoAcademicoEstudiante.NivelRiesgo.AMARILLO
                motivos_finales = motivos_amarillo
                conteo_amarillo += 1
            else:
                nivel = RiesgoAcademicoEstudiante.NivelRiesgo.VERDE
                motivos_finales = ["Trayectoria académica regular"]
                conteo_verde += 1

            registros_a_guardar.append(
                RiesgoAcademicoEstudiante(
                    estudiante=est,
                    profesorado=profesorado,
                    nivel_riesgo=nivel,
                    motivos=motivos_finales,
                    fecha_calculo=hoy,
                )
            )

        # 4. Guardado atómico con preservación de snapshots por fecha
        with transaction.atomic():
            # Si ya se corrió hoy, actualizamos el snapshot del día
            RiesgoAcademicoEstudiante.objects.filter(fecha_calculo=hoy).delete()
            RiesgoAcademicoEstudiante.objects.bulk_create(registros_a_guardar, batch_size=500)

        self.stdout.write(
            self.style.SUCCESS(
                f"Cálculo completado exitosamente para la fecha {hoy}:\n"
                f" - 🔴 Rojos (Riesgo Crítico): {conteo_rojo}\n"
                f" - 🟡 Amarillos (Riesgo Medio): {conteo_amarillo}\n"
                f" - 🟢 Verdes (Trayectoria Regular): {conteo_verde}\n"
                f" - Total procesados: {len(registros_a_guardar)}"
            )
        )
