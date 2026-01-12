import os
import django
import sys

# Setup Django environment
sys.path.append("/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.db import transaction
from core.models import (
    Profesorado, PlanDeEstudio, Materia, 
    Correlatividad, CorrelatividadVersion, CorrelatividadVersionDetalle
)

# Estructura: (Materia, [Regularizadas], [AprobadasCursar], [AprobadasRendir])
# A = Asignatura, M = Modulo, T = Taller (Solo referencia)

RULES = [
    # --- SEGUNDO AÑO ---
    ("Curriculum", ["Pedagogía"], [], ["Pedagogía"]),
    ("Problemática de la educación primaria", ["Pedagogía"], [], ["Pedagogía"]),
    ("Historia y política educacional", ["Historia Social Argentina y Latinoamericana"], [], ["Historia Social Argentina y Latinoamericana"]),
    ("Didáctica de la matemática", ["Matemática", "Pedagogía"], [], ["Matemática", "Pedagogía"]),
    ("Didáctica General", ["Pedagogía"], [], ["Pedagogía"]),
    ("Didáctica de las ciencias naturales", ["Ciencias Naturales", "Pedagogía"], [], ["Ciencias Naturales", "Pedagogía"]),
    ("Sujeto de la Educación Primaria I", ["Psicología Educacional"], [], ["Psicología Educacional"]),
    ("Práctica II: Enseñanza y curriculum", ["Psicología Educacional", "Pedagogía"], ["Práctica I: Instituciones educativas y comunidad"], []),
    
    # --- TERCER AÑO ---
    ("Filosofía de la Educación", [], ["Pedagogía"], []),
    ("Sociología de la Educación", ["Historia y política educacional"], ["Historia Social Argentina y Latinoamericana"], []),
    ("Sujeto de la Educación Primaria II", ["Sujeto de la Educación Primaria I"], [], ["Sujeto de la Educación Primaria I"]),
    ("Educación Física", [], ["Cuerpo, juego y expresión"], []),
    ("Alfabetización Inicial", ["Psicología Educacional", "Sujeto de la Educación Primaria I"], ["Prácticas del Lenguaje"], ["Prácticas del Lenguaje"]),
    ("Didáctica de las Ciencias Sociales", ["Ciencias Sociales", "Didáctica General"], ["Pedagogía"], []),
    ("Didáctica de las prácticas del lenguaje", ["Didáctica General"], ["Prácticas del Lenguaje", "Pedagogía"], ["Prácticas del Lenguaje"]),
    ("Práctica III: Práctica de la enseñanza", 
     ["Curriculum", "Didáctica General", "Problemática de la educación primaria", "Didáctica de la matemática", "Didáctica de las ciencias naturales"], 
     ["Pedagogía", "Psicología Educacional", "Prácticas del Lenguaje", "Práctica II: Enseñanza y curriculum"], 
     []),

    # --- CUARTO AÑO ---
    ("Proyectos Educativos con TIC", 
     ["Didáctica de las Ciencias Sociales", "Didáctica de las prácticas del lenguaje", "Didáctica de la matemática", "Didáctica de las ciencias naturales"], 
     [], 
     ["Didáctica de las Ciencias Sociales", "Didáctica de las prácticas del lenguaje", "Didáctica de la matemática", "Didáctica de las ciencias naturales"]),
     
    ("Investigación Educativa", [], ["Alfabetización Académica", "Práctica III: Práctica de la enseñanza"], ["Alfabetización Académica"]),
]

# Reglas especiales para Residencia: Todo 1ro, 2do y 3ro aprobado
RESIDENCIA_TARGETS = [
    "Práctica IV: Residencia pedagógica",
    "Taller de Residencia de Matemática",
    "Taller de Residencia de Prácticas del Lenguaje",
    "Taller de Residencia de Ciencias Naturales",
    "Taller de Residencia de Ciencias Sociales"
]

@transaction.atomic
def run():
    print("Iniciando importacion Cohorte 2015-2022...")
    prof_nombre = "Profesorado de Educación Primaria"
    profesorado = Profesorado.objects.filter(nombre__icontains=prof_nombre).first()
    
    if not profesorado:
        print(f"Error: No se encontro profesorado '{prof_nombre}'")
        return

    plan = PlanDeEstudio.objects.filter(profesorado=profesorado, vigente=True).first()
    if not plan:
        plan = PlanDeEstudio.objects.filter(profesorado=profesorado).order_by('-anio_inicio').first()
        
    if not plan:
        print("Error: No se encontro plan de estudio")
        return

    # Crear Version Historica
    version, created = CorrelatividadVersion.objects.get_or_create(
        plan_de_estudio=plan,
        profesorado=profesorado,
        nombre="Cohorte 2015-2022",
        defaults={
            "cohorte_desde": 2015,
            "cohorte_hasta": 2022,
            "activo": True
        }
    )
    print(f"Version de correlatividades: {'Creada' if created else 'Actualizada'} (Cohorte 2015-2022)")

    # Cache de materias
    all_materias = Materia.objects.filter(plan_de_estudio=plan)
    materia_map = {} # nombre -> obj
    for m in all_materias:
        materia_map[m.nombre.lower().strip()] = m
        # Tambien mapeamos por partes si es necesario (fuzzy muy basico)
    
    # Helper para buscar materia
    def get_materia(name):
        name_clean = name.lower().strip()
        if name_clean in materia_map:
            return materia_map[name_clean]
        # Intento 'contains'
        for k, v in materia_map.items():
            if name_clean in k or k in name_clean:
                return v
        return None

    rules_processed = 0

    # 1. Procesar Reglas Especificas (RULES)
    for target_name, regs, aprobs_cursar, aprobs_rendir in RULES:
        target = get_materia(target_name)
        if not target:
            print(f"SKIP: Materia objetivo '{target_name}' no encontrada en BD.")
            continue
            
        # Helper para crear reglas
        def create_rules(req_names, tipo_correlatividad):
            count = 0
            for req_name in req_names:
                req = get_materia(req_name)
                if not req:
                    print(f"  WARN: Requisito '{req_name}' no encontrado para '{target.nombre}'")
                    continue
                
                corr, _ = Correlatividad.objects.get_or_create(
                    materia_origen=target,
                    materia_correlativa=req,
                    tipo=tipo_correlatividad
                )
                CorrelatividadVersionDetalle.objects.get_or_create(
                    version=version,
                    correlatividad=corr
                )
                count += 1
            return count

        rules_processed += create_rules(regs, Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR)
        rules_processed += create_rules(aprobs_cursar, Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR)
        rules_processed += create_rules(aprobs_rendir, Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR)

    # 2. Procesar Reglas Masivas (Residencias)
    # Requisito: Aprobadas todas las de 1, 2 y 3.
    materias_1_2_3 = all_materias.filter(anio_cursada__in=[1, 2, 3])
    print(f"Se encontraron {materias_1_2_3.count()} materias de 1°, 2° y 3° año para requisitos de Residencia.")

    for target_name in RESIDENCIA_TARGETS:
        target = get_materia(target_name)
        if not target:
            print(f"SKIP: Residencia '{target_name}' no encontrada.")
            continue
        
        for req in materias_1_2_3:
            # Evitar autoreferencia si la hubiera (raro)
            if req.id == target.id: continue
            
            corr, _ = Correlatividad.objects.get_or_create(
                materia_origen=target,
                materia_correlativa=req,
                tipo=Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR
            )
            CorrelatividadVersionDetalle.objects.get_or_create(
                version=version,
                correlatividad=corr
            )
            rules_processed += 1

    print(f"Importacion finalizada. Total reglas: {rules_processed}")

if __name__ == "__main__":
    run()
