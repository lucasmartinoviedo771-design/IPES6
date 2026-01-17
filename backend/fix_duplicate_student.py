
from django.db import transaction
from core.models import Estudiante, InscripcionMesa, ActaExamenAlumno
from django.contrib.auth.models import User

dni_bad = "40091520"
dni_good = "44091520"

try:
    with transaction.atomic():
        try:
            bad_est = Estudiante.objects.get(dni=dni_bad)
        except Estudiante.DoesNotExist:
            print("El estudiante incorrecto ya no existe.")
            exit()
            
        try:
            good_est = Estudiante.objects.get(dni=dni_good)
        except Estudiante.DoesNotExist:
            print("El estudiante correcto no existe. Abortando para evitar errores.")
            exit()

        print(f"Fusionando Estudiante Incorrecto ID {bad_est.id} ({bad_est.dni}) -> Correcto ID {good_est.id} ({good_est.dni})")

        # 1. Update ActaExamenAlumno (Strings)
        actas_alumnos = ActaExamenAlumno.objects.filter(dni=dni_bad)
        count_actas = actas_alumnos.count()
        print(f"Actualizando {count_actas} registros de ActaExamenAlumno con DNI incorrecto...")
        actas_alumnos.update(dni=dni_good)

        # 2. Update InscripcionMesa (FKs)
        inscripciones_bad = InscripcionMesa.objects.filter(estudiante=bad_est)
        print(f"Procesando {inscripciones_bad.count()} inscripciones de mesa...")
        
        for insc in inscripciones_bad:
            mesa_id = insc.mesa.id
            materia_nombre = insc.mesa.materia.nombre
            
            # Check if good student is already in this mesa
            existe_insc_good = InscripcionMesa.objects.filter(mesa_id=mesa_id, estudiante=good_est).first()
            
            if existe_insc_good:
                print(f"  [CONFLICTO] El estudiante correcto YA esta en la mesa {mesa_id} ({materia_nombre}).")
                print(f"    - Bad Insc: Nota={insc.nota}, Cond={insc.condicion}")
                print(f"    - Good Insc: Nota={existe_insc_good.nota}, Cond={existe_insc_good.condicion}")
                
                if insc.nota is not None:
                    print("    -> La inscripcion incorecta TIENE NOTA. Priorizando datos de la incorrecta.")
                    existe_insc_good.delete()
                    insc.estudiante = good_est
                    insc.save()
                    print("    -> Fusion realizada: Se conservó la ficha 'bad' movida al estudiante 'good'.")
                else:
                    print("    -> La inscripcion incorrecta NO tiene nota. Borrando la incorrecta y manteniendo la existente del correcto.")
                    insc.delete()
            else:
                print(f"  [OK] Moviendo inscripcion mesa {mesa_id} ({materia_nombre}) al estudiante correcto.")
                insc.estudiante = good_est
                insc.save()

        # 3. Delete bad student and user
        bad_user = bad_est.user
        print(f"Eliminando estudiante incorrecto ID {bad_est.id}...")
        bad_est.delete()
        
        if bad_user:
            print(f"Eliminando usuario asociado {bad_user.username}...")
            bad_user.delete()

        print("--- Fusion completada con exito ---")

except Exception as e:
    print(f"ERROR: {e}")
    # Transaction rollback automatica al salir con excepcion
