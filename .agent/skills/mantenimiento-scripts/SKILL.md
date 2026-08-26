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
* **Script:** [`backend/scripts/unify_student.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/unify_student.py)
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
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/unify_student.py <DNI_ORIGEN_ERRONEO> <DNI_DESTINO_CORRECTO>
  ```

---

### 2. 🔑 Blanqueo / Reset de Contraseña
* **Script:** [`backend/scripts/reset_password.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/reset_password.py)
* **Cuándo usar:** Cuando un alumno o docente no puede ingresar al sistema y solicita reseteo de clave.
* **Comportamiento:**
  * Si no se especifica contraseña nueva, setea por defecto el mismo número de DNI.
  * Si es estudiante, activa el flag `must_change_password = True` para que el sistema le pida cambiarla en el primer login.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/reset_password.py <DNI_O_USERNAME> [NUEVA_PASS_OPCIONAL]
  ```

---

### 3. 📝 Vinculación Rápida de Actas y Planillas por DNI
* **Script:** [`backend/scripts/fix_actas_planillas.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/fix_actas_planillas.py)
* **Cuándo usar:** Para actualizar únicamente el texto del DNI en registros históricos de `ActaExamenEstudiante` y `PlanillaRegularidadFila` sin tocar usuarios o inscripciones.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/fix_actas_planillas.py
  ```

---

### 4. 🎓 Creación / Vinculación de Legajo de Estudiante
* **Script:** [`backend/scripts/create_student.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/create_student.py)
* **Cuándo usar:** Cuando existe la `Persona`/`User` pero no se generó el registro de `Estudiante` o no tiene asignada la carrera/profesorado.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/create_student.py
  ```

---

### 5. 👥 Migración Masiva de Estudiantes entre Comisiones
* **Script:** [`backend/scripts/migrar_estudiantes.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/migrar_estudiantes.py)
* **Cuándo usar:** Cuando se deben unificar estudiantes de comisiones secundarias o cerradas hacia una comisión activa principal.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/migrar_estudiantes.py
  ```

---

### 6. 🕒 Auditoría y Corrección de Turnos de Cursada
* **Scripts:**
  * [`backend/scripts/analisis_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/analisis_turnos.py): Analiza y detecta discrepancias entre el turno del plan y el turno de las comisiones.
  * [`backend/scripts/corregir_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/corregir_turnos.py): Ajusta comisiones al turno correcto según carrera y año.
  * [`backend/scripts/limpiar_comisiones.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/limpiar_comisiones.py): Cierra comisiones vacías que pertenecen a turnos inexistentes.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/corregir_turnos.py
  ```

---

### 7. 🔗 Vinculación Automática de Horarios a Comisiones
* **Script:** [`backend/scripts/vincular_horarios_comisiones.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/vincular_horarios_comisiones.py)
* **Cuándo usar:** Cuando se crean comisiones nuevas o se importan cursos y quedan sin su `horario_id` asociado, impidiendo que aparezcan en la toma de asistencias diaria.
* **Comportamiento:**
  * Vincula automáticamente cada comisión activa con su `HorarioCatedra` correspondiente por materia, año lectivo y turno.
  * Regenera los snapshots de asistencia (`CursoHorarioSnapshot` y `CursoEstudianteSnapshot`).
  * Genera y actualiza las clases programadas para el día actual.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/vincular_horarios_comisiones.py
  ```

---

### 8. 🔍 Auditoría de Inscripciones a Materias (Quién y Cuándo inscribió)
* **Script:** [`backend/scripts/audit_student_inscriptions.py`](file:///home/ipesrg/sistema-gestion/backend/scripts/audit_student_inscriptions.py)
* **Cuándo usar:** Cuando se requiera saber a qué materias/comisiones está inscripto un alumno por DNI, conociendo con precisión la fecha, hora exacta (hora de Argentina) y el operador o usuario que registró el movimiento en el sistema.
* **Comando:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/audit_student_inscriptions.py <DNI>
  ```

---

## ⚡ Regla de Ejecución en Docker

Dado que la base de datos MySQL corre en el contenedor `ipes6-db-dev` bajo la red Docker interna (`db`), **todo script de backend debe ejecutarse mediante:**
```bash
docker exec ipes6-backend-dev /app/.venv/bin/python /app/scripts/<script>.py [argumentos]
```
