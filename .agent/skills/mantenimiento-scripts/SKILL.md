---
name: mantenimiento-scripts
description: Guía y catálogo completo de scripts operativos de mantenimiento y corrección de datos en IPES6 (unificación de alumnos, actas, planillas, comisiones, blanqueo de claves, creación de legajos).
---

# Skill: Mantenimiento y Operaciones de Base de Datos IPES6

Esta skill es el punto de entrada y catálogo obligatorio para todas las tareas operativas recurrentes en IPES Paulo Freire. 
**Regla fundamental:** Antes de crear scripts temporales o consultar modelos desde cero, verificar si la operación ya está cubierta en este listado.

---

## 📚 Catálogo Detallado de Scripts

### 1. 🔄 Unificación de Alumnos / Corrección de DNI
* **Script:** [`backend/unify_student.py`](file:///home/ipesrg/sistema-gestion/backend/unify_student.py)
* **Cuándo usar:** Cuando un estudiante tiene su trayectoria partida entre dos DNI (por ejemplo un DNI provisorio y uno definitivo) o cuando se debe rectificar el número de documento de un alumno migrando toda su historia.
* **Tablas que consolida:**
  * `User` y `Persona`
  * Carreras asociadas (`Estudiante.carreras`)
  * Regularidades (`Regularidad`)
  * Inscripciones a materias (`InscripcionMateriaEstudiante`)
  * Inscripciones a mesas de examen (`InscripcionMesa`)
  * Asistencias (`AsistenciaEstudiante`)
  * Planillas de cursada docente (`PlanillaCursadaFila`)
  * Planillas de regularidad históricas (`PlanillaRegularidadFila`)
  * Actas de examen (`ActaExamenEstudiante`)
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/unify_student.py <DNI_ORIGEN_ERRONEO> <DNI_DESTINO_CORRECTO>
  ```

---

### 2. 🔑 Blanqueo / Reset de Contraseña
* **Script:** [`backend/reset_password.py`](file:///home/ipesrg/sistema-gestion/backend/reset_password.py)
* **Cuándo usar:** Cuando un alumno o docente no puede ingresar al sistema y solicita reseteo de clave.
* **Comportamiento:**
  * Si no se especifica contraseña nueva, setea por defecto el mismo número de DNI.
  * Si es estudiante, activa el flag `must_change_password = True` para que el sistema le pida cambiarla en el primer login.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/reset_password.py <DNI_O_USERNAME> [NUEVA_PASS_OPCIONAL]
  ```

---

### 3. 📝 Vinculación Rápida de Actas y Planillas por DNI
* **Script:** [`backend/fix_actas_planillas.py`](file:///home/ipesrg/sistema-gestion/backend/fix_actas_planillas.py)
* **Cuándo usar:** Para actualizar únicamente el texto del DNI en registros históricos de `ActaExamenEstudiante` y `PlanillaRegularidadFila` sin tocar usuarios o inscripciones.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/fix_actas_planillas.py
  ```

---

### 4. 🎓 Creación / Vinculación de Legajo de Estudiante
* **Script:** [`backend/create_student.py`](file:///home/ipesrg/sistema-gestion/backend/create_student.py)
* **Cuándo usar:** Cuando existe la `Persona`/`User` pero no se generó el registro de `Estudiante` o no tiene asignada la carrera/profesorado.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/create_student.py
  ```

---

### 5. 👥 Migración Masiva de Estudiantes entre Comisiones
* **Script:** [`backend/migrar_estudiantes.py`](file:///home/ipesrg/sistema-gestion/backend/migrar_estudiantes.py)
* **Cuándo usar:** Cuando se deben unificar estudiantes de comisiones secundarias o cerradas hacia una comisión activa principal.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/migrar_estudiantes.py
  ```

---

### 6. 🕒 Auditoría y Corrección de Turnos de Cursada
* **Scripts:**
  * [`backend/analisis_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/analisis_turnos.py): Analiza y detecta discrepancias entre el turno del plan y el turno de las comisiones.
  * [`backend/corregir_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/corregir_turnos.py): Ajusta comisiones al turno correcto según carrera y año.
  * [`backend/limpiar_comisiones.py`](file:///home/ipesrg/sistema-gestion/backend/limpiar_comisiones.py): Cierra comisiones vacías que pertenecen a turnos inexistentes.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/corregir_turnos.py
  ```

---

### 7. 📊 Exportación de Docentes, Cátedras, Suplentes e Inscriptos
* **Script:** [`backend/export_docentes_con_inscriptos.py`](file:///home/ipesrg/sistema-gestion/backend/export_docentes_con_inscriptos.py)
* **Cuándo usar:** Para generar reportes CSV con todas las materias de 2.º cuatrimestre y anuales, sus docentes (titulares/interinos), suplentes (1 a 4) y la cantidad de alumnos inscriptos por comisión.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/export_docentes_con_inscriptos.py
  docker cp ipes6-backend-dev:/tmp/docentes_anuales_2c.csv /home/ipesrg/sistema-gestion/docentes_anuales_2c.csv
  ```

---

## ⚡ Regla de Ejecución en Docker

Dado que la base de datos MySQL corre en el contenedor `ipes6-db-dev` bajo la red Docker interna (`db`), **todo script de backend debe ejecutarse mediante:**
```bash
docker exec ipes6-backend-dev /app/.venv/bin/python /app/<script>.py [argumentos]
```
