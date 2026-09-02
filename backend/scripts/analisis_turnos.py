from core.models import Comision, InscripcionMateriaEstudiante

comisiones = Comision.objects.filter(estado=Comision.Estado.ABIERTA).select_related(
    "materia__plan_de_estudio__profesorado", "turno"
)

resultados = []

for c in comisiones:
    prof = c.materia.plan_de_estudio.profesorado.nombre.lower()
    anio = c.materia.anio_cursada
    turno_actual = c.turno.nombre.lower()

    valid_turno = ""

    if "geografía" in prof:
        valid_turno = "turno mañana"
    elif "primaria" in prof or "inicial" in prof:
        if anio == 4:
            valid_turno = "turno vespertino"
        else:
            valid_turno = "turno mañana"
    elif "historia" in prof or "lengua" in prof:
        valid_turno = "turno tarde"
    else:
        valid_turno = "turno vespertino"

    if turno_actual != valid_turno:
        count_actual = InscripcionMateriaEstudiante.objects.filter(comision=c).count()
        if count_actual > 0:
            # Buscar comision correcta
            c_correcta = Comision.objects.filter(
                materia=c.materia, turno__nombre__icontains=valid_turno.replace("turno ", "")
            ).first()

            count_correcta = 0
            existe_correcta = False
            estado_correcta = ""

            if c_correcta:
                existe_correcta = True
                estado_correcta = c_correcta.get_estado_display()
                count_correcta = InscripcionMateriaEstudiante.objects.filter(comision=c_correcta).count()

            resultados.append(
                {
                    "materia": c.materia.nombre,
                    "profesorado": c.materia.plan_de_estudio.profesorado.nombre,
                    "anio": anio,
                    "turno_incorrecto": c.turno.nombre,
                    "count_incorrecto": count_actual,
                    "existe_correcto": existe_correcta,
                    "turno_correcto": valid_turno.capitalize(),
                    "estado_correcto": estado_correcta,
                    "count_correcto": count_correcta,
                }
            )

print("Generando reporte markdown...")
with open("/tmp/reporte_turnos.md", "w", encoding="utf-8") as f:
    f.write("# Reporte de Comisiones en Turno Incorrecto con Alumnos\\n\\n")
    f.write(
        "| Profesorado | Año | Materia | Turno Incorrecto (Alumnos) | Turno Correcto Ideal | ¿Existe en BD? | Alumnos en T. Correcto |\\n"
    )
    f.write("|---|---|---|---|---|---|---|\\n")
    for r in resultados:
        prof_corto = r["profesorado"].replace("Profesorado de Educación ", "").replace("Secundaria en ", "")
        existe = "✅ Sí" if r["existe_correcto"] else "❌ No"
        if r["existe_correcto"]:
            existe += f" ({r['estado_correcto']})"
        f.write(
            f"| {prof_corto} | {r['anio']} | {r['materia']} | **{r['turno_incorrecto']} ({r['count_incorrecto']})** | {r['turno_correcto']} | {existe} | **{r['count_correcto']}** |\\n"
        )

print("Reporte generado en /tmp/reporte_turnos.md")
