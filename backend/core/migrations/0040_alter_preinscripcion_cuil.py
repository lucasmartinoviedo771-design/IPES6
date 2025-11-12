from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0039_correlatividadversion_vigencia_desde_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="preinscripcion",
            name="cuil",
            field=models.CharField(
                blank=True,
                max_length=13,
                null=True,
                validators=[
                    django.core.validators.RegexValidator(
                        r"^\d{2}-\d{8}-\d{1}",
                        message="El CUIL debe tener el formato XX-XXXXXXXX-X.",
                    )
                ],
            ),
        ),
    ]

