from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0101_equivalenciadisposiciondetalle_en_resguardo"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ResidenciaCondicional",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ciclo_lectivo", models.PositiveIntegerField(help_text="Año lectivo de la inscripción condicional.")),
                ("fecha_limite", models.DateField(help_text="01/06 del ciclo lectivo — fecha límite para aprobar.")),
                ("aceptada_en", models.DateTimeField(auto_now_add=True)),
                ("resuelta", models.BooleanField(default=False, help_text="True cuando el estudiante aprobó la materia pendiente antes del límite.")),
                ("caida", models.BooleanField(default=False, help_text="True cuando venció el plazo sin aprobar y la Residencia cayó.")),
                ("autorizado_por", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="residencias_condicionales_autorizadas",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("estudiante", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="residencias_condicionales",
                    to="core.estudiante",
                )),
                ("materia_pendiente", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="residencias_condicionales_pendientes",
                    to="core.materia",
                    help_text="La única materia que adeuda y debe aprobar en mayo.",
                )),
                ("materia_residencia", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="inscripciones_condicionales",
                    to="core.materia",
                    help_text="Materia de Residencia en la que se inscribió condicionalmente.",
                )),
            ],
            options={
                "verbose_name": "Residencia condicional",
                "verbose_name_plural": "Residencias condicionales",
                "ordering": ["-ciclo_lectivo", "estudiante"],
            },
        ),
        migrations.AddConstraint(
            model_name="residenciacondicional",
            constraint=models.UniqueConstraint(
                fields=["estudiante", "materia_residencia", "ciclo_lectivo"],
                name="unique_residencia_condicional_por_ciclo",
            ),
        ),
    ]
