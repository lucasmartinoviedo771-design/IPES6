import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from core.models import Comision, Turno
from django.db import transaction

def main():
    comisiones_abiertas = Comision.objects.filter(estado=Comision.Estado.ABIERTA).select_related(
        'materia__plan_de_estudio__profesorado', 'turno', 'horario'
    )

    comisiones_corregidas = 0
    horarios_corregidos = 0

    with transaction.atomic():
        for c in comisiones_abiertas:
            prof = c.materia.plan_de_estudio.profesorado.nombre.lower()
            anio = c.materia.anio_cursada
            turno_actual = c.turno.nombre.lower()
            
            valid_turno = ''
            
            if "geografía" in prof:
                valid_turno = "turno mañana"
            elif "certificación docente" in prof:
                valid_turno = "turno mañana"
            elif "primaria" in prof or "inicial" in prof:
                if anio == 4:
                    valid_turno = "turno vespertino"
                else:
                    valid_turno = "turno mañana"
            elif "historia" in prof or "lengua" in prof:
                valid_turno = "turno tarde"
            else:
                valid_turno = "turno vespertino"
                
            if turno_actual != valid_turno:
                print(f"[{c.materia.nombre}] ID {c.id} - Actual: {turno_actual} -> Correcto: {valid_turno}")
                
                # Obtener el objeto Turno correcto
                turno_correcto_obj = Turno.objects.filter(nombre__icontains=valid_turno.replace('turno ', '')).first()
                
                if turno_correcto_obj:
                    # 1. Cambiar el turno a la Comision
                    c.turno = turno_correcto_obj
                    c.save(update_fields=['turno'])
                    comisiones_corregidas += 1
                    
                    # 2. Si tiene horario asignado, cambiar el turno del horario
                    if c.horario:
                        c.horario.turno = turno_correcto_obj
                        c.horario.save(update_fields=['turno'])
                        horarios_corregidos += 1
                        print(f"  -> Horario ID {c.horario.id} tambien actualizado al turno correcto.")

    print("\n================== RESUMEN ==================")
    print(f"Comisiones actualizadas de turno: {comisiones_corregidas}")
    print(f"Horarios actualizados de turno: {horarios_corregidos}")

if __name__ == "__main__":
    main()
