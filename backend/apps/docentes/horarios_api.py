from collections import defaultdict

from django.db.models import Max, Q
from django.utils import timezone

from apps.estudiantes.api.notas_utils import docente_from_user
from apps.estudiantes.schemas.trayectoria import (
    HorarioCelda,
    HorarioDia,
    HorarioFranja,
    HorarioMateriaCelda,
    HorarioTabla,
)
from core.models import Bloque, Comision, HorarioCatedra, Turno


def get_mis_horarios(request):
    docente = docente_from_user(request.user)
    if not docente:
        return []

    current_year = timezone.now().year

    # Comision.horario casi nunca esta poblado (solo se completa al crear un
    # HorarioCatedra nuevo, no cuando ya existia), asi que no podemos ubicar
    # el horario del docente via esa FK. En cambio, buscamos el HorarioCatedra
    # que corresponde a cada una de sus comisiones activas por materia+turno+anio.
    comisiones_docente = list(
        Comision.objects.filter(docente=docente).exclude(estado="LIC").select_related("materia__plan_de_estudio__profesorado", "turno")
    )
    if not comisiones_docente:
        return []

    claves = {(c.materia_id, c.turno_id, c.anio_lectivo) for c in comisiones_docente}
    comisiones_por_clave = defaultdict(list)
    for c in comisiones_docente:
        comisiones_por_clave[(c.materia_id, c.turno_id, c.anio_lectivo)].append(c)

    filtro = Q()
    for materia_id, turno_id, anio_lectivo in claves:
        filtro |= Q(espacio_id=materia_id, turno_id=turno_id, anio_academico=anio_lectivo)

    horarios_qs = (
        HorarioCatedra.objects.filter(filtro)
        .select_related("espacio", "turno")
        .prefetch_related("detalles__bloque")
        .distinct()
    )

    # Fallback to max year if current year has no data
    if not horarios_qs.filter(anio_academico=current_year).exists():
        max_year = horarios_qs.aggregate(max_year=Max("anio_academico"))["max_year"]
        if max_year:
            current_year = max_year

    horarios_qs = horarios_qs.filter(anio_academico=current_year).exclude(espacio__fecha_fin__lt=timezone.now().date())
    horarios = list(horarios_qs)

    if not horarios:
        return []

    # Group by Turno and Cuatrimestre
    grupos = defaultdict(list)
    for horario in horarios:
        turno_key = horario.turno_id or 0

        if horario.espacio.regimen == "ANU":
            cuatr = "ANUAL"
        else:
            cuatr = horario.cuatrimestre or horario.espacio.regimen
            if not cuatr or cuatr == "ANU":
                cuatr = "ANUAL"
            elif cuatr == "PCU":
                cuatr = "1C"
            elif cuatr == "SCU":
                cuatr = "2C"

        grupos[(turno_key, cuatr)].append(horario)

    tablas = []

    for (turno_id, cuatr), items in sorted(grupos.items(), key=lambda entry: (entry[0][0], entry[0][1])):
        if not items:
            continue

        turno_obj = items[0].turno
        turno_nombre = turno_obj.nombre if turno_obj else "Desconocido"

        bloques_raw_all = list(Bloque.objects.filter(turno_id=turno_id).order_by("dia", "hora_desde"))

        def _n(t):
            return t.replace(second=0, microsecond=0) if t else None

        tiempos_lv = sorted(
            {_n(b.hora_desde) for b in bloques_raw_all if 1 <= b.dia <= 5}, key=lambda t: (t.hour, t.minute)
        )
        tiempos_sab = sorted(
            {_n(b.hora_desde) for b in bloques_raw_all if b.dia == 6}, key=lambda t: (t.hour, t.minute)
        )

        hora_a_pos_lv = {h: i for i, h in enumerate(tiempos_lv)}
        hora_a_pos_sab = {h: i for i, h in enumerate(tiempos_sab)}
        recreos_set = {_n(b.hora_desde) for b in bloques_raw_all if b.es_recreo}

        max_filas = max(len(tiempos_lv), len(tiempos_sab), 0)
        franjas = []
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

            es_recreo_lv = h_lv in recreos_set
            es_recreo_sab = h_sab in recreos_set

            str_desde_lv = h_lv.strftime("%H:%M") if h_lv else ""
            str_desde_sab = h_sab.strftime("%H:%M") if h_sab else ""

            # Attempt to find end time for the franja
            h_hasta_lv = tiempos_lv[i + 1] if i + 1 < len(tiempos_lv) else None
            h_hasta_sab = tiempos_sab[i + 1] if i + 1 < len(tiempos_sab) else None

            # Use specific blocks to get actual hasta times if possible
            hasta_lv_str = h_hasta_lv.strftime("%H:%M") if h_hasta_lv else ""
            hasta_sab_str = h_hasta_sab.strftime("%H:%M") if h_hasta_sab else ""

            if not h_hasta_lv:
                b_lv = next((b for b in bloques_raw_all if 1 <= b.dia <= 5 and _n(b.hora_desde) == h_lv), None)
                if b_lv:
                    hasta_lv_str = b_lv.hora_hasta.strftime("%H:%M")

            if not h_hasta_sab:
                b_sab = next((b for b in bloques_raw_all if b.dia == 6 and _n(b.hora_desde) == h_sab), None)
                if b_sab:
                    hasta_sab_str = b_sab.hora_hasta.strftime("%H:%M")

            es_recreo = es_recreo_lv or es_recreo_sab

            if str_desde_sab and str_desde_lv != str_desde_sab:
                desde_val = f"{str_desde_lv} / {str_desde_sab}"
                hasta_val = f"{hasta_lv_str} / {hasta_sab_str}"
            else:
                desde_val = str_desde_lv or str_desde_sab
                hasta_val = hasta_lv_str or hasta_sab_str

            franjas.append(
                HorarioFranja(
                    orden=i + 1,
                    posicion=i,
                    desde=desde_val,
                    hasta=hasta_val,
                    es_recreo=es_recreo,
                    desde_sec=str_desde_sab if str_desde_lv != str_desde_sab else None,
                    hasta_sec=hasta_sab_str if hasta_lv_str != hasta_sab_str else None,
                )
            )

        celdas = []
        for horario in items:
            materia_obj = horario.espacio
            detalles = list(horario.detalles.all())
            comisiones = comisiones_por_clave.get((horario.espacio_id, horario.turno_id, horario.anio_academico), [])

            nombres_com = []
            for c in comisiones:
                prof_nombre = c.materia.plan_de_estudio.profesorado.nombre
                nombres_com.append(f"{prof_nombre} - {c.materia.anio_cursada}º")
            docentes_names = [f"{docente.persona.apellido}, {docente.persona.nombre}"]

            materia_celda = HorarioMateriaCelda(
                materia_id=materia_obj.id,
                materia_nombre=materia_obj.nombre,
                comisiones=nombres_com,
                docentes=docentes_names,
                regimen=materia_obj.regimen,
                cuatrimestre=cuatr,
                es_cuatrimestral=cuatr in ["1C", "2C"],
            )

            for det in detalles:
                b = det.bloque
                pos = bloque_id_a_pos.get(b.id, 0)

                celdas.append(
                    HorarioCelda(
                        dia_numero=b.dia,
                        dia=b.get_dia_display(),
                        franja_orden=pos + 1,
                        franja_posicion=pos,
                        desde=b.hora_desde.strftime("%H:%M"),
                        hasta=b.hora_hasta.strftime("%H:%M"),
                        materias=[materia_celda],
                    )
                )

        dias = [
            HorarioDia(numero=1, nombre="Lunes"),
            HorarioDia(numero=2, nombre="Martes"),
            HorarioDia(numero=3, nombre="Miércoles"),
            HorarioDia(numero=4, nombre="Jueves"),
            HorarioDia(numero=5, nombre="Viernes"),
            HorarioDia(numero=6, nombre="Sábado"),
        ]

        cuatr_label = cuatr
        if cuatr == "1C":
            cuatr_label = "1.er Cuatrimestre"
        elif cuatr == "2C":
            cuatr_label = "2.do Cuatrimestre"

        tablas.append(
            HorarioTabla(
                key=f"turno-{turno_id}-cuatr-{cuatr}",
                profesorado_id=0,
                profesorado_nombre=f"Horario Docente - {turno_nombre}",
                plan_id=0,
                anio_plan=0,
                anio_plan_label=cuatr_label,
                turno_id=turno_id,
                turno_nombre=turno_nombre,
                cuatrimestres=[cuatr],
                dias=dias,
                franjas=franjas,
                celdas=celdas,
            )
        )

    return tablas
