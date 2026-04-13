import os
import django
from django.db.models import Q, Count

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models.estudiantes import Estudiante, EstudianteCarrera
from core.models.regularidades import Regularidad
from core.models.actas import ActaExamenEstudiante
from core.models.carreras import Materia

def print_block(label, qs):
    stats = qs.aggregate(
        total=Count('id', distinct=True),
        v=Count('id', filter=Q(persona__genero='M'), distinct=True),
        m=Count('id', filter=Q(persona__genero='F'), distinct=True),
        x=Count('id', filter=Q(persona__genero='X'), distinct=True)
    )
    print(f"| {label} | {stats['total']} | {stats['v']} | {stats['m']} | {stats['x']} |")
    return stats

def get_report():
    print("| Rubro | TOTAL | Varones | Mujeres | X |")
    print("|---|---|---|---|---|")

    # 1. Ingresantes 1er Año (2026)
    # Todos los que tienen anio_ingreso 2026
    ingresantes_2026 = Estudiante.objects.filter(
        Q(anio_ingreso=2026) | Q(carreras_detalle__anio_ingreso=2026)
    ).distinct()
    
    # 2. Reinscriptos (Alumnos con notas en 2025)
    # Subirles un año
    ids_notas_2025 = set(Regularidad.objects.filter(fecha_cierre__year=2025).values_list('estudiante_id', flat=True))
    ids_actas_2025 = set(ActaExamenEstudiante.objects.filter(acta__fecha__year=2025).values_list('acta__materia__plan_de_estudio__profesorado__estudiantes__id', flat=True))
    # Actually actas are linked to student via the m2m in Profesorado or similar. 
    # Let's use a simpler join for ActaExamenEstudiante if possible.
    # ActaExamenEstudiante has 'dni'.
    dni_actas_2025 = set(ActaExamenEstudiante.objects.filter(acta__fecha__year=2025).values_list('dni', flat=True))
    ids_actas_2025 = set(Estudiante.objects.filter(persona__dni__in=dni_actas_2025).values_list('id', flat=True))
    
    ids_activos_2025 = ids_notas_2025.union(ids_actas_2025)
    reinscriptos_2026 = Estudiante.objects.filter(id__in=ids_activos_2025).distinct()

    # Matrícula Total = Ingresantes 2026 + Reinscriptos
    matricula_total_qs = (ingresantes_2026 | reinscriptos_2026).distinct()
    
    # 3. Residencia (4to Año en 2026) -> Aquellos que estaban en 3er año en 2025
    # O mejor: los que tenían una regularidad en Materia de 3er año en 2025
    materias_3er_anio = Materia.objects.filter(anio_cursada=3)
    ids_en_3ero_2025 = set(Regularidad.objects.filter(fecha_cierre__year=2025, materia__in=materias_3er_anio).values_list('estudiante_id', flat=True))
    residencia_2026 = Estudiante.objects.filter(id__in=ids_en_3ero_2025).distinct()

    # 4. Práctica (Aquellos que "suben" a 2do o 3ero)
    # Los que estaban en 1ro o 2do en 2025
    materias_1y2_anio = Materia.objects.filter(anio_cursada__in=[1, 2])
    ids_en_1y2_2025 = set(Regularidad.objects.filter(fecha_cierre__year=2025, materia__in=materias_1y2_anio).values_list('estudiante_id', flat=True))
    practica_2026 = Estudiante.objects.filter(id__in=ids_en_1y2_2025).distinct()

    print_block("Matrícula Total", matricula_total_qs)
    print_block("Ingresantes 1er Año", ingresantes_2026)
    print_block("Residencia (implied)", residencia_2026)
    print_block("Pasantía/Práctica (impl)", practica_2026)

if __name__ == '__main__':
    get_report()
