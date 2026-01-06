import csv
import sys
import os
from pathlib import Path
from datetime import datetime
import io

# Agregar el backend al path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from core.models import Estudiante, Profesorado, Preinscripcion
from django.db import transaction

def parse_fecha(fecha_str):
    if not fecha_str or fecha_str.strip() == "":
        return None
    fecha_str = fecha_str.strip().strip('"')
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(fecha_str, fmt)
        except ValueError:
            continue
    return None

def cargar_alumnos_v2(archivo_csv):
    print(f"📂 Refinando Preinscripciones desde: {archivo_csv}")
    
    stats = {
        "procesados": 0,
        "actualizados": 0,
        "ignorados_antiguos": 0,
        "errores": 0
    }

    # Fecha límite: 1 de Octubre de 2025
    fecha_limite = datetime(2025, 10, 1)

    try:
        with open(archivo_csv, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            cleaned_lines = []
            for line in lines:
                l = line.strip()
                if l.startswith('"') and l.endswith('"'):
                    l = l[1:-1]
                    l = l.replace('""', '"')
                cleaned_lines.append(l)
            
            csv_file = io.StringIO('\n'.join(cleaned_lines))
            reader = csv.DictReader(csv_file)
            
            headers = [h.strip() for h in reader.fieldnames] if reader.fieldnames else []
            
            def find_col(possible_names):
                for h in headers:
                    if any(p.lower() in h.lower() for p in possible_names):
                        return h
                return None

            col_dni = find_col(["DNI"])
            col_carrera = find_col(["Carrera"])
            col_anio = find_col(["Año Lectivo"])
            col_fecha_insc = find_col(["Fecha Inscripción"])

            # Primero, marcar todas las preinscripciones como inactivas o borrarlas
            # para empezar de cero con la lógica de fecha (opcional, pero más limpio)
            # Preinscripcion.objects.all().delete() # CUIDADO: Solo si queremos resetear
            
            for i, row in enumerate(reader, start=2):
                stats["procesados"] += 1
                try:
                    dni = row.get(col_dni, "").strip()
                    carrera_nombre = row.get(col_carrera, "").strip()
                    anio_str = row.get(col_anio, "").strip()
                    fecha_insc_str = row.get(col_fecha_insc, "").strip()
                    
                    if not dni or not carrera_nombre:
                        continue

                    fecha_insc = parse_fecha(fecha_insc_str)
                    
                    # FILTRO POR FECHA
                    if fecha_insc and fecha_insc < fecha_limite:
                        stats["ignorados_antiguos"] += 1
                        continue

                    # Buscar modelos
                    estudiante = Estudiante.objects.filter(dni=dni).first()
                    profesorado = Profesorado.objects.filter(nombre=carrera_nombre).first()
                    
                    if not estudiante or not profesorado:
                        continue
                    
                    anio_pre = int(anio_str) if anio_str and anio_str.isdigit() else 2026

                    with transaction.atomic():
                        # Creamos o actualizamos
                        pre, created = Preinscripcion.objects.get_or_create(
                            alumno=estudiante,
                            carrera=profesorado,
                            anio=anio_pre,
                            defaults={
                                "estado": "PEN",
                                "codigo": f"PRE-{dni}-{anio_pre}",
                                "datos_extra": {"fecha_importacion": fecha_insc_str}
                            }
                        )
                        
                        # Guardamos la fecha original en datos_extra ya que el modelo no tiene el campo fecha
                        if not created:
                            pre.datos_extra["fecha_importacion"] = fecha_insc_str
                            pre.save()
                        
                        stats["actualizados"] += 1

                except Exception as e:
                    stats["errores"] += 1

    except Exception as e:
        print(f"❌ Error crítico: {e}")

    # Paso final: Eliminar las preinscripciones que NO están en la lista aceptada (opcional)
    # Para evitar que aparezcan los de 2020.
    
    print("-" * 50)
    print(f"�� Resumen de Refinamiento:")
    print(f"   Procesados: {stats['procesados']}")
    print(f"   Aceptados (>= Oct 2025): {stats['actualizados']}")
    print(f"   Ignorados (antiguos): {stats['ignorados_antiguos']}")
    print(f"   Errores: {stats['errores']}")

if __name__ == "__main__":
    cargar_alumnos_v2(sys.argv[1])
