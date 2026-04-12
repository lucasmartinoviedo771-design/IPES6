"""Endpoints de exportación (CSV y PDF nota) para equivalencias."""

import csv

from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib import colors
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from apps.common.api_schemas import ApiResponse
from core.auth_ninja import JWTAuth
from core.models import PedidoEquivalencia
from core.permissions import ensure_roles

from apps.estudiantes.api.common import (
    EQUIVALENCIAS_STAFF_ROLES,
    MONTH_NAMES,
    build_certificate_header,
    can_manage_equivalencias,
)
from apps.estudiantes.api.router import estudiantes_router
from apps.estudiantes.schemas import EquivalenciaItem, Horario

from apps.estudiantes.api.equivalencias.helpers import (
    _serialize_pedido_equivalencia,
)
from apps.estudiantes.api.equivalencias.pdf_helpers import (
    _build_equivalencia_paragraphs_externas,
    _build_equivalencia_paragraphs_internas,
    _build_equivalencias_table,
    _build_equivalencia_signature,
)

from core.models import (
    EquivalenciaCurricular,
    HorarioCatedraDetalle,
    Materia,
)


@estudiantes_router.get("/equivalencias", response=list[EquivalenciaItem], auth=JWTAuth())
def equivalencias_para_materia(request, materia_id: int):
    """Devuelve materias equivalentes (otros profesorados) para la materia indicada."""
    try:
        m = Materia.objects.select_related("plan_de_estudio__profesorado").get(id=materia_id)
    except Materia.DoesNotExist:
        return []

    # REGLA: Solo materias de Formación General
    if m.tipo_formacion != Materia.TipoFormacion.FORMACION_GENERAL:
        return []

    # Buscamos en grupos de equivalencia formales
    grupos = EquivalenciaCurricular.objects.filter(materias=m)
    
    materias_equivalentes = []
    if grupos.exists():
        for g in grupos:
            # Filtramos candidatos por Reglas: FGN, misma carga horaria y mismo formato
            candidates = g.materias.select_related("plan_de_estudio__profesorado").filter(
                tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
                horas_semana=m.horas_semana,
                formato=m.formato
            ).exclude(id=m.id)
            for mm in candidates:
                materias_equivalentes.append(mm)
    else:
        # Fallback: buscar materias con el mismo nombre, FGN, misma carga horaria y mismo formato
        candidates = Materia.objects.select_related("plan_de_estudio__profesorado").filter(
            nombre__iexact=m.nombre,
            tipo_formacion=Materia.TipoFormacion.FORMACION_GENERAL,
            horas_semana=m.horas_semana,
            formato=m.formato
        ).exclude(id=m.id)
        materias_equivalentes = list(candidates)

    def map_cuat(regimen: str) -> str:
        return (
            "ANUAL"
            if regimen == Materia.TipoCursada.ANUAL
            else ("1C" if regimen == Materia.TipoCursada.PRIMER_CUATRIMESTRE else "2C")
        )

    items: list[EquivalenciaItem] = []
    for mm in materias_equivalentes:
        # Evitamos Nones para el profesorado
        profesorado_nombre = "Profesorado no especificado"
        plan_id = None
        profesorado_id = None
        if mm.plan_de_estudio:
            plan_id = mm.plan_de_estudio.id
            if mm.plan_de_estudio.profesorado:
                profesorado_nombre = mm.plan_de_estudio.profesorado.nombre
                profesorado_id = mm.plan_de_estudio.profesorado.id
            
        detalles = HorarioCatedraDetalle.objects.filter(horario_catedra__espacio=mm).select_related(
            "bloque", "horario_catedra"
        )
        hs = [
            Horario(
                dia=d.bloque.get_dia_display(),
                desde=str(d.bloque.hora_desde)[:5],
                hasta=str(d.bloque.hora_hasta)[:5],
            )
            for d in detalles
        ]
        items.append(
            EquivalenciaItem(
                materia_id=mm.id,
                materia_nombre=mm.nombre,
                plan_id=plan_id,
                profesorado_id=profesorado_id,
                profesorado=profesorado_nombre,
                cuatrimestre=map_cuat(mm.regimen),
                horarios=hs,
            )
        )
    return items


