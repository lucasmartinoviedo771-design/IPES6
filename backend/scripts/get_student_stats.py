import os
import sys
import django
from django.db.models import Q, Count
from datetime import date

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Estudiante, EstudianteCarrera
from core.models import Regularidad
from core.models import ActaExamenEstudiante, ActaExamen
from core.models import InscripcionMateriaEstudiante

def get_stats():
    # 1. Ingresantes 2026
    # Buscamos estudiantes con anio_ingreso 2026 en Estudiante o EstudianteCarrera
    ingresantes_2026_qs = Estudiante.objects.filter(
        Q(anio_ingreso=2026) | Q(carreras_detalle__anio_ingreso=2026)
    ).distinct()
    
    # 2. Activos desde 2025 (Subirle un año)
    # Estudiantes que tuvieron notas en 2025
    # En Regularidades
    estudiantes_reg_2025 = Regularidad.objects.filter(
        fecha_cierre__year=2025
    ).values_list('estudiante_id', flat=True)
    
    # En Actas de Examen
    estudiantes_acta_2025 = ActaExamenEstudiante.objects.filter(
        acta__fecha__year=2025
    ).values_list('acta__materia__plan__carreras__estudiantes', flat=True) # This join might be complex
    
    # Simplified search for students who had grades in 2025
    # Let's use Estudiante.objects for better filtering
    estudiantes_con_notas_2025 = Estudiante.objects.filter(
        Q(regularidades__fecha_cierre__year=2025) |
        Q(pk__in=estudiantes_reg_2025) # Just in case
    ).distinct()
    
    # Identify all "Active" students for 2026
    # Ingresantes 2026 + Those with 2025 notes (who are now 2nd+ year)
    todos_activos_qs = (ingresantes_2026_qs | estudiantes_con_notas_2025).distinct()
    
    def count_by_gender(qs):
        res = qs.aggregate(
            total=Count('id'),
            varones=Count('id', filter=Q(persona__genero='M')),
            mujeres=Count('id', filter=Q(persona__genero='F')),
            otros=Count('id', filter=Q(persona__genero='X'))
        )
        return res

    stats_total = count_by_gender(todos_activos_qs)
    stats_ingresantes = count_by_gender(ingresantes_2026_qs)
    
    # 3. Residencia y Práctica
    # Estudiantes inscritos en materias de Residenca/Práctica en 2026 (si hay) o 2025?
    # El usuario pide los datos actuales. Si no hay inscripciones 2026 para 2-4 año, 
    # quizás debamos mirar quiénes "deberían" estar en Residencia/Práctica.
    # Pero usualmente se pide lo cargado.
    
    materias_residencia = Materia.objects.filter(nombre__icontains='Residencia')
    materias_practica = Materia.objects.filter(nombre__icontains='Práctica')
    
    # Estudiantes con notas 2025 que estaban en materias previas a Residencia? 
    # O simplemente ver quiénes tuvieron notas en Residencia en 2025?
    # El cuadro parece pedir la foto actual.
    
    # Asumimos que los que tuvieron notas 2025 en materias de 3er año (por ejemplo) podrían estar en 4to (Residencia).
    # Pero sin inscripciones 2026, es difícil saber quién está cursando qué.
    # Veremos si hay inscripciones 2026.
    
    print("--- RESULTADOS ---")
    print(f"Total Activos Estudiantes (Ingresantes 2026 + Notas 2025): {stats_total['total']}")
    print(f"Varones: {stats_total['varones']}, Mujeres: {stats_total['mujeres']}, X: {stats_total['otros']}")
    print()
    print(f"Ingresantes 1er Año (2026): {stats_ingresantes['total']}")
    print(f"Varones: {stats_ingresantes['varones']}, Mujeres: {stats_ingresantes['mujeres']}, X: {stats_ingresantes['otros']}")
    
    # Residencia/Práctica (Current Year 2026)
    # If no 2026 enrollments for 2-4 year, these might be 0 unless we infer.
    # Let's check if there are ANY regularities or enrollments in 2026.
    
    print("\nDetalle por género para el cuadro:")
    print(f"Matrícula Total: TOTAL={stats_total['total']}, V={stats_total['varones']}, M={stats_total['mujeres']}, X={stats_total['otros']}")
    print(f"Ingresantes 1er Año: TOTAL={stats_ingresantes['total']}, V={stats_ingresantes['varones']}, M={stats_ingresantes['mujeres']}, X={stats_ingresantes['otros']}")

if __name__ == '__main__':
    get_stats()
