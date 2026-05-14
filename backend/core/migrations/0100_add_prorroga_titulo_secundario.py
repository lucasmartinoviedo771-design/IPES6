from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0099_add_numero_mesa_to_mesaexamen"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProrrogaTituloSecundario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fecha_otorgada", models.DateField()),
                ("fecha_vencimiento", models.DateField()),
                ("observaciones", models.TextField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "estudiante",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="prorrogas_titulo",
                        to="core.estudiante",
                    ),
                ),
                (
                    "autorizado_por",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="prorrogas_otorgadas",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Prórroga título secundario",
                "verbose_name_plural": "Prórrogas título secundario",
                "ordering": ["-fecha_vencimiento"],
            },
        ),
    ]
