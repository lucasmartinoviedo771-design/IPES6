
import os
import django
import sys
import re

# Configurar Django
sys.path.append('/app')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Docente, Estudiante
from django.contrib.auth.models import User

def standardize_text(text):
    if not text:
        return ""
    return text.strip().title()

def standardize_uppercase(text):
    if not text:
        return ""
    return text.strip().upper()

def run_standardization():
    print("--- Estandarizando Nombres y Apellidos ---")
    
    # 1. Docentes
    print("Procesando Docentes...")
    docentes = Docente.objects.all()
    count_doc = 0
    for doc in docentes:
        old_nombre = doc.nombre
        old_apellido = doc.apellido
        
        new_nombre = standardize_text(old_nombre)
        new_apellido = standardize_uppercase(old_apellido)
        
        if new_nombre != old_nombre or new_apellido != old_apellido:
            doc.nombre = new_nombre
            doc.apellido = new_apellido
            doc.save()
            count_doc += 1
            # print(f"Docente actualizado: {old_apellido}, {old_nombre} -> {new_apellido}, {new_nombre}")
    
    print(f"Total docentes actualizados: {count_doc}")

    # 2. Estudiantes (Usuarios)
    print("Procesando Estudiantes (Usuarios)...")
    # Filtramos usuarios que tienen perfil de estudiante o son staff/docentes (si usan User)
    # Mejor iteramos todos los Users para que quede consistente en todo el sistema
    users = User.objects.all()
    count_user = 0
    for user in users:
        old_first = user.first_name
        old_last = user.last_name
        
        new_first = standardize_text(old_first)
        new_last = standardize_uppercase(old_last)
        
        if new_first != old_first or new_last != old_last:
            user.first_name = new_first
            user.last_name = new_last
            user.save()
            count_user += 1
            # print(f"Usuario actualizado: {old_last}, {old_first} -> {new_last}, {new_first}")

    print(f"Total usuarios actualizados: {count_user}")
    print("--- Estandarización Completa ---\n")

def check_docentes_list(filepath):
    print("--- Verificando Lista de Docentes ---")
    
    if not os.path.exists(filepath):
        print(f"Archivo no encontrado: {filepath}")
        return

    missing_docentes = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
                
            # Parse line: "Apellido, Nombre \t DNI"
            # Split by tab first if exists, otherwise try regex
            dni = ""
            full_name = ""
            
            # Intentar separar por TAB o Múltiples espacios seguidos de un número al final
            match = re.search(r'^(.*?)\s+(\d+)$', line)
            if match:
                full_name = match.group(1).strip()
                dni = match.group(2).strip()
            else:
                # Fallback clean tabs
                parts = re.split(r'\t+', line)
                if len(parts) >= 2:
                    full_name = parts[0].strip()
                    dni = parts[-1].strip()
            
            if not dni:
                print(f"[WARN] No se pudo parsear linea: {line}")
                continue

            # Check logic
            exists = Docente.objects.filter(dni=dni).exists()
            if not exists:
                missing_docentes.append({'dni': dni, 'nombre_completo': full_name})
            else:
                 # Actualizar formateo si ya existe (para asegurar el formato en la DB)
                 # Lo handlea run_standardization pero aqui podemos asegurar si el nombre difiere mucho
                 pass

    if missing_docentes:
        print(f"Se encontraron {len(missing_docentes)} docentes FALTANTES en la base de datos:")
        for missing in missing_docentes:
             print(f" - DNI: {missing['dni']} | Nombre: {missing['nombre_completo']}")
             
             # Opcional: Auto-crear si el usuario lo deseara (por ahora solo reportar como pidio "verificar")
             # Separar Apellido y Nombre
             parts = missing['nombre_completo'].split(',')
             if len(parts) >= 2:
                 apellido = parts[0].strip()
                 nombre = " ".join(parts[1:]).strip()
             else:
                 # Fallback
                 apellido = missing['nombre_completo']
                 nombre = "."
                 
             # Estandarizar antes de crear (simulado)
             apellido = standardize_uppercase(apellido)
             nombre = standardize_text(nombre)
             
             # Crear
             try:
                 Docente.objects.create(dni=missing['dni'], apellido=apellido, nombre=nombre)
                 print(f"   -> CREADO AUTOMATICAMENTE: {apellido}, {nombre}")
             except Exception as e:
                 print(f"   -> ERROR AL CREAR: {e}")

    else:
        print("Todos los docentes de la lista YA existen en la base de datos.")

if __name__ == "__main__":
    # 1. Check lista y crear faltantes
    check_docentes_list('/app/docentes_check_list.txt')
    
    # 2. Estandarizar todo (incluyendo los recien creados)
    run_standardization()
