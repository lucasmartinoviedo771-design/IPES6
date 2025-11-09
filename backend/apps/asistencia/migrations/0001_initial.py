from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0035_rename_core_planil_profeso_e43bd0_idx_core_planil_profeso_3a564c_idx_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClaseProgramada",
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
                ("fecha", models.DateField()),
                ("hora_inicio", models.TimeField(blank=True, null=True)),
                ("hora_fin", models.TimeField(blank=True, null=True)),
                ("docente_dni", models.CharField(blank=True, max_length=20)),
                (
                    "docente_nombre",
                    models.CharField(
                        blank=True,
                        help_text="Snapshot amigable del docente asignado al momento de crear la clase.",
                        max_length=255,
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("programada", "Programada"),
                            ("en_curso", "En curso"),
                            ("impartida", "Impartida"),
                            ("cancelada", "Cancelada"),
                        ],
                        default="programada",
                        max_length=20,
                    ),
                ),
                ("notas", models.TextField(blank=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Clase programada",
                "verbose_name_plural": "Clases programadas",
            },
        ),
        migrations.CreateModel(
            name="CursoHorarioSnapshot",
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
                (
                    "dia_semana",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (0, "Domingo"),
                            (1, "Lunes"),
                            (2, "Martes"),
                            (3, "Miércoles"),
                            (4, "Jueves"),
                            (5, "Viernes"),
                            (6, "Sábado"),
                        ]
                    ),
                ),
                ("hora_inicio", models.TimeField()),
                ("hora_fin", models.TimeField()),
                (
                    "origen_id",
                    models.CharField(
                        blank=True,
                        help_text="Identificador de referencia del sistema fuente.",
                        max_length=64,
                    ),
                ),
                (
                    "sincronizado_en",
                    models.DateTimeField(
                        auto_now=True,
                        help_text="Fecha de la última sincronización del horario.",
                    ),
                ),
                (
                    "comision",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencia_horarios",
                        to="core.comision",
                    ),
                ),
            ],
            options={
                "verbose_name": "Horario de curso (snapshot)",
                "verbose_name_plural": "Horarios de curso (snapshot)",
            },
        ),
        migrations.CreateModel(
            name="Justificacion",
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
                (
                    "tipo",
                    models.CharField(
                        choices=[("estudiante", "Estudiante"), ("docente", "Docente")],
                        max_length=16,
                    ),
                ),
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("pendiente", "Pendiente"),
                            ("aprobada", "Aprobada"),
                            ("rechazada", "Rechazada"),
                        ],
                        default="pendiente",
                        max_length=16,
                    ),
                ),
                ("motivo", models.CharField(max_length=255)),
                ("observaciones", models.TextField(blank=True)),
                ("archivo_url", models.URLField(blank=True)),
                ("vigencia_desde", models.DateField()),
                ("vigencia_hasta", models.DateField()),
                (
                    "origen",
                    models.CharField(
                        choices=[("anticipada", "Anticipada"), ("posterior", "Posterior")],
                        max_length=12,
                    ),
                ),
                ("aprobado_en", models.DateTimeField(blank=True, null=True)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "aprobado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="justificaciones_aprobadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "creado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="justificaciones_creadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Justificación",
                "verbose_name_plural": "Justificaciones",
                "ordering": ["-creado_en"],
            },
        ),
        migrations.CreateModel(
            name="CursoAlumnoSnapshot",
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
                ("dni", models.CharField(max_length=16)),
                ("apellido", models.CharField(max_length=128)),
                ("nombre", models.CharField(max_length=128)),
                ("activo", models.BooleanField(default=True)),
                ("sincronizado_en", models.DateTimeField(auto_now=True)),
                (
                    "comision",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencia_alumnos",
                        to="core.comision",
                    ),
                ),
                (
                    "estudiante",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asistencia_comisiones",
                        to="core.estudiante",
                    ),
                ),
            ],
            options={
                "verbose_name": "Alumno de curso (snapshot)",
                "verbose_name_plural": "Alumnos de curso (snapshot)",
            },
        ),
        migrations.CreateModel(
            name="AsistenciaDocente",
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
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("presente", "Presente"),
                            ("ausente", "Ausente"),
                            ("justificada", "Justificada"),
                        ],
                        default="presente",
                        max_length=16,
                    ),
                ),
                (
                    "registrado_via",
                    models.CharField(
                        choices=[
                            ("docente", "Docente (autoregistro)"),
                            ("staff", "Staff administrativo"),
                            ("sistema", "Sistema"),
                        ],
                        default="docente",
                        max_length=12,
                    ),
                ),
                ("registrado_en", models.DateTimeField(auto_now_add=True)),
                ("observaciones", models.TextField(blank=True)),
                (
                    "clase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencia_docentes",
                        to="asistencia.claseprogramada",
                    ),
                ),
                (
                    "docente",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencias_docentes",
                        to="core.docente",
                    ),
                ),
                (
                    "justificacion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asistencias_docentes",
                        to="asistencia.justificacion",
                    ),
                ),
                (
                    "registrado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asistencias_docentes_registradas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Asistencia de docente",
                "verbose_name_plural": "Asistencias de docentes",
            },
        ),
        migrations.CreateModel(
            name="AsistenciaAlumno",
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
                (
                    "estado",
                    models.CharField(
                        choices=[
                            ("presente", "Presente"),
                            ("ausente", "Ausente"),
                            ("ausente_justificada", "Ausente justificada"),
                        ],
                        default="ausente",
                        max_length=24,
                    ),
                ),
                (
                    "registrado_via",
                    models.CharField(
                        choices=[
                            ("docente", "Docente"),
                            ("staff", "Staff"),
                            ("sistema", "Sistema"),
                        ],
                        default="docente",
                        max_length=12,
                    ),
                ),
                ("registrado_en", models.DateTimeField(auto_now_add=True)),
                ("observaciones", models.TextField(blank=True)),
                (
                    "clase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencias_estudiantes",
                        to="asistencia.claseprogramada",
                    ),
                ),
                (
                    "estudiante",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="asistencias",
                        to="core.estudiante",
                    ),
                ),
                (
                    "justificacion",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asistencias_estudiantes",
                        to="asistencia.justificacion",
                    ),
                ),
                (
                    "registrado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="asistencias_estudiantes_registradas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Asistencia de estudiante",
                "verbose_name_plural": "Asistencias de estudiantes",
            },
        ),
        migrations.CreateModel(
            name="JustificacionDetalle",
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
                ("aplica_automaticamente", models.BooleanField(default=True)),
                (
                    "clase",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="justificaciones",
                        to="asistencia.claseprogramada",
                    ),
                ),
                (
                    "docente",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="justificaciones_asistencia",
                        to="core.docente",
                    ),
                ),
                (
                    "estudiante",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="justificaciones_asistencia",
                        to="core.estudiante",
                    ),
                ),
                (
                    "justificacion",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="detalles",
                        to="asistencia.justificacion",
                    ),
                ),
            ],
            options={
                "verbose_name": "Detalle de justificación",
                "verbose_name_plural": "Detalles de justificación",
            },
        ),
        migrations.AddField(
            model_name="claseprogramada",
            name="comision",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="clases_programadas",
                to="core.comision",
            ),
        ),
        migrations.AddField(
            model_name="claseprogramada",
            name="docente",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="clases_asignadas_asistencia",
                to="core.docente",
            ),
        ),
        migrations.AddConstraint(
            model_name="justificaciondetalle",
            constraint=models.UniqueConstraint(
                condition=models.Q(("estudiante__isnull", False)),
                fields=("justificacion", "clase", "estudiante"),
                name="unique_justificacion_clase_estudiante",
            ),
        ),
        migrations.AddConstraint(
            model_name="justificaciondetalle",
            constraint=models.UniqueConstraint(
                condition=models.Q(("docente__isnull", False)),
                fields=("justificacion", "clase", "docente"),
                name="unique_justificacion_clase_docente",
            ),
        ),
        migrations.AddIndex(
            model_name="claseprogramada",
            index=models.Index(fields=["fecha"], name="asistencia__fecha_3b6ecf_idx"),
        ),
        migrations.AddIndex(
            model_name="claseprogramada",
            index=models.Index(fields=["comision", "fecha"], name="asistencia__comisio_3f4b96_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciaalumno",
            index=models.Index(fields=["clase", "estado"], name="asistencia__clase__47a97c_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciaalumno",
            index=models.Index(fields=["estudiante", "estado"], name="asistencia__estudi_7d3f7f_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciadocente",
            index=models.Index(fields=["clase"], name="asistencia__clase__f207ca_idx"),
        ),
        migrations.AddIndex(
            model_name="asistenciadocente",
            index=models.Index(fields=["docente", "estado"], name="asistencia__docent_6e90c3_idx"),
        ),
        migrations.AlterUniqueTogether(
            name="asistenciaalumno",
            unique_together={("clase", "estudiante")},
        ),
        migrations.AlterUniqueTogether(
            name="asistenciadocente",
            unique_together={("clase", "docente")},
        ),
        migrations.AlterUniqueTogether(
            name="claseprogramada",
            unique_together={("comision", "fecha", "hora_inicio", "hora_fin")},
        ),
        migrations.AlterUniqueTogether(
            name="cursoalumnosnapshot",
            unique_together={("comision", "dni")},
        ),
        migrations.AlterUniqueTogether(
            name="cursohorariosnapshot",
            unique_together={("comision", "dia_semana", "hora_inicio", "hora_fin")},
        ),
    ]
