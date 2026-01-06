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

from core.models import Estudiante, Profesorado, EstudianteCarrera
from django.contrib.auth.models import User, Group
from django.db import transaction

def parse_fecha(fecha_str):
    if not fecha_str or fecha_str.strip() == "":
        return None
    # Limpiar posibles comillas o espacios
    fecha_str = fecha_str.strip().strip('"')
    try:
        # Intenta formato YYYY-MM-DD
        return datetime.strptime(fecha_str, "%Y-%m-%d").date()
    except ValueError:
        try:
           # Intenta DD/MM/YYYY
           return datetime.strptime(fecha_str, "%d/%m/%Y").date()
        except:
           return None

def cargar_alumnos(archivo_csv):
    print(f"📂 Archivo: {archivo_csv}")
    
    stats = {
        "procesados": 0,
        "creados": 0,
        "actualizados": 0,
        "carreras_vinculadas": 0,
        "errores": 0
    }

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
            print(f"📋 Headers detectados: {headers}")

            def find_col(possible_names):
                for h in headers:
                    if any(p.lower() in h.lower() for p in possible_names):
                        return h
                return None

            col_dni = find_col(["DNI"])
            col_apellido = find_col(["Apellidos", "Apellido"])
            col_nombre = find_col(["Nombres", "Nombre"])
            col_cuil = find_col(["CUIL"])
            col_email = find_col(["Email", "Correo"])
            col_tel = find_col(["Teléfono", "Movil", "Celular"])
            col_domicilio = find_col(["Domicilio"])
            col_fecha = find_col(["Fecha Nacimiento"])
            col_carrera = find_col(["Carrera"])
            col_anio = find_col(["Año Lectivo"])

            if not col_dni:
                print("❌ No se encontró columna DNI. Abortando.")
                return

            # Preparar grupo
            grupo_estudiantes, _ = Group.objects.get_or_create(name='Estudiantes')

            for i, row in enumerate(reader, start=2):
                stats["procesados"] += 1
                try:
                    dni = row.get(col_dni, "").strip()
                    if not dni:
                        stats["errores"] += 1
                        continue

                    cuil = row.get(col_cuil, "").strip() if col_cuil else ""
                    apellido = row.get(col_apellido, "").strip() if col_apellido else ""
                    nombres = row.get(col_nombre, "").strip() if col_nombre else ""
                    email = row.get(col_email, "").strip() if col_email else None
                    telefono = row.get(col_tel, "").strip() if col_tel else ""
                    # TRUNCAR TELÉFONO para evitar error de longitud
                    telefono = telefono[:20]
                    
                    domicilio = row.get(col_domicilio, "").strip() if col_domicilio else ""
                    fecha_str = row.get(col_fecha, "").strip() if col_fecha else ""
                    fecha_nac = parse_fecha(fecha_str)
                    
                    carrera_nombre = row.get(col_carrera, "").strip() if col_carrera else None
                    anio_str = row.get(col_anio, "").strip() if col_anio else None
                    anio_ingreso = int(anio_str) if anio_str and anio_str.isdigit() else datetime.now().year

                    with transaction.atomic():
                        # 1. Crear/Actualizar User
                        user, user_created = User.objects.get_or_create(
                            username=dni,
                            defaults={
                                "email": email or f"{dni}@sinemail.local",
                                "first_name": nombres[:30],
                                "last_name": apellido[:30],
                                "is_active": True
                            }
                        )
                        if user_created:
                            user.set_password(dni)
                            user.save()
                            user.groups.add(grupo_estudiantes)
                        else:
                            # Actualizar si ya existe (opcional, pero ayuda a corregir datos)
                            if email: user.email = email
                            user.first_name = nombres[:30]
                            user.last_name = apellido[:30]
                            user.save()

                        # 2. Crear/Actualizar Estudiante
                        estudiante, est_created = Estudiante.objects.update_or_create(
                            user=user,
                            defaults={
                                "dni": dni,
                                "telefono": telefono,
                                "domicilio": domicilio,
                                "fecha_nacimiento": fecha_nac,
                                "datos_extra": {"cuil": cuil} if cuil else {}
                            }
                        )
                        
                        if est_created:
                            stats["creados"] += 1
                            if stats["creados"] % 500 == 0:
                                print(f"➕ Procesados {stats['creados']} acumulados...")
                        else:
                            stats["actualizados"] += 1
                        
                        # 3. Vincular a Carrera
                        if carrera_nombre:
                            profesorado, prof_created = Profesorado.objects.get_or_create(
                                nombre=carrera_nombre,
                                defaults={
                                    "duracion_anios": 4, # Default
                                    "activo": True
                                }
                            )
                            # Vincular
                            EstudianteCarrera.objects.get_or_create(
                                estudiante=estudiante,
                                profesorado=profesorado,
                                defaults={
                                    "anio_ingreso": anio_ingreso
                                }
                            )
                            stats["carreras_vinculadas"] += 1

                except Exception as e:
                    if stats["errores"] < 10:
                        print(f"❌ Error en fila {i} (DNI {row.get(col_dni)}): {e}")
                    stats["errores"] += 1

    except Exception as e:
        print(f"❌ Error crítico: {e}")

    print("-" * 50)
    print(f"📊 Resumen: Proc: {stats['procesados']} | Creados/Nuevos: {stats['creados']} | Actualizados/Existentes: {stats['actualizados']} | Carreras: {stats['carreras_vinculadas']} | Err: {stats['errores']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python carga_alumnos.py <archivo.csv>")
        sys.exit(1)
    cargar_alumnos(sys.argv[1])
