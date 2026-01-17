
from core.models import Estudiante, InscripcionMesa, ActaExamen, ActaExamenAlumno
from django.contrib.auth.models import User

dni_incorrecto = "40091520"
dni_correcto = "44091520"

print(f"--- Buscando DNI Incorrecto: {dni_incorrecto} ---")
est_incorrecto = Estudiante.objects.filter(dni=dni_incorrecto).first()
if est_incorrecto:
    user_display = est_incorrecto.user.get_full_name() if est_incorrecto.user else "Sin usuario"
    print(f"Estudiante Incorrecto ENCONTRADO: ID={est_incorrecto.id}, Nombre={user_display}")
    inscripciones = InscripcionMesa.objects.filter(estudiante=est_incorrecto)
    print(f"  Inscripciones a Mesas: {inscripciones.count()}")
    for i in inscripciones:
        print(f"    - Mesa #{i.mesa.id} ({i.mesa.materia.nombre}): Nota={i.nota}, Condicion={i.condicion}")
else:
    print("Estudiante Incorrecto NO existe.")

print(f"\n--- Buscando DNI Correcto: {dni_correcto} ---")
est_correcto = Estudiante.objects.filter(dni=dni_correcto).first()
if est_correcto:
    user_display = est_correcto.user.get_full_name() if est_correcto.user else "Sin usuario"
    print(f"Estudiante Correcto ENCONTRADO: ID={est_correcto.id}, Nombre={user_display}")
    inscripciones = InscripcionMesa.objects.filter(estudiante=est_correcto)
    print(f"  Inscripciones a Mesas: {inscripciones.count()}")
else:
    print("Estudiante Correcto NO existe.")
