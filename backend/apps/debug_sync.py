from core.models import Estudiante, PreinscripcionChecklist

def debug_sync():
    dni = '95258670'
    est = Estudiante.objects.filter(persona__dni=dni).first()
    if not est:
        print(f"Estudiante with DNI {dni} not found")
        return

    print(f"Estudiante {est.id} (DNI {dni}):")
    print(f"  dni_legalizado: {est.dni_legalizado}")
    print(f"  fotos_4x4: {est.fotos_4x4}")
    print(f"  folios_oficio: {est.folios_oficio}")

    checklists = PreinscripcionChecklist.objects.filter(preinscripcion__alumno=est)
    print(f"Found {len(checklists)} checklists")
    for cl in checklists:
        print(f"  Checklist {cl.id} (Pre {cl.preinscripcion.id}, Active {cl.preinscripcion.activa}):")
        print(f"    dni_legalizado: {cl.dni_legalizado}")
        print(f"    fotos_4x4: {cl.fotos_4x4}")
        print(f"    folios_oficio: {cl.folios_oficio}")

if __name__ == "__main__":
    import django
    django.setup()
    debug_sync()
