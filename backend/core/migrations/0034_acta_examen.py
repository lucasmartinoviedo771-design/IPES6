from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0033_planillas_regularidad"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ActaExamen",
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
                ("codigo", models.CharField(max_length=64, unique=True)),
                ("numero", models.PositiveIntegerField(default=0)),
                ("anio_academico", models.IntegerField(default=0)),
                (
                    "tipo",
                    models.CharField(
                        choices=[("REG", "Regular"), ("LIB", "Libre")], max_length=4
                    ),
                ),
                ("anio_cursada", models.IntegerField(blank=True, null=True)),
                ("fecha", models.DateField()),
                ("folio", models.CharField(blank=True, max_length=64)),
                ("libro", models.CharField(blank=True, max_length=64)),
                ("observaciones", models.TextField(blank=True)),
                ("total_alumnos", models.PositiveIntegerField(default=0)),
                ("total_aprobados", models.PositiveIntegerField(default=0)),
                ("total_desaprobados", models.PositiveIntegerField(default=0)),
                ("total_ausentes", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="actas_examen_creadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "materia",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="actas_examen",
                        to="core.materia",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="actas_examen",
                        to="core.plandeestudio",
                    ),
                ),
                (
                    "profesorado",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="actas_examen",
                        to="core.profesorado",
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="actas_examen_actualizadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-fecha", "-id"],
                "unique_together": {("profesorado", "anio_academico", "numero")},
            },
        ),
        migrations.CreateModel(
            name="ActaExamenDocente",
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
                    "nombre",
                    models.CharField(max_length=255),
                ),
                ("dni", models.CharField(blank=True, max_length=32)),
                (
                    "rol",
                    models.CharField(
                        choices=[
                            ("PRES", "Presidente"),
                            ("VOC1", "Vocal 1"),
                            ("VOC2", "Vocal 2"),
                        ],
                        default="PRES",
                        max_length=4,
                    ),
                ),
                ("orden", models.PositiveIntegerField(default=1)),
                (
                    "acta",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="docentes",
                        to="core.actaexamen",
                    ),
                ),
                (
                    "docente",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="actas_examen",
                        to="core.docente",
                    ),
                ),
            ],
            options={
                "ordering": ["orden", "id"],
            },
        ),
        migrations.CreateModel(
            name="ActaExamenAlumno",
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
                ("numero_orden", models.PositiveIntegerField()),
                ("permiso_examen", models.CharField(blank=True, max_length=64)),
                ("dni", models.CharField(max_length=16)),
                ("apellido_nombre", models.CharField(max_length=255)),
                ("examen_escrito", models.CharField(blank=True, max_length=4)),
                ("examen_oral", models.CharField(blank=True, max_length=4)),
                ("calificacion_definitiva", models.CharField(max_length=4)),
                ("observaciones", models.TextField(blank=True)),
                (
                    "acta",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="alumnos",
                        to="core.actaexamen",
                    ),
                ),
            ],
            options={
                "ordering": ["numero_orden", "id"],
            },
        ),
    ]
