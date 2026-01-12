import os
import sys
import django

# Setup Django environment
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
sys.path.append(backend_dir)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import ActaExamen, InscripcionMesa, Estudiante

def clean_partial_acta():
    # 1. Delete the partial Acta 31
    try:
        acta = ActaExamen.objects.get(id=31)
        print(f"Eliminando Acta parcial {acta.codigo} (ID 31)...")
        acta_codigo = acta.codigo
        acta.delete()
        print(f"Acta {acta_codigo} eliminada correctamente.")
    except ActaExamen.DoesNotExist:
        print("Acta 31 no encontrada (ya eliminada?).")

    # 2. Delete the specific inscription in Mesa 23 (Aguilar Diaz)
    try:
        est = Estudiante.objects.get(dni='34375991')
        # Verify Mesa 23 exists first to avoid errors if it was manual
        inscs = InscripcionMesa.objects.filter(mesa_id=23, estudiante=est)
        count = inscs.count()
        if count > 0:
            print(f"Eliminando {count} inscripción(es) en Mesa 23 para el alumno {est.dni}...")
            inscs.delete()
            print("Inscripción eliminada.")
        else:
            print(f"No se encontró inscripción en Mesa 23 para el alumno {est.dni}.")
            
    except Estudiante.DoesNotExist:
        print("Estudiante Aguilar Diaz (34375991) no encontrado.")
    except Exception as e:
        print(f"Error limpiando inscripción: {e}")

if __name__ == '__main__':
    clean_partial_acta()
