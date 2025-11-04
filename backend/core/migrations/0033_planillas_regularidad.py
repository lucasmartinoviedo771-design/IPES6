from django.db import migrations, models
import django.db.models.deletion


def bootstrap_regularidad_templates(apps, schema_editor):
    RegularidadFormato = apps.get_model("core", "RegularidadFormato")
    RegularidadPlantilla = apps.get_model("core", "RegularidadPlantilla")

    templates = [
        {
            "formato": {
                "slug": "taller",
                "nombre": "Taller",
                "descripcion": "Planillas para espacios curriculares con formato Taller.",
            },
            "plantillas": [
                {
                    "dictado": "ANUAL",
                    "nombre": "Taller - Anual",
                    "columnas": [
                        {"key": "tp_1c", "label": "TP 1° C.", "type": "number", "optional": True},
                        {"key": "tp_2c", "label": "TP 2° C.", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "APROBADO",
                            "label": "APROBADO",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia y cumple con las evaluaciones.",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "1C",
                    "nombre": "Taller - 1° Cuatrimestre",
                    "columnas": [
                        {"key": "tp_1c", "label": "TP 1° C.", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "APROBADO",
                            "label": "APROBADO",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia y cumple con las evaluaciones.",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "2C",
                    "nombre": "Taller - 2° Cuatrimestre",
                    "columnas": [
                        {"key": "tp_1c", "label": "TP 1° C.", "type": "number", "optional": True},
                        {"key": "tp_2c", "label": "TP 2° C.", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "APROBADO",
                            "label": "APROBADO",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia y cumple con las evaluaciones.",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
            ],
        },
        {
            "formato": {
                "slug": "asignatura",
                "nombre": "Asignatura",
                "descripcion": "Planillas para espacios con formato Asignatura.",
            },
            "plantillas": [
                {
                    "dictado": "ANUAL",
                    "nombre": "Asignatura - Anual",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_1p", "label": "Parcial 1° C. (P)", "type": "number", "optional": True},
                        {"key": "parcial_1r", "label": "Parcial 1° C. (R)", "type": "number", "optional": True},
                        {"key": "parcial_2p", "label": "Parcial 2° C. (P)", "type": "number", "optional": True},
                        {"key": "parcial_2r", "label": "Parcial 2° C. (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "1C",
                    "nombre": "Asignatura - 1° Cuatrimestre",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_p", "label": "Parcial (P)", "type": "number", "optional": True},
                        {"key": "parcial_r", "label": "Parcial (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "2C",
                    "nombre": "Asignatura - 2° Cuatrimestre",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_p", "label": "Parcial (P)", "type": "number", "optional": True},
                        {"key": "parcial_r", "label": "Parcial (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con el régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
            ],
        },
        {
            "formato": {
                "slug": "modulo",
                "nombre": "Módulo",
                "descripcion": "Planillas para espacios curriculares con formato Módulo.",
            },
            "plantillas": [
                {
                    "dictado": "ANUAL",
                    "nombre": "Módulo - Anual",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_1p", "label": "Parcial 1° C. (P)", "type": "number", "optional": True},
                        {"key": "parcial_1r", "label": "Parcial 1° C. (R)", "type": "number", "optional": True},
                        {"key": "parcial_2p", "label": "Parcial 2° C. (P)", "type": "number", "optional": True},
                        {"key": "parcial_2r", "label": "Parcial 2° C. (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "PROMOCION",
                            "label": "PROMOCIÓN",
                            "color": "#ffc000",
                            "descripcion": "Cumple con asistencia (80%), aprueba TP y aprueba parcial o recuperatorio (nota final 8/10).",
                        },
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "1C",
                    "nombre": "Módulo - 1° Cuatrimestre",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_p", "label": "Parcial (P)", "type": "number", "optional": True},
                        {"key": "parcial_r", "label": "Parcial (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
                {
                    "dictado": "2C",
                    "nombre": "Módulo - 2° Cuatrimestre",
                    "columnas": [
                        {"key": "tp", "label": "TP", "type": "number", "optional": True},
                        {"key": "parcial_p", "label": "Parcial (P)", "type": "number", "optional": True},
                        {"key": "parcial_r", "label": "Parcial (R)", "type": "number", "optional": True},
                    ],
                    "situaciones": [
                        {
                            "codigo": "REGULAR",
                            "label": "REGULAR",
                            "color": "#f4b083",
                            "descripcion": "Cumple con régimen de asistencia, aprueba TP y aprueba parcial o recuperatorio (nota final 6/10).",
                        },
                        {
                            "codigo": "DESAPROBADO_TP",
                            "label": "DESAPROBADO_TP",
                            "color": "#ff0000",
                            "descripcion": "Desaprueba TP y sus recuperatorios (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "DESAPROBADO_PA",
                            "label": "DESAPROBADO_PA",
                            "color": "#c00000",
                            "descripcion": "Desaprueba la instancia de parcial y/o recuperatorio (FORMATO TALLER, MÓDULO y ASIG.).",
                        },
                        {
                            "codigo": "LIBRE-I",
                            "label": "LIBRE-I",
                            "color": "#00b0f0",
                            "descripcion": "Libre por inasistencias (menos del 65% de la cursada).",
                        },
                        {
                            "codigo": "LIBRE-AT",
                            "label": "LIBRE-AT",
                            "color": "#92d050",
                            "descripcion": "Libre por abandono temprano (antes de la mitad de la cursada).",
                        },
                    ],
                },
            ],
        },
    ]

    for entry in templates:
        formato_data = entry["formato"]
        formato, _ = RegularidadFormato.objects.get_or_create(
            slug=formato_data["slug"],
            defaults={
                "nombre": formato_data["nombre"],
                "descripcion": formato_data.get("descripcion", ""),
            },
        )
        for plantilla in entry["plantillas"]:
            RegularidadPlantilla.objects.update_or_create(
                formato=formato,
                dictado=plantilla["dictado"],
                defaults={
                    "nombre": plantilla["nombre"],
                    "descripcion": plantilla.get("descripcion", ""),
                    "columnas": plantilla.get("columnas", []),
                    "situaciones": plantilla.get("situaciones", []),
                    "referencias": [
                        {"valor": s["label"], "descripcion": s.get("descripcion", ""), "color": s.get("color", "")}
                        for s in plantilla.get("situaciones", [])
                    ],
                },
            )


def revert_regularidad_templates(apps, schema_editor):
    RegularidadPlantilla = apps.get_model("core", "RegularidadPlantilla")
    RegularidadFormato = apps.get_model("core", "RegularidadFormato")
    RegularidadPlantilla.objects.all().delete()
    RegularidadFormato.objects.filter(slug__in=["taller", "asignatura", "modulo"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0032_preinscripcionchecklist_curso_introductorio"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="RegularidadFormato",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=32, unique=True)),
                ("nombre", models.CharField(max_length=64)),
                ("descripcion", models.TextField(blank=True, null=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["nombre"],
            },
        ),
        migrations.CreateModel(
            name="RegularidadPlantilla",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("dictado", models.CharField(choices=[("ANUAL", "Anual"), ("1C", "1° Cuatrimestre"), ("2C", "2° Cuatrimestre")], max_length=8)),
                ("nombre", models.CharField(max_length=128)),
                ("descripcion", models.TextField(blank=True, null=True)),
                ("columnas", models.JSONField(blank=True, default=list)),
                ("situaciones", models.JSONField(blank=True, default=list)),
                ("referencias", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("formato", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="plantillas", to="core.regularidadformato")),
            ],
            options={
                "ordering": ["formato__nombre", "dictado"],
                "unique_together": {("formato", "dictado")},
            },
        ),
        migrations.CreateModel(
            name="PlanillaRegularidad",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("codigo", models.CharField(max_length=64, unique=True)),
                ("numero", models.PositiveIntegerField(default=0)),
                ("anio_academico", models.IntegerField(default=0)),
                ("plan_resolucion", models.CharField(blank=True, max_length=128)),
                ("folio", models.CharField(blank=True, max_length=32)),
                ("fecha", models.DateField()),
                ("observaciones", models.TextField(blank=True)),
                ("estado", models.CharField(choices=[("draft", "Borrador"), ("final", "Finalizada")], default="final", max_length=16)),
                ("datos_adicionales", models.JSONField(blank=True, default=dict)),
                ("pdf", models.FileField(blank=True, null=True, upload_to="planillas_regularidad/%Y/%m/%d")),
                ("dictado", models.CharField(choices=[("ANUAL", "Anual"), ("1C", "1° Cuatrimestre"), ("2C", "2° Cuatrimestre")], max_length=8)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="planillas_regularidad_creadas", to="auth.user")),
                ("formato", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="planillas", to="core.regularidadformato")),
                ("materia", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="planillas_regularidad", to="core.materia")),
                ("plantilla", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="planillas", to="core.regularidadplantilla")),
                ("profesorado", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="planillas_regularidad", to="core.profesorado")),
                ("updated_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="planillas_regularidad_actualizadas", to="auth.user")),
            ],
            options={
                "ordering": ["-fecha", "codigo"],
            },
        ),
        migrations.CreateModel(
            name="PlanillaRegularidadDocente",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nombre", models.CharField(max_length=255)),
                ("dni", models.CharField(blank=True, max_length=20)),
                ("rol", models.CharField(choices=[("profesor", "Profesor/a"), ("bedel", "Bedel"), ("otro", "Otro")], default="profesor", max_length=16)),
                ("orden", models.PositiveIntegerField(default=1)),
                ("docente", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="planillas_regularidad", to="core.docente")),
                ("planilla", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="docentes", to="core.planillaregularidad")),
            ],
            options={
                "ordering": ["orden", "id"],
            },
        ),
        migrations.CreateModel(
            name="PlanillaRegularidadFila",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("orden", models.PositiveIntegerField()),
                ("dni", models.CharField(max_length=20)),
                ("apellido_nombre", models.CharField(max_length=255)),
                ("nota_final", models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True)),
                ("asistencia_porcentaje", models.IntegerField(blank=True, null=True)),
                ("situacion", models.CharField(max_length=32)),
                ("excepcion", models.BooleanField(default=False)),
                ("datos", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("estudiante", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="planillas_regularidad", to="core.estudiante")),
                ("planilla", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="filas", to="core.planillaregularidad")),
            ],
            options={
                "ordering": ["orden", "id"],
                "unique_together": {("planilla", "orden")},
            },
        ),
        migrations.CreateModel(
            name="PlanillaRegularidadHistorial",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("accion", models.CharField(choices=[("create", "Creación"), ("update", "Edición"), ("delete_row", "Eliminación de fila"), ("regenerate_pdf", "Regeneración de PDF")], max_length=32)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("planilla", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="historial", to="core.planillaregularidad")),
                ("usuario", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="planillas_regularidad_historial", to="auth.user")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="planillaregularidad",
            index=models.Index(fields=["profesorado", "anio_academico"], name="core_planil_profeso_e43bd0_idx"),
        ),
        migrations.AddIndex(
            model_name="planillaregularidad",
            index=models.Index(fields=["materia", "fecha"], name="core_planil_materia_9c2ae7_idx"),
        ),
        migrations.RunPython(bootstrap_regularidad_templates, revert_regularidad_templates),
    ]
