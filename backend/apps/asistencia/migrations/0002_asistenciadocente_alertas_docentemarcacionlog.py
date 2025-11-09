from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0035_rename_core_planil_profeso_e43bd0_idx_core_planil_profeso_3a564c_idx_and_more"),
        ("asistencia", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="asistenciadocente",
            name="alerta",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="asistenciadocente",
            name="alerta_motivo",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="asistenciadocente",
            name="alerta_tipo",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="asistenciadocente",
            name="marcacion_categoria",
            field=models.CharField(
                choices=[("normal", "Normal"), ("tarde", "Llegada tarde")],
                default="normal",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="asistenciadocente",
            name="marcada_en_turno",
            field=models.CharField(
                blank=True,
                help_text="Nombre del turno al momento de registrar la asistencia.",
                max_length=64,
            ),
        ),
        migrations.AddIndex(
            model_name="asistenciadocente",
            index=models.Index(fields=["docente", "registrado_en"], name="asistencia__docent_1279d7_idx"),
        ),
        migrations.CreateModel(
            name="DocenteMarcacionLog",
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
                ("dni", models.CharField(max_length=20)),
                (
                    "resultado",
                    models.CharField(
                        choices=[
                            ("typing", "Ingreso parcial"),
                            ("aceptado", "Marcación aceptada"),
                            ("rechazado", "Marcación rechazada"),
                        ],
                        max_length=16,
                    ),
                ),
                ("detalle", models.CharField(blank=True, max_length=255)),
                ("alerta", models.BooleanField(default=False)),
                ("registrado_en", models.DateTimeField(auto_now_add=True)),
                (
                    "origen",
                    models.CharField(
                        blank=True,
                        help_text="Identificador del origen (ej. kiosk).",
                        max_length=32,
                    ),
                ),
                (
                    "clase",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="marcaciones_log",
                        to="asistencia.claseprogramada",
                    ),
                ),
                (
                    "docente",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="marcaciones_log",
                        to="core.docente",
                    ),
                ),
            ],
            options={
                "verbose_name": "Log de marcación docente",
                "verbose_name_plural": "Logs de marcación docente",
                "ordering": ["-registrado_en"],
            },
        ),
        migrations.AddIndex(
            model_name="docentemarcacionlog",
            index=models.Index(fields=["dni", "registrado_en"], name="asistencia__dni_regi_7522bb_idx"),
        ),
        migrations.AddIndex(
            model_name="docentemarcacionlog",
            index=models.Index(fields=["resultado"], name="asistencia__result_82a876_idx"),
        ),
    ]
