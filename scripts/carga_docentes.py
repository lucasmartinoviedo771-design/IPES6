#!/usr/bin/env python3
"""
Script para carga masiva de docentes desde CSV

Uso:
    python scripts/carga_docentes.py <archivo_csv>
    
Formato del CSV:
    nombre,apellido,dni,cuil,email,telefono
    
Ejemplo:
    Juan,Pérez,12345678,20-12345678-9,juan.perez@example.com,3814123456
"""

import csv
import sys
import os
from pathlib import Path

# Agregar el backend al path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from core.models import Docente
from django.contrib.auth.models import User, Group
from django.db import transaction
import secrets
import string
from datetime import datetime


def limpiar_cuil(cuil):
    """Elimina guiones del CUIL"""
    if not cuil:
        return None
    return cuil.replace("-", "").replace(" ", "").strip()


def generar_contraseña_segura(longitud=12):
    """Genera una contraseña aleatoria segura"""
    caracteres = string.ascii_letters + string.digits + "!@#$%&"
    return ''.join(secrets.choice(caracteres) for _ in range(longitud))


def parsear_fecha(fecha_str):
    """
    Intenta parsear una fecha en varios formatos comunes
    Formatos soportados: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    """
    if not fecha_str or not fecha_str.strip():
        return None
    
    fecha_str = fecha_str.strip()
    formatos = [
        "%d/%m/%Y",  # 15/03/1990
        "%d-%m-%Y",  # 15-03-1990
        "%Y-%m-%d",  # 1990-03-15
        "%d/%m/%y",  # 15/03/90
        "%d-%m-%y",  # 15-03-90
    ]
    
    for formato in formatos:
        try:
            return datetime.strptime(fecha_str, formato).date()
        except ValueError:
            continue
    
    return None


def validar_fila(fila, numero_linea):
    """Valida que la fila tenga los campos requeridos"""
    errores = []
    
    if not fila.get("nombre", "").strip():
        errores.append(f"Línea {numero_linea}: Falta el nombre")
    
    if not fila.get("apellido", "").strip():
        errores.append(f"Línea {numero_linea}: Falta el apellido")
    
    if not fila.get("dni", "").strip():
        errores.append(f"Línea {numero_linea}: Falta el DNI")
    
    return errores


