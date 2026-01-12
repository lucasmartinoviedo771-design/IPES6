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

DATA = """
P101;Profesorado de Educación Primaria;1°;Pedagogía;3;Anual;Asignatura;Ninguna;Ninguna;Ninguna
P102;Profesorado de Educación Primaria;1°;Práctica I: Instituciones educativas y comunidad;3;Anual;Práctica;Ninguna;Ninguna;Ninguna
P103;Profesorado de Educación Primaria;1°;Matemática;5;Anual;Asignatura;Ninguna;Ninguna;Ninguna
P104;Profesorado de Educación Primaria;1°;Ciencias Naturales;4;Anual;Asignatura;Ninguna;Ninguna;Ninguna
P105;Profesorado de Educación Primaria;1°;Prácticas del Lenguaje;4;Anual;Asignatura;Ninguna;Ninguna;Ninguna
P106;Profesorado de Educación Primaria;1°;Historia Social Argentina y Latinoamericana;4;1° Cuat.;Asignatura;Ninguna;Ninguna;Ninguna
P107;Profesorado de Educación Primaria;1°;Alfabetización Académica;4;1° Cuat.;Taller;Ninguna;Ninguna;Ninguna
P108;Profesorado de Educación Primaria;1°;Cuerpo, juego y expresión;3;1° Cuat.;Taller;Ninguna;Ninguna;Ninguna
P109;Profesorado de Educación Primaria;1°;Psicología Educacional;4;2° Cuat.;Asignatura;Ninguna;Ninguna;Ninguna
P110;Profesorado de Educación Primaria;1°;Educación Sexual Integral;3;2° Cuat.;Taller;Ninguna;Ninguna;Ninguna
P201;Profesorado de Educación Primaria;2°;Práctica II: Enseñanza y curriculum;4;Anual;Práctica;P101, P109;P102;Ninguna
P202;Profesorado de Educación Primaria;2°;Didáctica General;4;Anual;Asignatura;P101;Ninguna;P101
P203;Profesorado de Educación Primaria;2°;Ciencias Sociales;4;Anual;Asignatura;Ninguna;Ninguna;Ninguna
P204;Profesorado de Educación Primaria;2°;Problemática de la educación primaria;4;Anual;Módulo;P101;Ninguna;P101
P205;Profesorado de Educación Primaria;2°;Didáctica de la matemática;4;Anual;Módulo;P101, P103;Ninguna;P101, P103
P206;Profesorado de Educación Primaria;2°;Didáctica de las ciencias naturales;4;Anual;Módulo;P101, P104;Ninguna;P101, P104
P207;Profesorado de Educación Primaria;2°;Sujeto de la Educación Primaria I;4;Anual;Módulo;P109;Ninguna;P109
P208;Profesorado de Educación Primaria;2°;Curriculum;4;1° Cuat.;Módulo;P101;Ninguna;P101
P209;Profesorado de Educación Primaria;2°;Historia y política educacional;4;2° Cuat.;Asignatura;P106;Ninguna;P106
P301;Profesorado de Educación Primaria;3°;Práctica III: Práctica de la enseñanza;6;Anual;Práctica;P208, P202, P204, P205, P206, P203;P101, P109, P105, P201;Ninguna
P302;Profesorado de Educación Primaria;3°;Lenguajes artísticos;3;Anual;Taller;Ninguna;Ninguna;Ninguna
P303;Profesorado de Educación Primaria;3°;Alfabetización Inicial;4;Anual;Módulo;P109, P207;P105;P109, P207, P105
P304;Profesorado de Educación Primaria;3°;Didáctica de las Ciencias Sociales;4;Anual;Módulo;P202, P203;P101;P202, P203, P101
P305;Profesorado de Educación Primaria;3°;Didáctica de las prácticas del lenguaje;4;Anual;Módulo;P202;P105, P101;P105, P101, P202
P306;Profesorado de Educación Primaria;3°;Filosofía de la Educación;4;1° Cuat.;Asignatura;Ninguna;P101;P101
P307;Profesorado de Educación Primaria;3°;Formación Ética y Ciudadana;4;1° Cuat.;Módulo;Ninguna;Ninguna;Ninguna
P308;Profesorado de Educación Primaria;3°;Sujeto de la Educación Primaria II;4;1° Cuat.;Módulo;P207;Ninguna;P207
P309;Profesorado de Educación Primaria;3°;Sociología de la Educación;4;2° Cuat.;Asignatura;P209;P106;P106, P209
P310;Profesorado de Educación Primaria;3°;Educación Física;3;2° Cuat.;Taller;Ninguna;P108;Ninguna
P401;Profesorado de Educación Primaria;4°;Práctica IV: Residencia pedagógica;10;Anual;Práctica;Ninguna;P101, P102, P103, P104, P105, P106, P107, P108, P109, P110, P201, P202, P203, P204, P205, P206, P207, P208, P209, P301, P302, P303, P304, P305, P306, P307, P308, P309, P310;Ninguna
P402;Profesorado de Educación Primaria;4°;Investigación Educativa;3;Anual;Taller;Ninguna;P107, P301;Ninguna
P403;Profesorado de Educación Primaria;4°;Taller de Residencia de Matemática;4;Anual;Taller;Ninguna;P101, P102, P103, P104, P105, P106, P107, P108, P109, P110, P201, P202, P203, P204, P205, P206, P207, P208, P209, P301, P302, P303, P304, P305, P306, P307, P308, P309, P310;Ninguna
P404;Profesorado de Educación Primaria;4°;Taller de Residencia de Prácticas del Lenguaje;4;Anual;Taller;Ninguna;P101, P102, P103, P104, P105, P106, P107, P108, P109, P110, P201, P202, P203, P204, P205, P206, P207, P208, P209, P301, P302, P303, P304, P305, P306, P307, P308, P309, P310;Ninguna
P405;Profesorado de Educación Primaria;4°;Taller de Residencia de Ciencias Naturales;4;Anual;Taller;Ninguna;P101, P102, P103, P104, P105, P106, P107, P108, P109, P110, P201, P202, P203, P204, P205, P206, P207, P208, P209, P301, P302, P303, P304, P305, P306, P307, P308, P309, P310;Ninguna
P406;Profesorado de Educación Primaria;4°;Taller de Residencia de Ciencias Sociales;4;Anual;Taller;Ninguna;P101, P102, P103, P104, P105, P106, P107, P108, P109, P110, P201, P202, P203, P204, P205, P206, P207, P208, P209, P301, P302, P303, P304, P305, P306, P307, P308, P309, P310;Ninguna
"""

