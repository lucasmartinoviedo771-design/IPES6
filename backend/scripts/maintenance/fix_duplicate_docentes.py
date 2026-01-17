import os
import django
import sys
import unicodedata
from django.db import transaction
from django.db.models import Q

# Configurar entorno Django
sys.path.append('/app')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import (
    Docente, 
    ActaExamenDocente, 
    MesaExamen, 
    PlanillaRegularidadDocente, 
    Comision
)

def normalize(text):
    if not text: return ""
    text = str(text).lower().strip().replace("  ", " ")
    return ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')

def merge_docentes():
    # 1. Buscar todos los docentes con DNI temporal ("HIST-")
    hist_docentes = Docente.objects.filter(dni__startswith='HIST-')
    print(f"Total docentes HIST encontrados: {hist_docentes.count()}")

    merged_count = 0
    
    # 2. Agrupar por nombre normalizado
    grouped = {}
    for doc in hist_docentes:
        key = normalize(f"{doc.apellido}, {doc.nombre}")
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(doc)
    
    print(f"Nombres unicos detectados: {len(grouped)}")

    with transaction.atomic():
        for key, duplicates in grouped.items():
            # Buscar si existe un docente REAL (sin HIST-) con ese nombre
            real_docente = None
            
            # Estrategia de búsqueda de real:
            # Separamos el key en partes para intentar buscar apellido/nombre
            # Pero Docente.objects.all() es mejor iterar y comparar normalizado si son pocos,
            # o intentar filtrar. 
            # Dado que el nombre ya está normalizado en 'key', intentemos un match "simple" primero.
            
            # Como normalize es agresivo, mejor buscamos candidatos aproximados en DB
            # Esto es costoso si hay muchos docentes, pero para un script de arreglo está bien.
            
            # Optimización: buscar por apellido aproximado
            example = duplicates[0]
            candidates = Docente.objects.filter(
                apellido__icontains=example.apellido.split()[0]
            ).exclude(dni__startswith='HIST-')
            
            for cand in candidates:
                cand_key = normalize(f"{cand.apellido}, {cand.nombre}")
                if cand_key == key:
                    real_docente = cand
                    break
            
            if real_docente:
                master = real_docente
                print(f"--> FUSIONANDO {len(duplicates)} HISTs en REAL: {master} ({master.dni})")
            else:
                # Si no hay real, usamos el primero de los duplicados como master
                if len(duplicates) < 2:
                    continue
                # Ordenar para consistencia (ej: el ID mas bajo primero)
                duplicates.sort(key=lambda x: x.id)
                master = duplicates[0]
                duplicates = duplicates[1:] # El resto se elimina
                print(f"--> UNIFICANDO {len(duplicates) + 1} HISTs en MASTER: {master} ({master.dni})")
            
            # Proceder a migrar FKs de todos los duplicates (si master es uno de ellos, ya lo sacamos de la lista duplicates)
            # Si master es real, duplicates son TODOS los hist.
            
            target_list = duplicates if real_docente else duplicates # ya está sliceado arriba si no era real
            if real_docente:
                target_list = duplicates # todos los hist
                
            for dup in target_list:
                # 1. ActaExamenDocente
                ActaExamenDocente.objects.filter(docente=dup).update(docente=master)
                
                # 2. MesaExamen
                MesaExamen.objects.filter(docente_presidente=dup).update(docente_presidente=master)
                MesaExamen.objects.filter(docente_vocal1=dup).update(docente_vocal1=master)
                MesaExamen.objects.filter(docente_vocal2=dup).update(docente_vocal2=master)
                
                # 3. PlanillaRegularidadDocente
                PlanillaRegularidadDocente.objects.filter(docente=dup).update(docente=master)
                
                # 4. Comision
                Comision.objects.filter(docente=dup).update(docente=master)
                
                print(f"    - Eliminado duplicado: {dup.id} {dup.dni}")
                dup.delete()
                merged_count += 1

    print(f"Limpieza finalizada. Se fusionaron/eliminaron {merged_count} registros duplicados.")

if __name__ == "__main__":
    merge_docentes()
