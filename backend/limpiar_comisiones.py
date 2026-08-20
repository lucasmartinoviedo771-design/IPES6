from core.models import Comision

comisiones = Comision.objects.filter(estado=Comision.Estado.ABIERTA).select_related(
    'materia__plan_de_estudio__profesorado', 'turno'
)

closed_count = 0

for c in comisiones:
    prof = c.materia.plan_de_estudio.profesorado.nombre.lower()
    anio = c.materia.anio_cursada
    turno = c.turno.nombre.lower()
    
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
        # Matemática, Biología, Especial, etc.
        valid_turno = "turno vespertino"
        
    if turno != valid_turno:
        print(f"Cerrando {c.id} - {c.materia.nombre} ({prof[:15]} Año {anio}) - Era {turno}, debería ser {valid_turno}")
        c.estado = Comision.Estado.CERRADA
        c.save()
        closed_count += 1

print(f"Se cerraron {closed_count} comisiones.")
