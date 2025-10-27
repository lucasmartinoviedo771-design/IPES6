from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0024_estudiante_must_change_password"),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffAsignacion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rol", models.CharField(choices=[("bedel", "Bedel"), ("coordinador", "Coordinador")], max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("profesorado", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="staff_asignaciones", to="core.profesorado")),
                ("user", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="asignaciones_profesorado", to="auth.user")),
            ],
            options={
                "verbose_name": "Asignaci√≥n de staff",
                "verbose_name_plural": "Asignaciones de staff",
                "unique_together": {("user", "profesorado", "rol")},
            },
        ),
    ]