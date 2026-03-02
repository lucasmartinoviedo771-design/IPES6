import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Estudiante, Preinscripcion, PreinscripcionChecklist, EstudianteCarrera

def fix():
    # Buscamos estudiantes que tienen carrera asignada pero no tienen preinscripción para ese año
    registros = EstudianteCarrera.objects.all()
    count = 0
    for reg in registros:
        estudiante = reg.estudiante
        profesorado = reg.profesorado
        anio = reg.anio_ingreso or 2024 # default fallback
        
        pre, created = Preinscripcion.objects.get_or_create(
            alumno=estudiante,
            carrera=profesorado,
            anio=anio,
            defaults={
                'estado': 'Enviada',
                'activa': True,
                'codigo': f'PRE-{anio}-{estudiante.id:04d}'
            }
        )
        if created:
            PreinscripcionChecklist.objects.get_or_create(preinscripcion=pre)
            print(f'Creada preinscripción para {estudiante.dni} en {profesorado.nombre}')
            count += 1
            
    print(f'Total de preinscripciones creadas: {count}')

if __name__ == '__main__':
    fix()
