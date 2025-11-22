from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0055_create_default_turnos"),
    ]

    operations = [
        migrations.CreateModel(
            name="RegularidadPlanillaLock",
            fields=[
                (
                    "id",
                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID"),
                ),
                ("anio_virtual", models.IntegerField(blank=True, null=True)),
                ("cerrado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "cerrado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="regularidad_planillas_cerradas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "comision",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="regularidad_lock",
                        to="core.comision",
                    ),
                ),
                (
                    "materia",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="regularidad_locks",
                        to="core.materia",
                    ),
                ),
            ],
        ),
        migrations.AddField(
            model_name="mesaexamen",
            name="planilla_cerrada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mesaexamen",
            name="planilla_cerrada_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="mesas_planillas_cerradas",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddConstraint(
            model_name="regularidadplanillalock",
            constraint=models.UniqueConstraint(
                fields=("materia", "anio_virtual"), name="uniq_regularidad_lock_materia_anio"
            ),
        ),
        migrations.AddConstraint(
            model_name="regularidadplanillalock",
            constraint=models.CheckConstraint(
                condition=models.Q(comision__isnull=False)
                | (models.Q(materia__isnull=False) & models.Q(anio_virtual__isnull=False)),
                name="regularidad_lock_scope_defined",
            ),
        ),
    ]
