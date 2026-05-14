from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0052_profesorado_es_certificacion_docente"),
    ]

    operations = [
        migrations.CreateModel(
            name="MesaActaOral",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("acta_numero", models.CharField(blank=True, default="", max_length=64)),
                ("folio_numero", models.CharField(blank=True, default="", max_length=64)),
                ("fecha", models.DateField(blank=True, null=True)),
                ("curso", models.CharField(blank=True, default="", max_length=128)),
                ("nota_final", models.CharField(blank=True, default="", max_length=32)),
                ("observaciones", models.TextField(blank=True, default="")),
                ("temas_alumno", models.JSONField(blank=True, default=list)),
                ("temas_docente", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "inscripcion",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="acta_oral",
                        to="core.inscripcionmesa",
                    ),
                ),
                (
                    "mesa",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="actas_orales",
                        to="core.mesaexamen",
                    ),
                ),
            ],
            options={
                "verbose_name": "Acta de examen oral",
                "verbose_name_plural": "Actas de examen oral",
            },
        ),
    ]
