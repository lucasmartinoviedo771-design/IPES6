import csv
import sys
import os
from pathlib import Path

# Agregar el backend al path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from core.models import Profesorado, PlanDeEstudio, Materia

def cargar_plan(archivo_csv):
    print(f"📂 Archivo: {archivo_csv}")
    
    # 1. Crear/Buscar Profesorado
    profesorado, created = Profesorado.objects.get_or_create(
        nombre="Profesorado de Educación Primaria",
        defaults={
            "duracion_anios": 4,
            "activo": True,
            "inscripcion_abierta": True,
            "es_certificacion_docente": False
        }
    )
    if created: print(f"✅ Profesorado creado: {profesorado}")
    else: print(f"ℹ️  Profesorado existente: {profesorado}")

    # 2. Crear/Buscar Plan de Estudios
    plan, created = PlanDeEstudio.objects.get_or_create(
        resolucion="Resolución M.E. No 1935/14",
        profesorado=profesorado,
        defaults={
            "anio_inicio": 2014, # Aproximado por la resol
            "vigente": True
        }
    )
    if created: print(f"✅ Plan creado: {plan}")
    else: print(f"ℹ️  Plan existente: {plan}")

    # 3. Mapeos
    mapa_anios = {
        "1°": 1, "2°": 2, "3°": 3, "4°": 4,
        "1": 1, "2": 2, "3": 3, "4": 4
    }
    
    mapa_formatos = {
       "Asignatura": "ASI",
       "Práctica": "PRA",
       "Módulo": "MOD",
       "Taller": "TAL",
       "Laboratorio": "LAB",
       "Seminario": "SEM"
    }

    mapa_cuatrimestres = {
        "Anual": "ANU",
        "1° Cuat.": "PCU",
        "2° Cuat.": "SCU",
        "1 Cuat": "PCU",
        "2 Cuat": "SCU"
    }

    stats = {"creadas": 0, "actualizadas": 0, "errores": 0}

    try:
        with open(archivo_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f, delimiter=';')
            headers = reader.fieldnames
            print(f"📋 Columnas: {headers}")

            for i, fila in enumerate(reader, start=2):
                try:
                    # Parsear datos
                    anio_str = fila.get("Año", "").strip()
                    nombre = fila.get("Espacio Curricular", "").strip()
                    horas_str = fila.get("Horas", "0").strip()
                    cuatrimestre_str = fila.get("Cuatrimestre", "").strip()
                    formato_str = fila.get("Formato", "").strip()
                    
                    if not nombre: continue

                    anio = mapa_anios.get(anio_str, 1)
                    horas = int(horas_str) if horas_str.isdigit() else 0
                    
                    # Mapping con valores default si no coinciden
                    formato_code = mapa_formatos.get(formato_str, "ASI") # Default Asignatura
                    regimen_code = mapa_cuatrimestres.get(cuatrimestre_str, "ANU") # Default Anual

                    # Crear/Actualizar Materia
                    materia, created = Materia.objects.update_or_create(
                        plan_de_estudio=plan,
                        nombre=nombre,
                        defaults={
                            "anio_cursada": anio,
                            "horas_semana": horas,
                            "formato": formato_code,
                            "regimen": regimen_code,
                            "tipo_formacion": "FGN" # Default Formación General
                        }
                    )
                    
                    if created:
                        print(f"➕ Creada: {nombre} ({anio}° Año)")
                        stats["creadas"] += 1
                    else:
                        print(f"✏️  Actualizada: {nombre}")
                        stats["actualizadas"] += 1

                except Exception as e:
                    print(f"❌ Error en fila {i}: {e}")
                    stats["errores"] += 1

    except Exception as e:
        print(f"❌ Error crítico abriendo archivo: {e}")

    print("-" * 50)
    print(f"📊 Resumen: Creadas {stats['creadas']} | Actualizadas {stats['actualizadas']} | Errores {stats['errores']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python script.py <archivo.csv>")
        sys.exit(1)
    cargar_plan(sys.argv[1])
