import os
import re
import django
import sys

# Setup Django Environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Profesorado, PlanDeEstudio, Materia

# Eliminar estructura de clase Command heredada
def run_import():
    print('Importando estructura de materias...')
    # 1. Configuración Base
    # Intentar ruta local (host) o ruta docker (container)
    if os.path.exists('/home/ipesrg/Primariatemporal/2025'):
        base_path = '/home/ipesrg/Primariatemporal/2025'
    else:
        base_path = '/app/Primariatemporal/2025'
        
        
    
    # Datos del Plan
    PLAN_RESOLUCION = 'RES-PEP-UNICO' 
    ANIO_INICIO_PLAN = 2009 
    
    # Crear o buscar Profesorado
    profesorado, created_prof = Profesorado.objects.get_or_create(
        nombre='Profesorado de Educación Primaria',
        defaults={
            'duracion_anios': 4,
            'activo': True,
            'inscripcion_abierta': True,
            'es_certificacion_docente': False
        }
    )
    print(f'Profesorado: {profesorado}')

    # Estrategia Plan Único: Buscar el primero vigente o crear uno
    plan = PlanDeEstudio.objects.filter(profesorado=profesorado).first()
    if not plan:
        plan = PlanDeEstudio.objects.create(
            profesorado=profesorado,
            resolucion=PLAN_RESOLUCION,
            anio_inicio=ANIO_INICIO_PLAN,
            vigente=True
        )
        print(f'Plan creado: {plan}')
    else:
        print(f'Usando plan existente: {plan}')

    # 2. Recorrer directorios
    anios_dirs = {
        '1º': 1, '2º': 2, '3º': 3, '4º': 4
    }
    
    for anio_name, anio_num in anios_dirs.items():
        anio_path = os.path.join(base_path, anio_name)
        if not os.path.exists(anio_path):
            print(f'No encontrado: {anio_path}')
            continue
            
        print(f'Procesando Año: {anio_num} ({anio_name})...')
        
        for periodo_name in os.listdir(anio_path):
            periodo_path = os.path.join(anio_path, periodo_name)
            if not os.path.isdir(periodo_path):
                continue

            # Determinar Régimen
            regimen = Materia.TipoCursada.ANUAL # Default
            if '1º Cuatrimestre' in periodo_name or '1° Cuatrimestre' in periodo_name:
                    regimen = Materia.TipoCursada.PRIMER_CUATRIMESTRE
            elif '2º' in periodo_name:
                regimen = Materia.TipoCursada.ANUAL
            
            # Procesar archivos PDF
            for filename in os.listdir(periodo_path):
                if not filename.endswith('.pdf'):
                    continue
                    
                nombre_limpio = limpiar_nombre(filename)
                
                # Heurística para Formato
                formato = Materia.FormatoMateria.ASIGNATURA
                nombre_lower = nombre_limpio.lower()
                if 'taller' in nombre_lower:
                    formato = Materia.FormatoMateria.TALLER
                elif 'practica' in nombre_lower or 'práctica' in nombre_lower:
                    formato = Materia.FormatoMateria.PRACTICA
                elif 'seminario' in nombre_lower:
                    formato = Materia.FormatoMateria.SEMINARIO
                elif 'ateneo' in nombre_lower:
                    formato = Materia.FormatoMateria.ASIGNATURA 
                elif 'modulo' in nombre_lower or 'módulo' in nombre_lower:
                    formato = Materia.FormatoMateria.MODULO
                
                materia, created = Materia.objects.update_or_create(
                    plan_de_estudio=plan,
                    anio_cursada=anio_num,
                    nombre=nombre_limpio,
                    defaults={
                        'formato': formato,
                        'regimen': regimen,
                        'horas_semana': 4 # Default
                    }
                )
                
                status = "CREADO" if created else "ACTUALIZADO"
                print(f'   - [{status}] {nombre_limpio} (Año {anio_num}, {regimen})')

def limpiar_nombre(filename):
        # Quitar extensión
        name = filename.replace('.pdf', '')
        
        # Patrones comunes de basura en los nombres de archivo
        # "1° 1C Alfabetización Académica" -> "Alfabetización Académica"
        # "Alfabetización Académica (Comisión Matemática) - Copia de tall_lab_sem Cuatri"
        
        # 1. Quitar prefijos numéricos de año/cuatrimestre tipo "1° 1C ", "1ero", "1°", etc.
        name = re.sub(r'^\d+[°º]?\s*\d*C?\s*', '', name)
        
        # 2. Quitar sufijos de "Copia de...", " - PRP", "(1)", etc.
        name = re.split(r' - |\(', name)[0]
        
        # 3. Limpieza general
        name = name.strip()
        
        return name
if __name__ == "__main__": run_import()
