import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import PlanillaRegularidadFila, ActaExamenEstudiante, EquivalenciaDisposicionDetalle, SystemLog
from apps.primera_carga.audit_utils import (
    verify_regularidad_consistency, 
    verify_acta_consistency, 
    verify_equivalencia_consistency
)

def run_full_audit():
    print("Iniciando auditoría completa de base de datos...")
    
    # Optional: Clear existing mismatch logs to start fresh? 
    # Or just add new ones. Let's just add new ones but inform.
    
    # 1. Regularidades
    print(f"Auditando {PlanillaRegularidadFila.objects.count()} filas de regularidad...")
    for fila in PlanillaRegularidadFila.objects.select_related('planilla__materia', 'estudiante').all():
        verify_regularidad_consistency(fila)
        
    # 2. Actas
    print(f"Auditando {ActaExamenEstudiante.objects.count()} alumnos en actas...")
    for acta_est in ActaExamenEstudiante.objects.select_related('acta__materia').all():
        verify_acta_consistency(acta_est)
        
    # 3. Equivalencias
    print(f"Auditando {EquivalenciaDisposicionDetalle.objects.count()} detalles de equivalencia...")
    for eq_det in EquivalenciaDisposicionDetalle.objects.select_related('disposicion__estudiante', 'materia').all():
        verify_equivalencia_consistency(eq_det)

    print("Auditoría terminada. Revisa el panel de Alertas de Sistema.")

if __name__ == "__main__":
    run_full_audit()
