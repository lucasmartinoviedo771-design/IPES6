import os
import sys

import django

sys.path.append("/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Estudiante, Persona, Profesorado

dni = "45887636"


def create_student():
    p = Persona.objects.filter(dni=dni).first()
    if not p:
        print("Persona not found.")
        return

    print(f"Found persona: {p.apellido}, {p.nombre}")

    # Check if already has estudiante
    est = getattr(p, "estudiante", None)
    if not est:
        print("Creating estudiante record...")
        est = Estudiante.objects.create(persona=p, legajo_estado="ACT")
        print("Created!")
    else:
        print("Estudiante already exists.")

    # Get the Profesorado de Educación Primaria
    carrera = Profesorado.objects.filter(nombre__icontains="Primaria").first()
    if carrera:
        print(f"Found carrera: {carrera.nombre}")
        if not est.carreras.filter(id=carrera.id).exists():
            print("Adding carrera to estudiante...")
            est.carreras.add(carrera)
            print("Added.")
        else:
            print("Already in carrera.")
    else:
        print("Carrera not found.")


if __name__ == "__main__":
    create_student()