@estudiantes_router.post("/equivalencias/pedidos/{pedido_id}/nota", auth=JWTAuth())


@estudiantes_router.post("/equivalencias/pedidos/{pedido_id}/nota", auth=JWTAuth())
def generar_nota_equivalencias(request, pedido_id: int):
    pedido = (
        PedidoEquivalencia.objects.select_related(
            "estudiante__user",
            "ventana",
            "profesorado_destino",
        )
        .prefetch_related("materias")
        .filter(id=pedido_id)
        .first()
    )
    if not pedido:
        return 404, ApiResponse(ok=False, message="No se encontró el pedido.")

    if not can_manage_equivalencias(request.user):
        estudiante = getattr(request.user, "estudiante", None)
        if not estudiante or estudiante.id != pedido.estudiante_id:
            return 403, ApiResponse(ok=False, message="No tiene permisos para ver este pedido.")

    if not pedido.materias.exists():
        return 400, ApiResponse(ok=False, message="El pedido no tiene materias cargadas.")

    today = timezone.now()
    est = pedido.estudiante
    destino_nombre = (
        pedido.profesorado_destino_nombre
        or (pedido.profesorado_destino.nombre if pedido.profesorado_destino_id else "")
    )
    ciclo_lectivo = pedido.ciclo_lectivo or str(today.year)
    tipo = pedido.tipo
    anexo_label = "ANEXO FORMULARIO A" if tipo == PedidoEquivalencia.Tipo.ANEXO_A else "ANEXO FORMULARIO B"
    note_title = (
        "Nota para solicitar equivalencias internas"
        if tipo == PedidoEquivalencia.Tipo.ANEXO_A
        else "Modelo de nota para solicitud de equivalencias"
    )
    if tipo == PedidoEquivalencia.Tipo.ANEXO_A:
        paragraphs = _build_equivalencia_paragraphs_internas(
            destino_nombre,
            pedido.profesorado_origen_nombre,
            pedido.plan_origen_resolucion,
            ciclo_lectivo,
        )
    else:
        paragraphs = _build_equivalencia_paragraphs_externas(
            destino_nombre,
            pedido.establecimiento_origen,
            pedido.establecimiento_localidad,
            pedido.establecimiento_provincia,
            pedido.plan_destino_resolucion,
            ciclo_lectivo,
        )

    materias_rows = [
        {"nombre": m.nombre, "formato": m.formato, "anio": m.anio_cursada, "nota": m.nota}
        for m in pedido.materias.all()
    ]

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="pedido_equivalencias_{est.dni}.pdf"'
    doc = SimpleDocTemplate(
        response,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()
    anexo_style = ParagraphStyle(
        "EquivalenciaAnexo",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=4,
    )
    title_style = ParagraphStyle(
        "EquivalenciaTitle",
        parent=styles["Heading2"],
        alignment=TA_CENTER,
        fontSize=15,
        leading=18,
        spaceAfter=16,
    )
    body_style = ParagraphStyle(
        "EquivalenciaBody",
        parent=styles["Normal"],
        alignment=TA_JUSTIFY,
        fontSize=12,
        leading=16,
        firstLineIndent=28,
        spaceAfter=12,
    )
    plain_body = ParagraphStyle(
        "EquivalenciaBodyPlain",
        parent=body_style,
        firstLineIndent=0,
    )
    helper_style = ParagraphStyle(
        "EquivalenciaHelper",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        alignment=TA_JUSTIFY,
        textColor=colors.grey,
        spaceAfter=10,
    )
    location_style = ParagraphStyle(
        "EquivalenciaLocation",
        parent=styles["Normal"],
        alignment=TA_RIGHT,
        fontSize=11,
        leading=14,
        spaceAfter=18,
    )
    motto_style = ParagraphStyle(
        "EquivalenciaMotto",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        fontSize=8,
        leading=10,
        textColor=colors.grey,
    )

    mes_nombre = MONTH_NAMES.get(today.month, today.strftime("%B").lower())
    fecha_linea = f"Río Grande, {today.day} de {mes_nombre} de {today.year}"

    story: list = []
    story.extend(build_certificate_header(doc))
    story.append(Paragraph(anexo_label, anexo_style))
    story.append(Paragraph(note_title, title_style))
    story.append(Paragraph(fecha_linea, location_style))
    for texto in paragraphs:
        story.append(Paragraph(texto, body_style))
    story.append(Paragraph("Las materias que solicito se detallen son:", plain_body))
    story.append(Spacer(1, 8))
    story.append(_build_equivalencias_table(materias_rows))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Indique el nombre del espacio curricular tal cual figura en su analítico, "
            "el formato (módulo, asignatura, taller, etc.) y el año de cursada.",
            helper_style,
        )
    )
    story.append(Paragraph("Sin otro particular, saludo atentamente.", body_style))
    story.append(Spacer(1, 20))
    story.append(_build_equivalencia_signature(est))
    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "Las Islas Malvinas, Georgia, Sandwich del Sur y los Hielos Continentales, son y serán Argentinas",
            motto_style,
        )
    )

    doc.build(story)

    return response