def normalize_text(text):
    return text.strip()

def map_regimen(text):
    text = text.lower().strip()
    if "anual" in text: return Materia.TipoCursada.ANUAL
    if "1" in text and "cuat" in text: return Materia.TipoCursada.PRIMER_CUATRIMESTRE
    if "2" in text and "cuat" in text: return Materia.TipoCursada.SEGUNDO_CUATRIMESTRE
    return Materia.TipoCursada.ANUAL

def map_formato(text):
    text = text.lower().strip()
    if "asignatura" in text: return Materia.FormatoMateria.ASIGNATURA
    if "taller" in text: return Materia.FormatoMateria.TALLER
    if "práctica" in text or "practica" in text: return Materia.FormatoMateria.PRACTICA
    if "módulo" in text or "modulo" in text: return Materia.FormatoMateria.MODULO
    return Materia.FormatoMateria.ASIGNATURA

@transaction.atomic
def run():
    print("Iniciando importacion...")
    prof_nombre = "Profesorado de Educación Primaria"
    profesorado = Profesorado.objects.filter(nombre__icontains=prof_nombre).first()
    
    if not profesorado:
        print(f"Error: No se encontro profesorado '{prof_nombre}'")
        return

    print(f"Profesorado encontrado: {profesorado.nombre}")
    
    plan = PlanDeEstudio.objects.filter(profesorado=profesorado, vigente=True).first()
    if not plan:
        # Fallback to any plan
        plan = PlanDeEstudio.objects.filter(profesorado=profesorado).order_by('-anio_inicio').first()
        
    if not plan:
        print("Error: No se encontro plan de estudio")
        return
        
    print(f"Plan encontrado: {plan.resolucion} (Inicio: {plan.anio_inicio})")

    # Crear Version de Correlatividades
    version, created = CorrelatividadVersion.objects.get_or_create(
        plan_de_estudio=plan,
        profesorado=profesorado,
        nombre="Cohorte 2023+",
        defaults={
            "cohorte_desde": 2023,
            "activo": True
        }
    )
    if created:
        print("Creada nueva version de correlatividades: Cohorte 2023+")
    else:
        print("Usando version existente: Cohorte 2023+")

    # Limpiar detalles anteriores para esta version si se quiere sobreescribir (Opcional, aqui lo haremos para asegurar limpieza)
    # CorrelatividadVersionDetalle.objects.filter(version=version).delete() 

    code_to_materia = {}
    
    # Pass 1: Identificar Materias y Actualizar Metadata
    lines = [l for l in DATA.split('\n') if l.strip()]
    
    for line in lines:
        parts = line.split(';')
        if len(parts) < 10: continue
        
        code = parts[0].strip()
        nombre = parts[3].strip()
        horas = int(parts[4].strip())
        regimen_str = parts[5].strip()
        formato_str = parts[6].strip()
        
        # Buscar materia
        materia = Materia.objects.filter(plan_de_estudio=plan, nombre__iexact=nombre).first()
        
        # Intento fuzzy simple si falla exacto (por acentos o mayusculas)
        if not materia:
             materia = Materia.objects.filter(plan_de_estudio=plan, nombre__icontains=nombre).first()

        if not materia:
            print(f"ALERTA: No se encontro materia '{nombre}' en la BD. Se salta.")
            continue
            
        # Actualizar datos
        materia.horas_semana = horas
        materia.regimen = map_regimen(regimen_str)
        materia.formato = map_formato(formato_str)
        materia.save()
        
        code_to_materia[code] = materia
    
    print(f"Se identificaron {len(code_to_materia)} materias.")

    # Pass 2: Cargar Correlatividades
    count_created = 0
    
    for line in lines:
        parts = line.split(';')
        if len(parts) < 10: continue
        
        target_code = parts[0].strip()
        if target_code not in code_to_materia: continue
        
        materia_origen = code_to_materia[target_code]
        
        # Parse rules
        # Col 7: Regular para Cursar
        # Col 8: Aprobar para Cursar
        # Col 9: Aprobar para Rendir
        
        rules = [
            (parts[7], Correlatividad.TipoCorrelatividad.REGULAR_PARA_CURSAR),
            (parts[8], Correlatividad.TipoCorrelatividad.APROBADA_PARA_CURSAR),
            (parts[9], Correlatividad.TipoCorrelatividad.APROBADA_PARA_RENDIR),
        ]
        
        for req_codes_str, tipo in rules:
            if "Ninguna" in req_codes_str: continue
            
            req_codes = [c.strip() for c in req_codes_str.split(',')]
            for req_code in req_codes:
                if req_code not in code_to_materia:
                    print(f"ALERTA: Codigo requerido '{req_code}' no encontrado para '{materia_origen.nombre}'")
                    continue
                
                materia_req = code_to_materia[req_code]
                
                # Crear Correlatividad (Regla base)
                correlatividad, _ = Correlatividad.objects.get_or_create(
                    materia_origen=materia_origen,
                    materia_correlativa=materia_req,
                    tipo=tipo
                )
                
                # Vincular a la Version
                CorrelatividadVersionDetalle.objects.get_or_create(
                    version=version,
                    correlatividad=correlatividad
                )
                count_created += 1

    print(f"Proceso finalizado. {count_created} reglas de correlatividad procesadas.")

if __name__ == "__main__":
    run()
