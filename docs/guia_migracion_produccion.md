# Guía de Migración y Despliegue en Producción (IPES6 - Ciclo 2026)

Esta guía detalla los pasos necesarios para replicar los cambios de código y la corrección de datos en el entorno de **Producción** de IPES6.

---

## 🛠️ Resumen de Archivos y Cambios de Código Fijos

Al subir este código a producción (a través de `git pull`), estarás aplicando las siguientes mejoras de estabilidad y funcionalidad:

1. **`backend/apps/calendario/api.py`**
   * **Endpoint `/horarios/ocupacion`:** Corregido el bug de filtrado. Ahora recibe el año académico correcto (`anio_academico`) y filtra las materias ocupadas usando `espacio__anio_cursada` (año de carrera de la materia) en lugar de filtrar incorrectamente la columna `anio_academico` con el año de la carrera.

2. **`backend/apps/estudiantes/api/horarios_api.py`**
   * **Endpoint `/api/horarios` (Vista de Alumnos):** Se agregó filtrado estricto por el año académico activo (año calendario actual). Incluye una caída de seguridad (fallback) al año máximo disponible si el año actual no tiene horarios cargados aún. Esto elimina de raíz la **duplicidad de tarjetas** en la grilla de horarios generales.

3. **`frontend/src/pages/Secretaria/CargarHorarioPage.tsx`**
   * **Payload de guardado:** Se corrigió el nombre de la variable de `anio_cursada` a `anio_academico` para cumplir con el esquema Ninja de Django, resolviendo el error `422 Unprocessable Entity` al intentar guardar.
   * **Eliminación desde el guardado:** Si la selección de horas es `0`, el sistema ahora realiza una llamada a `DELETE /horarios_catedra/{id}` (y su correspondiente duplicado si es Anual) de forma transparente al usuario, previa confirmación por pantalla.

4. **`frontend/src/components/horarios/TimetableGrid.tsx`**
   * Se pasa y maneja el parámetro `anioLectivo` para consultar la ocupación de bloques del año correcto.
   * Se flexibilizó la validación del botón "Guardar" para permitir `selectedCount === 0`.
   * El botón ahora cambia dinámicamente su estilo, etiqueta y tooltip a **`Eliminar`** cuando no hay bloques seleccionados, brindando una experiencia intuitiva de borrado.

5. **`frontend/src/pages/Secretaria/CatedraDocentePage.tsx`**
   * **Validación de Filtros:** Se deshabilita el botón de lápiz (Editar) y se muestra un tooltip aclaratorio si el selector de "Turno" está vacío. Las alertas de guardado ahora señalan de forma precisa cuál filtro falta completar.
   * **Guardado No Destructivo (In-place PUT):** Se reemplazó el flujo destructivo de "borrar todas las comisiones y recrearlas" por llamadas de actualización parcial (`PUT /comisiones/{id}`). Esto preserva los identificadores y **protege al 100% las inscripciones de alumnos en producción**.
   * Si el usuario elimina un suplente y la base de datos bloquea el borrado por tener inscripciones, la aplicación ahora limpiará el docente (`docente = null`) y cerrará la comisión (`estado = 'CER'`) en lugar de arrojar un error.

---

## 📋 Fase 1: Actualización del Código de GitHub y Contenedores

Los cambios en los archivos de React y Django ya están guardados localmente y listos para subirse a GitHub. Una vez confirmados en la rama principal (`main`), realiza los siguientes comandos en el servidor de producción:

### 1. Descargar las actualizaciones del repositorio
```bash
git pull origin main
```

### 2. Reconstruir e inicializar el contenedor del Frontend
Debido a que el Frontend de React se compila estáticamente dentro de la imagen de Docker, **es obligatorio reconstruir la imagen** para que los cambios surtan efecto en el navegador:
```bash
# Entra al directorio donde está el docker-compose
cd backend

# Reconstruye la imagen del frontend (toma aproximadamente 30-60 segundos usando caché)
docker compose build frontend

# Recrea e inicia el contenedor del frontend en segundo plano
docker compose up -d frontend
```

### 3. Reiniciar el contenedor del Backend
Se han modificado endpoints clave de la API en el backend (`api.py` y `horarios_api.py`). Es necesario reiniciar el contenedor para que Gunicorn cargue la nueva lógica en memoria:
```bash
docker compose restart backend
```

