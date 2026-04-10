from core.models import Docente, MesaExamen, Persona
from django.db import transaction

def merge_docentes(source_ids, target_id):
    try:
        target = Docente.objects.get(pk=target_id)
    except Docente.DoesNotExist:
        print(f"ERROR: No se encontró el docente destino ID {target_id}")
        return

    sources = Docente.objects.filter(pk__in=source_ids)
    if not sources.exists():
        print(f"ERROR: No se encontraron los docentes origen {source_ids}")
        return

    print(f"Iniciando fusión hacia: {target} (ID: {target.id}, DNI: {target.dni})")

    with transaction.atomic():
        # Reasignar Mesas como Presidente
        count_pres = MesaExamen.objects.filter(docente_presidente__in=sources).update(docente_presidente=target)
        # Reasignar Mesas como Vocal 1
        count_v1 = MesaExamen.objects.filter(docente_vocal1__in=sources).update(docente_vocal1=target)
        # Reasignar Mesas como Vocal 2
        count_v2 = MesaExamen.objects.filter(docente_vocal2__in=sources).update(docente_vocal2=target)

        print(f" - Reasignadas {count_pres} mesas (Presidente)")
        print(f" - Reasignadas {count_v1} mesas (Vocal 1)")
        print(f" - Reasignadas {count_v2} mesas (Vocal 2)")

        # Otros modelos pueden tener FK a Docente
        # En IPES6, check signals or other models if needed.
        # Por ahora los modelos principales de mesas están cubiertos.

        # Borrar docs origen y sus personas asociadas
        for s in sources:
            p_id = s.persona_id
            s.delete()
            if p_id:
                Persona.objects.filter(id=p_id).delete()
            print(f" - Borrado Docente ID {s.id} y su Persona asociada.")

    print("Fusión completada con éxito.")

# Ejecutar para Flores, Mar
print("\n--- Procesando FLORES, Mar ---")
merge_docentes([327, 328, 329, 331], 164)

# Chequeo para otros evidentes
# SOTO VIDAL (16) <- Soto V (321)
print("\n--- Procesando SOTO VIDAL ---")
merge_docentes([321], 16)
