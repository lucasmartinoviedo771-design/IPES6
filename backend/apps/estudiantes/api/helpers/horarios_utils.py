"""Helpers para construcción de tablas de horarios."""

from __future__ import annotations

from collections import defaultdict

from django.db.models import Max
from core.models import (
    Bloque,
    HorarioCatedra,
    HorarioCatedraDetalle,
    Materia,
    PlanDeEstudio,
    Profesorado,
)

from apps.estudiantes.schemas import (
    Horario,
    HorarioCelda,
    HorarioDia,
    HorarioFranja,
    HorarioMateriaCelda,
    HorarioTabla,
)

ORDINALES = {
    1: "1er",
    2: "2do",
    3: "3er",
    4: "4to",
    5: "5to",
    6: "6to",
    7: "7mo",
}


def _normalizar_regimen(valor: str | None) -> str:
    if not valor:
        return "ANUAL"
    v = str(valor).lower().strip()
    if v in ["anu", "anual", "anu."]:
        return "ANUAL"
    if v in ["pcu", "1c", "1er cuatrimestre", "1º cuatrimestre", "primero"]:
        return "1C"
    if v in ["scu", "2c", "2do cuatrimestre", "2º cuatrimestre", "segundo"]:
        return "2C"
    return "ANUAL"


def _format_time(value) -> str:
    return value.strftime("%H:%M") if value else ""


def obtener_horarios_materia(m: Materia) -> list[Horario]:
    """Extrae los horarios base del plan para una materia (último año académico)."""
    hcs = (
        HorarioCatedra.objects.filter(espacio=m)
        .annotate(max_anio=Max("anio_academico"))
        .order_by("-anio_academico")
    )
    if not hcs:
        return []

    # Tomamos el último HorarioCatedra (el más reciente)
    detalles = (
        HorarioCatedraDetalle.objects.filter(horario_catedra__in=hcs[:1])
        .select_related("bloque", "horario_catedra")
    )
    
    hs: list[Horario] = []
    for d in detalles:
        b = d.bloque
        hs.append(
            Horario(
                dia=b.get_dia_display(),
                desde=b.hora_desde.strftime("%H:%M"),
                hasta=b.hora_hasta.strftime("%H:%M"),
            )
        )
    return sorted(hs, key=lambda x: (x.dia, x.desde))


def _anio_plan_label(numero: int) -> str:
    if not numero:
        return "Plan general"
    base = ORDINALES.get(numero, f"{numero}to")
    return f"{base} año"


def _anio_regular_label(numero: int) -> str:
    if numero <= 0:
        return ""
    return f"{ORDINALES.get(numero, f'{numero}to')} año"


