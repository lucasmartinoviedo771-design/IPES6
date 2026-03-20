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

def limpiar_cuil(cuil):
    """Elimina guiones del CUIL"""
    if not cuil:
        return None
    return cuil.replace("-", "").replace(" ", "").strip()

def generar_contraseña_segura(longitud=12):
    """Genera una contraseña temporal segura"""
    caracteres = string.ascii_letters + string.digits + "!@#$%&"
    return ''.join(secrets.choice(caracteres) for _ in range(longitud))

def cargar_docentes(archivo_csv, modo="crear"):
    print(f"📂 Archivo: {archivo_csv}")
    print(f"🔧 Modo: {modo}")
    
    stats = {
        "total": 0,
        "creados": 0,
        "actualizados": 0,
        "omitidos": 0,
        "errores": 0
    }
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8-sig') as f:
            # Detectar formato automáticamente
            content = f.read(2048)
            f.seek(0)
            try:
                dialect = csv.Sniffer().sniff(content)
            except csv.Error:
                dialect = 'excel' # Fallback
            
            reader = csv.DictReader(f, dialect=dialect)
            
            # Mapeo flexible de columnas
            mapa_columnas = {
                'documento': 'dni', 'dni': 'dni',
                'apellidos': 'apellido', 'apellido': 'apellido',
                'nombres': 'nombre', 'nombre': 'nombre',
                'email': 'email', 'correo': 'email', 'mail': 'email',
                'telefono': 'telefono', 'tel': 'telefono', 'celular': 'telefono',
                'cuil': 'cuil'
            }
            
            headers_orig = [h.strip() for h in reader.fieldnames] if reader.fieldnames else []
            headers_norm = [h.lower() for h in headers_orig]
            
            print(f"📋 Columnas detectadas: {', '.join(headers_orig)}")
            
            # Verificar columna clave
            col_dni = next((h for h in headers_orig if h.lower() in ['documento', 'dni']), None)
            
            if not col_dni:
                 print("❌ Error: No se encontró columna 'Documento' o 'DNI'")
                 return stats

            print("✅ Estructura validada. Procesando...")
            print("-" * 50)

            with transaction.atomic():
                for i, fila in enumerate(reader, start=2):
                    stats["total"] += 1
                    
                    # Normalizar datos usando el mapa
                    datos_norm = {}
                    for k, v in fila.items():
                        if k and k.strip().lower() in mapa_columnas:
                             clave_int = mapa_columnas[k.strip().lower()]
                             datos_norm[clave_int] = v.strip() if v else ""

                    dni = datos_norm.get('dni')
                    
                    if not dni:
                        print(f"⚠️  Fila {i}: Sin DNI. Saltando.")
                        stats["errores"] += 1
                        continue

                    # Datos para el modelo
                    datos_modelo = {
                        'nombre': datos_norm.get('nombre', ''),
                        'apellido': datos_norm.get('apellido', ''),
                        'email': datos_norm.get('email', None), # Opcional
                        'telefono': datos_norm.get('telefono', None), # Opcional
                        'cuil': limpiar_cuil(datos_norm.get('cuil', None)) # Opcional
                    }

                    # Buscar existencia
                    docente = Docente.objects.filter(dni=dni).first()
                    
                    if docente:
                        if modo == "actualizar":
                            for k, v in datos_modelo.items():
                                if v: setattr(docente, k, v)
                            docente.save()
                            stats["actualizados"] += 1
                            print(f"✏️  Actualizado: {dni} - {datos_modelo['apellido']}, {datos_modelo['nombre']}")
                        else:
                            stats["omitidos"] += 1
                    else:
                        # Crear Docente
                        docente = Docente.objects.create(dni=dni, **datos_modelo)
                        stats["creados"] += 1
                        
                        # Crear Usuario asociado
                        if not User.objects.filter(username=dni).exists():
                            pwd = generar_contraseña_segura()
                            user = User.objects.create_user(
                                username=dni,
                                password=pwd,
                                first_name=datos_modelo['nombre'][:30],
                                last_name=datos_modelo['apellido'][:30],
                                email=datos_modelo['email'] or ""
                            )
                            # Asignar grupo Docentes si existe
                            grupo_docentes = Group.objects.filter(name='Docentes').first()
                            if grupo_docentes:
                                user.groups.add(grupo_docentes)
                            
                            print(f"➕ DNI {dni}: Creado (Usuario generado)")
                        else:
                            print(f"➕ DNI {dni}: Docente creado (Usuario ya existía)")

    except Exception as e:
        print(f"❌ Error crítico: {e}")
        import traceback
        traceback.print_exc()

    print("-" * 50)
    print(f"📊 Resumen:")
    print(f"   Total filas: {stats['total']}")
    print(f"   Creados:     {stats['creados']}")
    print(f"   Actualizados:{stats['actualizados']}")
    print(f"   Omitidos:    {stats['omitidos']}")
    print(f"   Errores:     {stats['errores']}")
    
    return stats

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/carga_docentes.py <archivo_csv> [modo]")
        sys.exit(1)
    
    archivo = sys.argv[1]
    modo = sys.argv[2] if len(sys.argv) > 2 else "crear"
    cargar_docentes(archivo, modo)
