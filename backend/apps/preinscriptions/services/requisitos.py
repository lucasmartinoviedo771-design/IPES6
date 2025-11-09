from __future__ import annotations

from collections.abc import Iterable

from django.db import transaction

from core.models import (
    Profesorado,
    ProfesoradoRequisitoDocumentacion,
    RequisitoDocumentacionTemplate,
)


def _template_defaults(template: RequisitoDocumentacionTemplate) -> dict:
    return {
        "template": template,
        "codigo": template.codigo,
        "titulo": template.titulo,
        "descripcion": template.descripcion,
        "categoria": template.categoria,
        "obligatorio": template.obligatorio,
        "orden": template.orden,
        "activo": template.activo,
    }


@transaction.atomic
def sync_profesorado_requisitos(
    profesorado: Profesorado,
    *,
    include_inactivos: bool = False,
) -> Iterable[ProfesoradoRequisitoDocumentacion]:
    """Asegura que el profesorado posea requisitos documentales basados en las plantillas.

    - Crea los requisitos que faltan.
    - Actualiza los requisitos existentes que no fueron personalizados.
    """

    templates_qs = RequisitoDocumentacionTemplate.objects.all()
    if not include_inactivos:
        templates_qs = templates_qs.filter(activo=True)
    templates = {tmpl.codigo: tmpl for tmpl in templates_qs}

    requisitos = {
        req.codigo: req
        for req in ProfesoradoRequisitoDocumentacion.objects.filter(profesorado=profesorado)
    }

    for codigo, template in templates.items():
        req = requisitos.get(codigo)
        if not req:
            requisitos[codigo] = ProfesoradoRequisitoDocumentacion.objects.create(
                profesorado=profesorado,
                **_template_defaults(template),
                personalizado=False,
            )
            continue

        if req.template_id != template.id:
            req.template = template

        if req.personalizado:
            if req.template_id != template.id:
                req.save(update_fields=["template", "updated_at"])
            continue

        cambios = []
        defaults = _template_defaults(template)
        for campo, valor in defaults.items():
            if campo in {"template", "codigo"}:
                continue
            if getattr(req, campo) != valor:
                setattr(req, campo, valor)
                cambios.append(campo)
        if cambios or req.template_id != template.id:
            if req.template_id != template.id and "template" not in cambios:
                cambios.append("template")
            if "updated_at" not in cambios:
                cambios.append("updated_at")
            req.save(update_fields=cambios)

    if include_inactivos:
        return ProfesoradoRequisitoDocumentacion.objects.filter(profesorado=profesorado)

    codigos_activos = set(templates.keys())
    if codigos_activos:
        ProfesoradoRequisitoDocumentacion.objects.filter(
            profesorado=profesorado, activo=True
        ).exclude(codigo__in=codigos_activos).update(activo=False)

    return ProfesoradoRequisitoDocumentacion.objects.filter(profesorado=profesorado)