def _construir_tablas_horario(
    profesorado: Profesorado,
    plan: PlanDeEstudio,
    horarios: list[HorarioCatedra],
) -> list[HorarioTabla]:
    if not horarios:
        return []

    tablas: list[HorarioTabla] = []
    grupos: dict[tuple[int, int], list[HorarioCatedra]] = defaultdict(list)
    for horario in horarios:
        materia = horario.espacio
        anio_plan = getattr(materia, "anio_cursada", None)
        if anio_plan is None:
            anio_plan = getattr(horario, "anio_academico", None)
        if not anio_plan or anio_plan < 0 or anio_plan > 20:
            anio_plan = 0
        turno_key = horario.turno_id or 0
        grupos[(turno_key, anio_plan)].append(horario)

    for (turno_id, anio_plan), items in sorted(grupos.items(), key=lambda entry: (entry[0][1], entry[0][0])):
        if not items:
            continue

        # 1. Recolectar y normalizar todos los bloques del turno
        bloques_raw_all = list(Bloque.objects.filter(turno_id=turno_id).order_by("dia", "hora_desde"))

        def _n(t): return t.replace(second=0, microsecond=0) if t else None

        # 2. Skeletons independientes (Alineación pedagógica por módulo)
        tiempos_lv = sorted(
            {_n(b.hora_desde) for b in bloques_raw_all if 1 <= b.dia <= 5},
            key=lambda t: (t.hour, t.minute)
        )
        tiempos_sab = sorted(
            {_n(b.hora_desde) for b in bloques_raw_all if b.dia == 6},
            key=lambda t: (t.hour, t.minute)
        )

        hora_a_pos_lv = {h: i for i, h in enumerate(tiempos_lv)}
        hora_a_pos_sab = {h: i for i, h in enumerate(tiempos_sab)}
        recreos_set = {_n(b.hora_desde) for b in bloques_raw_all if b.es_recreo}

        # 3. Construir las franjas (rows) pedagógicas
        max_filas = max(len(tiempos_lv), len(tiempos_sab), 0)
        franjas: list[HorarioFranja] = []
        hc_contador = 0

        # Mapa de bloque_id -> posición global
        bloque_id_a_pos = {}
        for b in bloques_raw_all:
            h_norm = _n(b.hora_desde)
            if 1 <= b.dia <= 5:
                bloque_id_a_pos[b.id] = hora_a_pos_lv.get(h_norm)
            elif b.dia == 6:
                bloque_id_a_pos[b.id] = hora_a_pos_sab.get(h_norm)

        for i in range(max_filas):
            h_lv = tiempos_lv[i] if i < len(tiempos_lv) else None
            h_sab = tiempos_sab[i] if i < len(tiempos_sab) else None

            # Fin de bloque para labels
            h_lv_fin = next((_n(b.hora_hasta) for b in bloques_raw_all if 1 <= b.dia <= 5 and _n(b.hora_desde) == h_lv), None) if h_lv else None
            h_sab_fin = next((_n(b.hora_hasta) for b in bloques_raw_all if b.dia == 6 and _n(b.hora_desde) == h_sab), None) if h_sab else None

            # Es recreo si cualquiera de los dos carriles en esta posición lo es
            is_recreo = (h_lv in recreos_set) or (h_sab in recreos_set)

            if is_recreo:
                val_orden = 0
            else:
                hc_contador += 1
                val_orden = hc_contador

            franjas.append(
                HorarioFranja(
                    orden=val_orden,
                    posicion=i,
                    desde=_format_time(h_lv) if h_lv else (_format_time(h_sab) if h_sab else "-"),
                    hasta=_format_time(h_lv_fin) if h_lv_fin else (_format_time(h_sab_fin) if h_sab_fin else "-"),
                    es_recreo=is_recreo,
                    desde_sec=_format_time(h_sab) if h_sab else None,
                    hasta_sec=_format_time(h_sab_fin) if h_sab_fin else None
                )
            )

        celdas_dict: dict[tuple[int, int], list[HorarioMateriaCelda]] = defaultdict(list)
        cuatrimestres_set: set[str] = set()

        for horario in items:
            # Respetar la segmentación: si HorarioCatedra.cuatrimestre tiene valor, usarlo
            # Si es NULL/vacío, entonces usa espacio.regimen
            materia_regimen = _normalizar_regimen(horario.espacio.regimen)
            
            # Si la MATERIA es anual, no importa si el horario dice cuatrimestre (puede ser segmentado)
            if materia_regimen == "ANUAL":
                regimen_label = "ANUAL"
            else:
                # Si la materia no es anual, usamos el cuatrimestre del horario o el de la materia
                regimen_raw = horario.cuatrimestre or horario.espacio.regimen
                regimen_label = _normalizar_regimen(regimen_raw)

            if regimen_label:
                cuatrimestres_set.add(regimen_label)

            comisiones = list(horario.comisiones.select_related("docente"))
            if not comisiones:
                comisiones = list(horario.espacio.comisiones.filter(anio_lectivo=horario.anio_academico).select_related("docente"))

            docentes = sorted({(f"{c.docente.apellido}, {c.docente.nombre}" if c.docente and c.docente.apellido else (c.docente.nombre if c.docente else "")) for c in comisiones if c.docente_id})
            docentes = [doc for doc in docentes if doc]
            comision_codigos = sorted({c.codigo for c in comisiones if c.codigo})
            observaciones_text = "; ".join(sorted({c.observaciones for c in comisiones if c.observaciones})) or None

            detalles = list(horario.detalles.select_related("bloque"))
            for detalle in detalles:
                bloque = detalle.bloque
                pos = bloque_id_a_pos.get(bloque.id)
                if pos is None: continue

                materia_obj = horario.espacio
                materia_entry = HorarioMateriaCelda(
                    materia_id=materia_obj.id,
                    materia_nombre=materia_obj.nombre,
                    comisiones=comision_codigos,
                    docentes=docentes,
                    observaciones=observaciones_text,
                    regimen=_normalizar_regimen(materia_obj.regimen),
                    cuatrimestre=regimen_label,
                    es_cuatrimestral=regimen_label in {"1C", "2C"},
                )
                celdas_dict[(bloque.dia, pos)].append(materia_entry)

        dias: dict[int, str] = {}
        for b in bloques_raw_all:
            if b.dia not in dias:
                dias[b.dia] = Bloque.DIA_CHOICES[b.dia - 1][1] if 0 < b.dia <= len(Bloque.DIA_CHOICES) else str(b.dia)
        dias_list = [HorarioDia(numero=numero, nombre=nombre) for numero, nombre in sorted(dias.items())]

        celdas: list[HorarioCelda] = []
        for dia in dias_list:
            for pos, franja in enumerate(franjas):
                materias = celdas_dict.get((dia.numero, pos), [])
                celdas.append(
                    HorarioCelda(
                        dia_numero=dia.numero,
                        franja_orden=franja.orden,
                        franja_posicion=pos,
                        dia=dia.nombre,
                        desde=franja.desde,
                        hasta=franja.hasta,
                        materias=materias,
                    )
                )

        turno_nombre = items[0].turno.nombre if items[0].turno else ""
        cuatrimestres = sorted(cuatrimestres_set) if cuatrimestres_set else ["ANUAL"]
        key = f"{profesorado.id}-{plan.id}-{turno_id}-{anio_plan}"
        tablas.append(
            HorarioTabla(
                key=key,
                profesorado_id=profesorado.id,
                profesorado_nombre=profesorado.nombre,
                plan_id=plan.id,
                plan_resolucion=getattr(plan, "resolucion", None),
                anio_plan=anio_plan,
                anio_plan_label=_anio_plan_label(anio_plan),
                turno_id=turno_id,
                turno_nombre=turno_nombre,
                cuatrimestres=cuatrimestres,
                dias=dias_list,
                franjas=franjas,
                celdas=celdas,
                observaciones=None,
            )
        )

    return sorted(tablas, key=lambda tabla: (tabla.anio_plan, tabla.turno_nombre))