def cargar_docentes(archivo_csv, modo="crear"):
    """
    Carga docentes desde un archivo CSV
    
    Args:
        archivo_csv: Ruta al archivo CSV
        modo: 'crear' (solo crea nuevos) o 'actualizar' (crea y actualiza existentes)
    
    Returns:
        dict: Estadísticas de la carga
    """
    print(f"📚 Iniciando carga de docentes desde: {archivo_csv}")
    print(f"Modo: {modo}")
    print("-" * 60)
    
    stats = {
        "total": 0,
        "creados": 0,
        "actualizados": 0,
        "omitidos": 0,
        "errores": 0,
        "detalles_errores": []
    }
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8-sig') as f:
            # Detectar el delimitador
            primera_linea = f.readline()
            delimitador = ',' if ',' in primera_linea else ';'
            f.seek(0)  # Volver al inicio
            
            reader = csv.DictReader(f, delimiter=delimitador)
            
            # Verificar headers
            headers_requeridos = ['nombre', 'apellido', 'dni']
            headers_csv = [h.strip().lower() for h in reader.fieldnames]
            
            for req in headers_requeridos:
                if req not in headers_csv:
                    print(f"❌ Error: Falta la columna '{req}' en el CSV")
                    print(f"Columnas encontradas: {', '.join(reader.fieldnames)}")
                    return stats
            
            print(f"✅ CSV válido. Columnas: {', '.join(reader.fieldnames)}")
            print()
            
            with transaction.atomic():
                for i, fila in enumerate(reader, start=2):  # Empieza en 2 (header es 1)
                    stats["total"] += 1
                    
                    # Normalizar las claves a minúsculas
                    fila = {k.strip().lower(): v.strip() for k, v in fila.items()}
                    
                    # Validar
                    errores = validar_fila(fila, i)
                    if errores:
                        stats["errores"] += len(errores)
                        stats["detalles_errores"].extend(errores)
                        continue
                    
                    # Preparar datos
                    dni = fila["dni"].replace(".", "").strip()
                    cuil = limpiar_cuil(fila.get("cuil", ""))
                    fecha_nac = parsear_fecha(fila.get("fecha_nacimiento", ""))
                    
                    datos = {
                        "nombre": fila["nombre"].strip().title(),
                        "apellido": fila["apellido"].strip().title(),
                        "email": fila.get("email", "").strip() or None,
                        "telefono": fila.get("telefono", "").strip() or None,
                        "cuil": cuil if cuil else None,
                        "fecha_nacimiento": fecha_nac,
                    }
                    
                    # Verificar si existe
                    docente_existente = Docente.objects.filter(dni=dni).first()
                    usuario_creado = False
                    contraseña_generada = None
                    
                    if docente_existente:
                        if modo == "actualizar":
                            # Actualizar
                            for campo, valor in datos.items():
                                setattr(docente_existente, campo, valor)
                            docente_existente.save()
                            stats["actualizados"] += 1
                            print(f"  ✏️  Actualizado: {datos['apellido']}, {datos['nombre']} (DNI: {dni})")
                        else:
                            stats["omitidos"] += 1
                            print(f"  ⏭️  Omitido (ya existe): {datos['apellido']}, {datos['nombre']} (DNI: {dni})")
                    else:
                        # Crear nuevo docente
                        docente = Docente.objects.create(dni=dni, **datos)
                        stats["creados"] += 1
                        
                        # Crear usuario para el docente
                        usuario = User.objects.filter(username=dni).first()
                        if not usuario:
                            contraseña_generada = generar_contraseña_segura()
                            usuario = User.objects.create_user(
                                username=dni,
                                email=datos["email"] if datos["email"] else f"{dni}@temp.local",
                                password=contraseña_generada,
                                first_name=datos["nombre"],
                                last_name=datos["apellido"],
                            )
                            
                            # Agregar al grupo "docente" si existe
                            grupo_docente, _ = Group.objects.get_or_create(name="docente")
                            usuario.groups.add(grupo_docente)
                            usuario.save()
                            usuario_creado = True
                        
                        msg = f"  ➕ Creado: {datos['apellido']}, {datos['nombre']} (DNI: {dni})"
                        if usuario_creado and contraseña_generada:
                            msg += f" | 🔑 Usuario creado | Contraseña: {contraseña_generada}"
                        print(msg)
                
                print()
                print("=" * 60)
                print("📊 RESUMEN")
                print("=" * 60)
                print(f"Total de filas procesadas: {stats['total']}")
                print(f"✅ Docentes creados:       {stats['creados']}")
                print(f"✏️  Docentes actualizados:   {stats['actualizados']}")
                print(f"⏭️  Omitidos (ya existen):  {stats['omitidos']}")
                print(f"❌ Errores:                {stats['errores']}")
                
                if stats["detalles_errores"]:
                    print()
                    print("Detalles de errores:")
                    for error in stats["detalles_errores"]:
                        print(f"  - {error}")
                
                print("=" * 60)
                
        return stats
        
    except FileNotFoundError:
        print(f"❌ Error: No se encontró el archivo {archivo_csv}")
        stats["errores"] += 1
        return stats
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        stats["errores"] += 1
        import traceback
        traceback.print_exc()
        return stats


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/carga_docentes.py <archivo_csv> [modo]")
        print()
        print("Modos disponibles:")
        print("  crear      - Solo crea nuevos docentes (default)")
        print("  actualizar - Crea nuevos y actualiza existentes")
        print()
        print("Ejemplo:")
        print("  python scripts/carga_docentes.py docentes.csv")
        print("  python scripts/carga_docentes.py docentes.csv actualizar")
        sys.exit(1)
    
    archivo = sys.argv[1]
    modo = sys.argv[2] if len(sys.argv) > 2 else "crear"
    
    if modo not in ["crear", "actualizar"]:
        print(f"❌ Modo inválido: {modo}")
        print("Usa 'crear' o 'actualizar'")
        sys.exit(1)
    
    cargar_docentes(archivo, modo)
