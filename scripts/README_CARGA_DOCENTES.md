# 📚 Carga Masiva de Docentes - IPES6

## 📋 Descripción

Script para importar docentes desde un archivo CSV a la base de datos de IPES6.

## 📁 Formato del CSV

El archivo CSV debe tener las siguientes columnas:

| Columna          | Requerido | Descripción                          | Ejemplo                        |
|------------------|-----------|--------------------------------------|--------------------------------|
| nombre           | ✅ Sí     | Nombre del docente                   | María                          |
| apellido         | ✅ Sí     | Apellido del docente                 | González                       |
| dni              | ✅ Sí     | DNI sin puntos                       | 12345678                       |
| cuil             | ❌ No     | CUIL (con o sin guiones)             | 27-12345678-4 o 27123456784    |
| email            | ❌ No     | Email del docente                    | maria.gonzalez@ipes6.edu.ar    |
| telefono         |❌ No     | Teléfono con cod. área               | 3814123456                     |
| fecha_nacimiento | ❌ No     | Fecha de nacimiento (DD/MM/YYYY)     | 15/03/1985                     |

### ✅ Ejemplo de CSV válido:

```csv
nombre,apellido,dni,cuil,email,telefono,fecha_nacimiento
María,González,12345678,27-12345678-4,maria.gonzalez@ipes6.edu.ar,3814123456,15/03/1985
Juan,Rodríguez,23456789,20-23456789-1,juan.rodriguez@ipes6.edu.ar,3814234567,22/07/1980
Ana,Fernández,34567890,27-34567890-2,ana.fernandez@ipes6.edu.ar,3814345678,10/11/1990
```

### 🔑 Creación Automática de Usuarios

**IMPORTANTE**: El script crea automáticamente un usuario del sistema para cada docente nuevo:
- **Username**: DNI del docente
- **Contraseña**: Generada aleatoriamente (12 caracteres seguros)
- **Grupo**: Se agrega al grupo "docente" automáticamente
- **Nota**: Las contraseñas se muestran en la salida del script. Guárdalas para entregarlas a los docentes.

## 🚀 Uso

### 1. Preparar el archivo CSV

Puedes usar la plantilla de ejemplo:
```bash
cp scripts/ejemplo_docentes.csv mi_carga_docentes.csv
# Editar el archivo con tus datos reales
```

### 2. Ejecutar la carga

**Modo: Solo crear nuevos** (recomendado para primera carga)
```bash
cd /home/admin486321/IPES6
docker exec -it backend-backend-1 python scripts/carga_docentes.py scripts/mi_carga_docentes.csv
```

**Modo: Crear y actualizar existentes**
```bash
docker exec -it backend-backend-1 python scripts/carga_docentes.py scripts/mi_carga_docentes.csv actualizar
```

## 📊 Salida del Script

El script mostrará:
- ✅ Docentes creados exitosamente
- ✏️  Docentes actualizados
- ⏭️  Docentes omitidos (ya existen)
- ❌ Errores encontrados

### Ejemplo:

```
📚 Iniciando carga de docentes desde: docentes.csv
Modo: crear
------------------------------------------------------------
✅ CSV válido. Columnas: nombre, apellido, dni, cuil, email, telefono

  ➕ Creado: González, María (DNI: 12345678)
  ➕ Creado: Rodríguez, Juan (DNI: 23456789)
  ⏭️  Omitido (ya existe): Fernández, Ana (DNI: 34567890)

============================================================
📊 RESUMEN
============================================================
Total de filas procesadas: 3
✅ Docentes creados:       2
✏️  Docentes actualizados:   0
⏭️  Omitidos (ya existen):  1
❌ Errores:                0
============================================================
```

## ⚠️ Consideraciones

### Validaciones automáticas:
- ✅ Elimina puntos del DNI automáticamente
- ✅ Elimina guiones del CUIL automáticamente
- ✅ Convierte nombres a formato Título (Primera Letra Mayúscula)
- ✅ Valida que existan los campos obligatorios
- ✅ Usa transacción de base de datos (rollback en caso de error)

### DNI duplicado:
- Si un docente con el mismo DNI ya existe:
  - **Modo "crear"**: Se omite el docente
  - **Modo "actualizar"**: Se actualizan sus datos

### CUIL opcional pero recomendado:
- El CUIL es opcional, pero si se provee debe ser único
- El script acepta CUIL con o sin guiones

## 🔍 Verificación Post-Carga

Para verificar que los docentes se cargaron correctamente:

```bash
docker exec backend-db-1 mysql -u ipes_user -p'oFAcwv7A1qFb/wa/CVdZ2FurXJUWEJIa' ipes6 -e "SELECT COUNT(*) as total_docentes FROM core_docente;"
```

Ver último docentes cargados:
```bash
docker exec backend-db-1 mysql -u ipes_user -p'oFAcwv7A1qFb/wa/CVdZ2FurXJUWEJIa' ipes6 -e "SELECT id, nombre, apellido, dni, email FROM core_docente ORDER BY id DESC LIMIT 10;"
```

## 🛠️ Solución de Problemas

### Error: "No se encontró el archivo"
- Verifica que la ruta sea correcta
- Si el CSV está en tu computadora local, debes copiarlo al contenedor primero:
  ```bash
  docker cp mi_archivo.csv backend-backend-1:/app/scripts/
  ```

### Error: "Falta la columna 'nombre' en el CSV"
- Verifica que el CSV tenga los encabezados correctos
- Revisa que no haya espacios extra en los nombres de las columnas

### Error: "usuario@example.com" ya existe
- El email debe ser único. Verifica que no haya duplicados en tu CSV

## 📝 Notas Adicionales

- El script **NO** crea usuarios del sistema automáticamente
- Los docentes podrán vincularse a usuarios existentes mediante el DNI
- Para crear usuarios para docentes, usar el panel de administración de Django

## 🤝 Creado por

Script desarrollado para facilitar la gestión de IPES6.
