import os
import sys

import django

# Setup Django environment
sys.path.insert(0, '/home/ipesrg/sistema-gestion/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.estudiantes.api.helpers.estudiante_admin import (
    _determine_condicion,
    _extract_documentacion_from_ec,
)
from core.models import EstudianteCarrera


def main():
    ecs_activos = EstudianteCarrera.objects.filter(
        estado_academico=EstudianteCarrera.EstadoAcademico.ACTIVO
    ).select_related("estudiante__persona", "profesorado")

    ecs_a_corregir = []
    total_activos = ecs_activos.count()

    for ec in ecs_activos:
        doc = _extract_documentacion_from_ec(ec)
        cond_calculada = _determine_condicion(doc)
        if cond_calculada == "Regular" and ec.estado_legajo != EstudianteCarrera.EstadoLegajo.COMPLETO:
            ecs_a_corregir.append((ec, cond_calculada, ec.estado_legajo, doc))

    print("\n=======================================================")
    print("📊 REPORTE DE AUDITORÍA DE LEGAJOS (ESTUDIANTES ACTIVOS)")
    print("=======================================================")
    print(f"Total inscripciones activas evaluadas: {total_activos}")
    print(f"Casos a regularizar (Legajo completo que figuraban Condicionales): {len(ecs_a_corregir)}\n")

    for idx, (ec, nueva_cond, viejo_estado, doc) in enumerate(ecs_a_corregir, 1):
        p = ec.estudiante.persona
        tipo = "Cert. Docente" if doc.get("es_certificacion_docente") else "Profesorado"
        print(f"{idx}. DNI: {p.dni} | {p.apellido}, {p.nombre}")
        print(f"   Carrera: {ec.profesorado.nombre} ({tipo})")
        print(f"   Estado actual en BD: {viejo_estado} -> Condición calculada: {nueva_cond} (COMPLETO)\n")

if __name__ == '__main__':
    main()
