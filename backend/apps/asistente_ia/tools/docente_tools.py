"""
Herramientas de consulta (solo lectura) para docentes y personal del instituto.

Las de `academic_tools` responden sobre el legajo de un estudiante. Estas
responden sobre el trabajo de quien enseña o cumple funciones: sus horarios
—tanto de cátedra como de cargo— y las mesas donde integra el tribunal. Sin
ellas, un docente que preguntaba "¿cuál es mi horario?" recibía instrucciones
para navegar el menú en lugar de su horario.
"""

import logging

# Los cargos administrativos viven en la app de asistencia, no en core.models.
from apps.asistencia.cargos_models import Cargo, CargoDocente, HorarioCargo
from core.models import Comision, Docente, HorarioCatedraDetalle, MesaExamen

logger = logging.getLogger(__name__)

# Los dos modelos numeran los días distinto y hay que respetar cada convención.
# Bloque.dia (horario de cátedra) arranca en 1=Lunes y no usa el 0.
_DIAS_BLOQUE = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    7: "Domingo",
}

# HorarioCargo.dia_semana usa 0=Domingo (convención de la base). Unificar ambos
# en un solo diccionario mostraba los domingos de un cargo como lunes.
_DIAS_CARGO = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
}

_ORDEN_DIAS = {
    n: i for i, n in enumerate(["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"])
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


def _dia_legible(valor, mapa=None) -> str:
    mapa = mapa if mapa is not None else _DIAS_BLOQUE
    if isinstance(valor, int):
        return mapa.get(valor, f"Día {valor}")
    return str(valor or "").capitalize() or "Sin día"


def _hhmm(valor) -> str:
    return valor.strftime("%H:%M") if valor else ""


def _horario_de_cargos(docente: Docente) -> list[dict]:
    """
    Grilla semanal de los cargos (bedel, secretaría, preceptoría) del agente.

    Mucho personal del instituto no tiene comisiones a cargo pero sí un cargo con
    horario fijo: preguntaban "¿cuál es mi horario?" y el asistente contestaba que
    no figuraba nada, cuando el horario existía en otra tabla.

    Ojo con el modelo: `HorarioCargo.cargo` apunta a `Cargo` (el puesto), no a
    `CargoDocente` (la designación de una persona en ese puesto). Así que se
    resuelve en dos pasos: designaciones vigentes del docente -> puestos ->
    horarios de esos puestos.
    """
    from django.db.models import Q
    from django.utils import timezone

    hoy = timezone.now().date()
    designaciones = (
        CargoDocente.objects.filter(docente=docente, activo=True)
        # Una designación terminada no debe seguir apareciendo como horario actual.
        .filter(Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy))
        .select_related("cargo")
    )
    if not designaciones:
        return []

    por_cargo: dict[int, CargoDocente] = {d.cargo_id: d for d in designaciones if d.cargo_id}
    if not por_cargo:
        return []

    grilla = []
    for h in HorarioCargo.objects.filter(cargo_id__in=por_cargo.keys()).select_related("cargo"):
        designacion = por_cargo.get(h.cargo_id)
        cargo: Cargo | None = designacion.cargo if designacion else None
        grilla.append(
            {
                "dia": _dia_legible(h.dia_semana, _DIAS_CARGO),
                "desde": _hhmm(h.hora_inicio),
                "hasta": _hhmm(h.hora_fin),
                "tipo": "cargo",
                "cargo": cargo.nombre if cargo else "Cargo",
                "codigo": (cargo.codigo_cargo or "") if cargo else "",
                "situacion_revista": (designacion.get_sit_revista_display() if designacion.sit_revista else ""),
            }
        )
    return grilla


def consultar_mi_horario(user) -> dict:
    """Devuelve la grilla semanal del docente autenticado: clases y cargos."""
    docente = _docente_de(user)
    if not docente:
        return {"error": "Esta consulta está disponible para docentes y personal del instituto."}

    cargos = _horario_de_cargos(docente)

    comisiones = (
        Comision.objects.filter(docente=docente)
        .select_related("materia__plan_de_estudio__profesorado", "turno", "horario")
        .order_by("materia__nombre")
    )
    if not comisiones:
        if cargos:
            # Sin cátedras pero con cargo: es el caso de bedeles y secretaría.
            cargos.sort(key=lambda x: (_ORDEN_DIAS.get(x["dia"], 9), x["desde"]))
            return {
                "total_bloques": len(cargos),
                "total_comisiones": 0,
                "horario": cargos,
                "mensaje": "No tenés comisiones a cargo; el horario que figura es el de tu cargo.",
            }
        return {
            "total_bloques": 0,
            "horario": [],
            "mensaje": "No figuran comisiones ni cargos con horario asignado en el sistema.",
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
                "desde": _hhmm(bloque.hora_desde),
                "hasta": _hhmm(bloque.hora_hasta),
                "tipo": "clase",
                "materia": datos.get("materia", "Materia"),
                "comision": datos.get("comision", ""),
                "turno": datos.get("turno", ""),
                "carrera": datos.get("carrera", ""),
            }
        )

    # Clases y cargos van en una sola grilla ordenada: quien tiene cátedras y
    # además un cargo necesita ver el día completo, no dos listas separadas.
    grilla.extend(cargos)
    grilla.sort(key=lambda x: (_ORDEN_DIAS.get(x["dia"], 9), x["desde"]))

    return {
        "total_bloques": len(grilla),
        "total_comisiones": comisiones.count(),
        "total_bloques_de_cargo": len(cargos),
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
