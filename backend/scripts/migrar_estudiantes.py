from core.models import Comision, InscripcionMateriaEstudiante

comisiones_abiertas = Comision.objects.filter(estado=Comision.Estado.ABIERTA).select_related(
    "materia__plan_de_estudio__profesorado", "turno"
)

migrados = 0
comisiones_creadas = 0
comisiones_cerradas = 0

for c in comisiones_abiertas:
    prof = c.materia.plan_de_estudio.profesorado.nombre.lower()
    anio = c.materia.anio_cursada
    turno_actual = c.turno.nombre.lower()

    valid_turno = ""

    if "geografía" in prof or "certificación docente" in prof:
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
        inscripciones = InscripcionMateriaEstudiante.objects.filter(comision=c)
        count_actual = inscripciones.count()

        if count_actual > 0:
            print(f"[{c.materia.nombre}] Hay {count_actual} alumnos en {turno_actual} (Debe ser {valid_turno})")

            # Buscar si existe comision en el turno correcto
            from core.models import Turno

            turno_correcto_obj = Turno.objects.filter(nombre__icontains=valid_turno.replace("turno ", "")).first()

            c_correcta = Comision.objects.filter(materia=c.materia, turno=turno_correcto_obj).first()

            if not c_correcta:
                print(f"  -> Creando nueva comision en {valid_turno}...")
                c_correcta = Comision.objects.create(
                    materia=c.materia,
                    turno=turno_correcto_obj,
                    codigo=f"A ({c.materia.nombre})",
                    estado=Comision.Estado.ABIERTA,
                    cupo=0,  # Sin limite estricto
                )
                comisiones_creadas += 1
            elif c_correcta.estado != Comision.Estado.ABIERTA:
                c_correcta.estado = Comision.Estado.ABIERTA
                c_correcta.save()

            # Traspasar alumnos
            for insc in inscripciones:
                insc.comision = c_correcta
                insc.save()
                migrados += 1

            print(f"  -> {count_actual} alumnos migrados con exito a la Comision ID {c_correcta.id}.")

            # Cerrar comision invalida
            c.estado = Comision.Estado.CERRADA
            c.save()
            comisiones_cerradas += 1

print("\n================== RESUMEN ==================")
print(f"Alumnos migrados de turno: {migrados}")
print(f"Nuevas comisiones creadas: {comisiones_creadas}")
print(f"Comisiones erroneas cerradas: {comisiones_cerradas}")
