import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import transaction
from core.models import Comision, HorarioCatedra
from apps.asistencia.services import sync_course_snapshots
from django.core.management import call_command

def vincular_horarios_comisiones():
    print("=== INICIANDO VINCULACIÓN AUTOMÁTICA DE HORARIOS A COMISIONES ===")
    
    comisiones_sin_horario = Comision.objects.filter(horario__isnull=True)
    total_sin = comisiones_sin_horario.count()
    print(f"Comisiones sin horario_id: {total_sin}")
    
    vinculadas = 0
    sin_horario_disponible = 0
    
    with transaction.atomic():
        for comision in comisiones_sin_horario:
            # Buscar horario de cátedra que coincida en materia y año académico (y preferentemente turno si coincide)
            horarios = HorarioCatedra.objects.filter(
                espacio=comision.materia,
                anio_academico=comision.anio_lectivo
            )
            
            horario_match = None
            if comision.turno_id:
                horario_match = horarios.filter(turno_id=comision.turno_id).first()
            
            if not horario_match:
                horario_match = horarios.first()
                
            if horario_match:
                comision.horario = horario_match
                comision.save(update_fields=["horario"])
                vinculadas += 1
            else:
                sin_horario_disponible += 1

    print(f"-> Comisiones vinculadas exitosamente: {vinculadas}")
    print(f"-> Comisiones sin HorarioCatedra existente en el sistema: {sin_horario_disponible}")
    
    print("\n=== REGENERANDO SNAPSHOTS DE ASISTENCIA ===")
    sync_course_snapshots()
    print("-> Snapshots sincronizados con éxito.")
    
    print("\n=== GENERANDO / ACTUALIZANDO CLASES PROGRAMADAS ===")
    call_command("generate_asistencia_classes")
    print("-> Clases del día generadas con éxito.")

if __name__ == "__main__":
    vincular_horarios_comisiones()
