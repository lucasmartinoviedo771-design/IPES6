import os
import django
import sys
from pathlib import Path

# Configurar Django
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Estudiante, Preinscripcion, EstudianteCarrera

def link():
    # Estudiantes con legajo pendiente y que tengan alguna carrera asociada
    estudiantes = Estudiante.objects.filter(estado_legajo='PEN')
    print(f"🔍 Encontrados {estudiantes.count()} estudiantes con legajo pendiente.")
    
    count = 0
    for est in estudiantes:
        # Buscar su vinculación a carrera
        vinculos = EstudianteCarrera.objects.filter(estudiante=est)
        for v in vinculos:
            # Crear preinscripción si no existe
            pre, created = Preinscripcion.objects.get_or_create(
                alumno=est,
                carrera=v.profesorado,
                anio=v.anio_ingreso or 2026,
                defaults={
                    "estado": 'PEN',
                    "codigo": f"IMP-{est.dni}"
                }
            )
            if created:
                count += 1
    
    print(f"✅ Se crearon {count} registros de preinscripción.")

if __name__ == "__main__":
    link()