---

## 🗄️ Fase 2: Migración y Limpieza en la Base de Datos (Operación no-código)

**IMPORTANTE:** El traspaso de alumnos inscriptos y la eliminación de las comisiones erróneas del **Turno mañana** de **4.º año** es una operación directa sobre los datos y **no se realiza a través de archivos de código en GitHub**.

Para realizar la misma limpieza de datos en producción de manera 100% segura y atómica, debes ejecutar el siguiente comando en la terminal del servidor de producción:

```bash
docker exec -it ipes6-backend-dev /app/.venv/bin/python manage.py shell -c "
from django.db import transaction
from core.models import Comision, PlanDeEstudio, Turno

with transaction.atomic():
    plan = PlanDeEstudio.objects.get(resolucion='Resolución M.E. No 1935/14')
    turno_m = Turno.objects.get(nombre='Turno mañana')
    turno_v = Turno.objects.get(nombre='Turno vespertino')
    
    coms_m = Comision.objects.filter(materia__plan_de_estudio=plan, materia__anio_cursada=4, anio_lectivo=2026, turno=turno_m)
    
    total_moved = 0
    total_deleted = 0
    
    for c_m in list(coms_m):
        c_v = Comision.objects.filter(materia=c_m.materia, anio_lectivo=2026, turno=turno_v).first()
        if not c_v:
            print(f'Advertencia: No se encontró comisión vespertina para {c_m.materia.nombre}')
            continue
        
        # Mover inscripciones de alumnos
        inscs = c_m.inscripciones.all()
        for i in inscs:
            i.comision = c_v
            i.save()
            total_moved += 1
            
        inscs_req = c_m.inscripciones_solicitadas.all()
        for i in inscs_req:
            i.comision_solicitada = c_v
            i.save()
            total_moved += 1
            
        # Eliminar comisión de la mañana (ahora vacía)
        c_m.delete()
        total_deleted += 1
        
    print(f'MIGRACIÓN ÉXITOSA: Se traspasaron {total_moved} inscripciones al Turno Vespertino.')
    print(f'LIMPIEZA ÉXITOSA: Se eliminaron {total_deleted} comisiones erróneas del Turno Mañana.')
"
```

> [!NOTE]
> * Si el nombre del contenedor de backend en producción es diferente (por ejemplo, `cfp_backend_prod`), sustituye `ipes6-backend-dev` en la primera línea por el nombre del contenedor de producción correspondiente.
> * Esta consulta se ejecuta de forma **atómica** (bajo una transacción SQL `transaction.atomic()`), lo que significa que si algo falla, no se aplicará ningún cambio a medias, protegiendo al 100% la integridad de la base de datos.

---

## 💾 Fase 3: Importar Horarios y Asignación de Docentes (Ciclo 2026)

Para evitar tener que cargar manualmente todos los horarios y la asignación de docentes que ya configuramos localmente en el ciclo 2026, hemos exportado un fixture de Django completo.

El archivo contiene:
* **54 Horarios de Cátedra** (`HorarioCatedra` del año 2026)
* **182 Detalle de Horarios** (`HorarioCatedraDetalle` que representan cada bloque del cronograma)
* **36 Comisiones y Docentes** (`Comision` del año 2026 con sus respectivos suplentes, titulares y estados)

Este archivo se encuentra guardado en la ruta del repositorio: [datos_horarios_docentes_2026.json](file:///home/admin486321/IPES6/backend/core/fixtures/datos_horarios_docentes_2026.json) (se mapea automáticamente dentro del contenedor).

### 🚀 Instrucción de Carga en Producción

Ejecuta el siguiente comando en la terminal del servidor de producción para importar de manera automática e instantánea toda la carga de horarios y docentes de 2026:

```bash
docker exec -it ipes6-backend-dev /app/.venv/bin/python manage.py loaddata datos_horarios_docentes_2026.json
```

> [!TIP]
> * **Orden Recomendado:** Ejecuta este comando **después** de haber corrido las migraciones y la **Fase 2** (limpieza de turnos erróneos).
> * **Integridad de Base de Datos:** Este comando insertará/actualizará los registros de horarios y docentes correspondientes sin alterar las tablas de inscripciones ni el plan de estudios.

