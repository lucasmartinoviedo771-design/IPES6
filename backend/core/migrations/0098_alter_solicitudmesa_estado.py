
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0097_solicitudmesa_modalidad'),
    ]

    operations = [
        migrations.AlterField(
            model_name='solicitudmesa',
            name='estado',
            field=models.CharField(choices=[('PEN', 'Pendiente'), ('PRO', 'Mesa Aprobada'), ('REC', 'Rechazada')], default='PEN', max_length=3),
        ),
    ]
