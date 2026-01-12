import os
import sys
import django
from decimal import Decimal

# Setup Django environment
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import InscripcionMesa

def fix_incorrect_approvals():
    print("Iniciando corrección de notas...")
    
    # Buscar registros marcados como APROBADO pero con nota menor a 6
    incorrect_records = InscripcionMesa.objects.filter(
        condicion=InscripcionMesa.Condicion.APROBADO,
        nota__lt=6
    )
    
    count = incorrect_records.count()
    print(f"Encontrados {count} registros incorrectamente marcados como APROBADO con nota < 6.")
    
    if count == 0:
        print("No hay registros para corregir.")
        return

    updated_count = 0
    for record in incorrect_records:
        print(f"Corrigiendo: {record.estudiante} - Materia: {record.mesa.materia.nombre} - Nota: {record.nota}")
        # Cambiar a DESAPROBADO (asumiendo que es la condición correcta para nota < 6)
        record.condicion = InscripcionMesa.Condicion.DESAPROBADO
        record.save()
        updated_count += 1
    
    print(f"=== Proceso finalizado. Total corregidos: {updated_count} ===")

if __name__ == '__main__':
    fix_incorrect_approvals()
