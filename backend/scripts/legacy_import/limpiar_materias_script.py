
import os
import django
import sys
from datetime import datetime

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Materia, PlanDeEstudio, Profesorado

def run_cleanup():
    print('Iniciando limpieza de materias incorrectas...')
    
    # 1. Identificar el Plan y Profesorado afectados
    # El script anterior usó estos datos para crear las materias
    nombre_profesorado = 'Profesorado de Educación Primaria'
    resolucion_plan = 'Resolución M.E. No 1935/14' # El plan que detectó y usó
    
    try:
        profesorado = Profesorado.objects.get(nombre=nombre_profesorado)
        plan = PlanDeEstudio.objects.get(profesorado=profesorado, resolucion=resolucion_plan)
        print(f"Limpiando materias del plan: {plan}")
    except Exception as e:
        print(f"Error al buscar plan: {e}")
        return

    # 2. Patrones de 'basura' que introdujo el script anterior
    # Ejemplos: "A-...", "A MAT-...", "-Educación...", "A 2C-..."
    # Estrategia: Buscar materias creadas HOY (o muy recientemente) que cumplan estos patrones
    
    # Vamos a ser agresivos con los patrones específicos que vimos en el log
    patrones_basura = [
        r'^A-', 
        r'^A\s',
        r'^-',
        r'^A\sMAT-',
        r'^A\s2C-',
        r'^A\sPEI-',
        r'^BIO-',
        r'º\sC-',
        r'MAT-' # Ojo con Matemática pura, verificar longitud
    ]
    
    materias_a_borrar = []
    todas_materias = Materia.objects.filter(plan_de_estudio=plan)
    
    print("\nAnalizando materias candidatas a borrar...")
    import re
    
    count = 0
    for mat in todas_materias:
        es_basura = False
        nombre = mat.nombre
        
        # Chequeo por Regex
        for pat in patrones_basura:
            if re.match(pat, nombre):
                es_basura = True
                break
        
        # Chequeo adicional: Nombres que terminan en sufijos técnicos del PDF que no limpié bien
        if 'tall_lab_sem' in nombre or '-Asignatura' in nombre or '-Módulo' in nombre:
            es_basura = True

        if es_basura:
            print(f" [X] Marcadar para borrar: '{mat.nombre}' (ID: {mat.id})")
            materias_a_borrar.append(mat.id)
            count += 1
        else:
            # print(f" [OK] Conservar: '{mat.nombre}'")
            pass
            
    if count == 0:
        print("\nNo se encontraron materias con patrones de basura obvios.")
        return

    print(f"\nTotal a borrar: {len(materias_a_borrar)}")
    confirm = input("¿Confirmar borrado? (escribe 'SI' para proceder): ")
    
    if confirm == 'SI':
        Materia.objects.filter(id__in=materias_a_borrar).delete()
        print("Limpieza completada exitosamente.")
    else:
        print("Operación cancelada.")

if __name__ == "__main__":
    run_cleanup()
