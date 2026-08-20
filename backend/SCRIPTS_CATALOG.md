# Catálogo de Scripts de Mantenimiento y Operaciones - IPES

Este documento registra los scripts disponibles para operaciones recurrentes, correcciones y tareas de administración directa sobre la base de datos de IPES Paulo Freire.

---

## 🛠️ Scripts Principales

### 1. Unificación de Estudiantes (Fusión de Trayectorias / Corrección de DNI)
* **Archivo:** [`backend/unify_student.py`](file:///home/ipesrg/sistema-gestion/backend/unify_student.py)
* **Descripción:** Unifica dos registros de un mismo alumno cuando por error de carga histórica o cambio de documento sus datos quedaron asociados a un DNI provisorio o erróneo.
* **Qué traslada/unifica:**
  * Usuario (`User`) y Persona (`Persona`).
  * Carreras / Profesorados activos (`Estudiante.carreras`).
  * Regularidades (`Regularidad`).
  * Inscripciones a Materias (`InscripcionMateriaEstudiante`).
  * Inscripciones a Mesas de Examen (`InscripcionMesa`).
  * Asistencias (`AsistenciaEstudiante`).
  * Planillas de Cursada (`PlanillaCursadaFila`).
  * Planillas de Regularidad históricas (`PlanillaRegularidadFila`).
  * Actas de Examen cargadas (`ActaExamenEstudiante`).
* **Ejecución:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/unify_student.py <DNI_ORIGEN_ERRONEO> <DNI_DESTINO_CORRECTO>
  ```

---

### 2. Reset / Blanqueo de Contraseña de Usuario
* **Archivo:** [`backend/reset_password.py`](file:///home/ipesrg/sistema-gestion/backend/reset_password.py)
* **Descripción:** Permite resetear la contraseña de acceso de un estudiante o docente por DNI o username.
* **Ejecución:**
  ```bash
  docker exec ipes6-backend-dev /app/.venv/bin/python /app/reset_password.py <DNI_O_USERNAME> <NUEVA_PASSWORD>
  ```

---

### 3. Diagnóstico y Corrección de Turnos y Comisiones
* **Archivos:**
  * [`backend/analisis_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/analisis_turnos.py) (Auditoría de comisiones vs. turnos reales del plan)
  * [`backend/corregir_turnos.py`](file:///home/ipesrg/sistema-gestion/backend/corregir_turnos.py) (Ajuste masivo de turnos de comisiones)
  * [`backend/limpiar_comisiones.py`](file:///home/ipesrg/sistema-gestion/backend/limpiar_comisiones.py) (Cierre de comisiones duplicadas de otros turnos)
* **Descripción:** Permite auditar y corregir inconsistencias en turnos de cursada y comisiones asignadas a materias según el profesorado y año de la carrera.

---

### 4. Migración y Reasignación de Inscripciones
* **Archivo:** [`backend/migrar_estudiantes.py`](file:///home/ipesrg/sistema-gestion/backend/migrar_estudiantes.py)
* **Descripción:** Traspasa en bloque estudiantes inscriptos desde comisiones duplicadas/erróneas a la comisión activa correspondiente.

---

### 5. Exportación de Docentes, Cátedras y Suplencias
* **Archivo:** [`backend/export_docentes_con_inscriptos.py`](file:///home/ipesrg/sistema-gestion/backend/export_docentes_con_inscriptos.py)
* **Descripción:** Genera un CSV completo de todos los espacios curriculares anuales y de 2.º cuatrimestre con docentes titulares, interinos, suplentes (1 a 4) y la cantidad de alumnos inscriptos por comisión.

---

## 📌 Guía de Uso Rápido en Servidor (Docker)

Todos los scripts deben ejecutarse usando el intérprete virtual dentro del contenedor de backend:
```bash
docker exec ipes6-backend-dev /app/.venv/bin/python /app/<nombre_script>.py [argumentos]
```