@estudiantes_router.get("/equivalencias/export")
def exportar_pedidos_equivalencia(
    request,
    profesorado_id: int | None = None,
    ventana_id: int | None = None,
    estado: str | None = None,
):
    ensure_roles(request.user, EQUIVALENCIAS_STAFF_ROLES)
    qs = (
        PedidoEquivalencia.objects.select_related(
            "profesorado_destino",
            "ventana",
            "estudiante__user",
        )
        .prefetch_related("materias")
        .order_by("profesorado_destino_nombre", "estudiante__persona__dni")
    )
    if profesorado_id:
        qs = qs.filter(profesorado_destino_id=profesorado_id)
    if ventana_id:
        qs = qs.filter(ventana_id=ventana_id)
    if estado:
        qs = qs.filter(estado=estado.lower())

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="pedidos_equivalencias.csv"'
    writer = csv.writer(response)
    writer.writerow(
        [
            "DNI",
            "Estudiante",
            "Tipo",
            "Estado",
            "Profesorado destino",
            "Plan destino",
            "Ciclo lectivo",
            "Ventana",
            "Fecha actualización",
            "Materias solicitadas (incluye nota)",
        ]
    )
    for pedido in qs:
        materias_txt = " | ".join(
            " ".join(
                filter(
                    None,
                    [
                        m.nombre,
                        f"({m.formato})" if m.formato else None,
                        f"Año {m.anio_cursada}" if m.anio_cursada else None,
                        f"Nota: {m.nota}" if getattr(m, 'nota', "") else None,
                    ],
                )
            )
            for m in pedido.materias.all()
        )
        ventana_label = ""
        if pedido.ventana_id:
            desde = pedido.ventana.desde.strftime("%d/%m/%Y") if pedido.ventana.desde else ""
            hasta = pedido.ventana.hasta.strftime("%d/%m/%Y") if pedido.ventana.hasta else ""
            ventana_label = f"{desde} - {hasta}"
        writer.writerow(
            [
                pedido.estudiante.dni,
                pedido.estudiante.user.get_full_name() if pedido.estudiante.user_id else "",
                pedido.get_tipo_display(),
                pedido.get_estado_display(),
                pedido.profesorado_destino_nombre,
                pedido.plan_destino_resolucion,
                pedido.ciclo_lectivo,
                ventana_label,
                pedido.updated_at.strftime("%d/%m/%Y %H:%M"),
                materias_txt,
            ]
        )

    return response
