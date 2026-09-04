# Generated migration for metrics app - Snapshots model

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="MatriculaSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("fecha_snapshot", models.DateField(db_index=True)),
                ("total_matriculados", models.IntegerField(default=0)),
                (
                    "por_estado",
                    models.JSONField(
                        default=dict,
                        help_text="Desglose por estado_academico: {'activo': N, 'libre': N, ...}",
                    ),
                ),
                ("promedio_notas", models.FloatField(blank=True, null=True)),
                ("promedio_asistencia", models.FloatField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profesorado",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="matricula_snapshots",
                        to="core.profesorado",
                    ),
                ),
            ],
            options={
                "verbose_name": "Snapshot de Matrícula",
                "verbose_name_plural": "Snapshots de Matrícula",
                "ordering": ["-fecha_snapshot"],
            },
        ),
        migrations.CreateModel(
            name="AsistenciaSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("fecha_snapshot", models.DateField(db_index=True)),
                ("total_registros", models.IntegerField(default=0)),
                ("presentes", models.IntegerField(default=0)),
                ("ausentes", models.IntegerField(default=0)),
                ("tardias", models.IntegerField(default=0)),
                ("justificadas", models.IntegerField(default=0)),
                ("porcentaje_asistencia", models.FloatField(blank=True, null=True)),
                (
                    "detalles",
                    models.JSONField(
                        default=dict,
                        help_text="Detalles adicionales por comisión si aplica.",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "profesorado",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencia_snapshots",
                        to="core.profesorado",
                    ),
                ),
            ],
            options={
                "verbose_name": "Snapshot de Asistencia",
                "verbose_name_plural": "Snapshots de Asistencia",
                "ordering": ["-fecha_snapshot"],
            },
        ),
        migrations.CreateModel(
            name="AusentismoSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("fecha_snapshot", models.DateField(db_index=True)),
                (
                    "tasa_ausentismo",
                    models.FloatField(
                        help_text="Porcentaje de ausencias sobre total de asistencias registradas."
                    ),
                ),
                ("total_estudiantes", models.IntegerField(default=0)),
                ("estudiantes_sin_registro", models.IntegerField(default=0)),
                (
                    "estudiantes_críticos",
                    models.IntegerField(
                        default=0,
                        help_text="Estudiantes con más del 30% de ausencias.",
                    ),
                ),
                (
                    "detalles",
                    models.JSONField(
                        default=dict,
                        help_text="Desglose: {'ausencias': N, 'tardias': N, 'total_clases': N, ...}",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "comision",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ausentismo_snapshots",
                        to="core.comision",
                    ),
                ),
                (
                    "profesorado",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ausentismo_snapshots",
                        to="core.profesorado",
                    ),
                ),
            ],
            options={
                "verbose_name": "Snapshot de Ausentismo",
                "verbose_name_plural": "Snapshots de Ausentismo",
                "ordering": ["-fecha_snapshot"],
            },
        ),
        migrations.AddIndex(
            model_name="asistenciasnapshot",
            index=models.Index(fields=["fecha_snapshot"], name="metrics_asi_fecha_s_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciasnapshot",
            index=models.Index(
                fields=["profesorado", "fecha_snapshot"], name="metrics_asi_profeso_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="asistenciasnapshot",
            index=models.Index(fields=["fecha_snapshot"], name="metrics_aua_fecha_s_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciasnapshot",
            index=models.Index(
                fields=["profesorado", "fecha_snapshot"], name="metrics_aua_profeso_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="matriculasnapshot",
            index=models.Index(fields=["fecha_snapshot"], name="metrics_mat_fecha_s_idx"),
        ),
        migrations.AddIndex(
            model_name="matriculasnapshot",
            index=models.Index(
                fields=["profesorado", "fecha_snapshot"],
                name="metrics_mat_profeso_idx",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="asistenciasnapshot",
            unique_together={("profesorado", "fecha_snapshot")},
        ),
        migrations.AlterUniqueTogether(
            name="ausentismosnapshot",
            unique_together={("comision", "fecha_snapshot")},
        ),
        migrations.AlterUniqueTogether(
            name="matriculasnapshot",
            unique_together={("profesorado", "fecha_snapshot")},
        ),
    ]
