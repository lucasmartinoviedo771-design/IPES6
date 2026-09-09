"""
Herramientas de consulta (solo lectura) para docentes y personal del instituto.

Las de `academic_tools` responden sobre el legajo de un estudiante. Estas
responden sobre el trabajo de quien enseña: sus horarios y las mesas donde
integra el tribunal. Sin ellas, un docente que preguntaba "¿cuál es mi horario?"
recibía instrucciones para navegar el menú en lugar de su horario.
"""

import logging

from core.models import Comision, Docente, HorarioCatedraDetalle, MesaExamen

logger = logging.getLogger(__name__)

# El día se guarda como número; se traduce para que la respuesta sea legible.
_DIAS = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    7: "Domingo",
    0: "Lunes",
}


def _docente_de(user) -> Docente | None:
    """
    Resuelve el docente a partir del usuario.

    Se busca por DNI (el username), nunca por email: `User.email` está obsoleto y
    puede tener datos históricos sucios (decisión P-1, Persona es la fuente de
    verdad de la identidad).
    """
    dni = (getattr(user, "username", "") or "").strip()
    if not dni:
        return None
    return Docente.objects.filter(persona__dni__iexact=dni).select_related("persona").first()


def _dia_legible(valor) -> str:
    if isinstance(valor, int):
        return _DIAS.get(valor, f"Día {valor}")
    return str(valor or "").capitalize() or "Sin día"


def consultar_mi_horario(user) -> dict:
    """Devuelve la grilla semanal de clases del docente autenticado."""
    docente = _docente_de(user)
    if not docente:
        return {"error": "Esta consulta está disponible para docentes con cátedras asignadas."}

    comisiones = (
        Comision.objects.filter(docente=docente)
        .select_related("materia__plan_de_estudio__profesorado", "turno", "horario")
        .order_by("materia__nombre")
    )
    if not comisiones:
        return {
            "total_bloques": 0,
            "horario": [],
            "mensaje": "No figuran comisiones a tu cargo en el sistema.",
        }

    horarios_ids = [c.horario_id for c in comisiones if c.horario_id]
    detalles = (
        HorarioCatedraDetalle.objects.filter(horario_catedra_id__in=horarios_ids)
        .select_related("bloque", "horario_catedra")
        .exclude(bloque__es_recreo=True)
    )

    # Materia y turno de cada horario, para no repetir consultas por bloque.
    por_horario = {
        c.horario_id: {
            "materia": c.materia.nombre if c.materia else "Materia",
            "comision": c.codigo,
            "turno": c.turno.nombre if c.turno_id else "",
            "carrera": (
                c.materia.plan_de_estudio.profesorado.nombre
                if c.materia and c.materia.plan_de_estudio and c.materia.plan_de_estudio.profesorado
                else ""
            ),
            "anio_lectivo": c.anio_lectivo,
        }
        for c in comisiones
        if c.horario_id
    }

    grilla = []
    for det in detalles:
        bloque = det.bloque
        if not bloque:
            continue
        datos = por_horario.get(det.horario_catedra_id, {})
        grilla.append(
            {
                "dia": _dia_legible(getattr(bloque, "dia", None)),
                "desde": bloque.hora_desde.strftime("%H:%M") if bloque.hora_desde else "",
                "hasta": bloque.hora_hasta.strftime("%H:%M") if bloque.hora_hasta else "",
                "materia": datos.get("materia", "Materia"),
                "comision": datos.get("comision", ""),
                "turno": datos.get("turno", ""),
                "carrera": datos.get("carrera", ""),
            }
        )

    orden_dias = {
        n: i for i, n in enumerate(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"])
    }
    grilla.sort(key=lambda x: (orden_dias.get(x["dia"], 9), x["desde"]))

    return {
        "total_bloques": len(grilla),
        "total_comisiones": comisiones.count(),
        "horario": grilla,
    }


def consultar_mis_mesas(user) -> dict:
    """Devuelve las mesas de examen donde el docente integra el tribunal."""
    from django.db.models import Q
    from django.utils import timezone

    docente = _docente_de(user)
    if not docente:
        return {"error": "Esta consulta está disponible para docentes."}

    hoy = timezone.now().date()
    mesas = (
        MesaExamen.objects.filter(
            Q(docente_presidente=docente) | Q(docente_vocal1=docente) | Q(docente_vocal2=docente),
            fecha__gte=hoy,
        )
        .select_related("materia__plan_de_estudio__profesorado")
        .order_by("fecha", "hora_desde")[:20]
    )

    listado = []
    for m in mesas:
        # El rol importa: solo el titular carga el acta y cierra la planilla.
        if m.docente_presidente_id == docente.id:
            rol = "Presidente (titular)"
        elif m.docente_vocal1_id == docente.id:
            rol = "Vocal 1"
        else:
            rol = "Vocal 2"
        listado.append(
            {
                "materia": m.materia.nombre if m.materia else "Materia",
                "carrera": (
                    m.materia.plan_de_estudio.profesorado.nombre
                    if m.materia and m.materia.plan_de_estudio and m.materia.plan_de_estudio.profesorado
                    else ""
                ),
                "fecha": m.fecha.strftime("%d/%m/%Y") if m.fecha else "",
                "hora": m.hora_desde.strftime("%H:%M") if m.hora_desde else "",
                "aula": m.aula or "",
                "modalidad": m.get_modalidad_display() if m.modalidad else "",
                "mi_rol": rol,
                "planilla_cerrada": bool(m.planilla_cerrada_en),
                "codigo": m.codigo or "",
            }
        )

    return {"total": len(listado), "mesas": listado, "desde": hoy.strftime("%d/%m/%Y")}
