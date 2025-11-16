from django.conf import settings
from django.db import migrations, models


def _set_initial_workflow(apps, schema_editor):
    PedidoEquivalencia = apps.get_model("core", "PedidoEquivalencia")
    for pedido in PedidoEquivalencia.objects.all():
        workflow = "notified" if pedido.estado == "final" else "draft"
        PedidoEquivalencia.objects.filter(pk=pedido.pk).update(workflow_estado=workflow)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0053_mesaactaoral"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="documentacion_cantidad",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="documentacion_detalle",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="documentacion_presentada",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="documentacion_registrada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="documentacion_registrada_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="evaluacion_observaciones",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="evaluacion_registrada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="evaluacion_registrada_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="formulario_descargado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="inscripcion_verificada_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="notificado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="notificado_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="requiere_tutoria",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="resultado_final",
            field=models.CharField(
                choices=[
                    ("pendiente", "Pendiente"),
                    ("otorgada", "Otorgada"),
                    ("denegada", "No otorgada"),
                    ("mixta", "Mixta"),
                ],
                default="pendiente",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_disposicion_fecha",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_disposicion_numero",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_documento_tipo",
            field=models.CharField(
                choices=[
                    ("ninguno", "Sin documentos"),
                    ("nota", "Nota"),
                    ("disposicion", "Disposición"),
                    ("ambos", "Nota y Disposición"),
                ],
                default="ninguno",
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_nota_fecha",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_nota_numero",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_observaciones",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_registrado_en",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="titulos_registrado_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.SET_NULL,
                related_name="+",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalencia",
            name="workflow_estado",
            field=models.CharField(
                choices=[
                    ("draft", "Borrador"),
                    ("pending_docs", "Pendiente de documentación"),
                    ("review", "En evaluación"),
                    ("titulos", "En Títulos"),
                    ("notified", "Notificado"),
                ],
                default="draft",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="pedidoequivalenciamateria",
            name="observaciones",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="pedidoequivalenciamateria",
            name="resultado",
            field=models.CharField(
                choices=[
                    ("pendiente", "Pendiente"),
                    ("otorgada", "Otorgada"),
                    ("rechazada", "No otorgada"),
                ],
                default="pendiente",
                max_length=16,
            ),
        ),
        migrations.RunPython(_set_initial_workflow, migrations.RunPython.noop),
    ]
