# Proceso y Bloqueos en la Inscripción a Materias (Cursadas)

Este documento resume las reglas y validaciones que determinan si un estudiante puede inscribirse para cursar una materia específica. El proceso se centra en la inscripción a la "Materia" en sí, mientras que la asignación a una "Comisión" (sección/horario específico) es un paso posterior que, en el momento del análisis, no estaba completamente implementado en el backend.

La lógica de validación está distribuida entre el Frontend (React) y el Backend (Django).

---

## 1. Flujo General de Inscripción a Materia

1.  **Selección de Materia:** En la interfaz de inscripción (`InscripcionMateriaPage.tsx`), el estudiante ve una lista de materias disponibles para su plan de estudios.
2.  **Validaciones:** Antes de permitir enviar la solicitud de inscripción, el sistema ejecuta una serie de validaciones tanto en el frontend como en el backend.
3.  **Inscripción:** Si todas las validaciones son exitosas, se crea un registro en el modelo `InscripcionMateriaAlumno`, asociando al alumno con la materia para el ciclo lectivo actual.

---

## 2. Validaciones y Bloqueos Específicos

### A. Validaciones del Lado del Frontend (React)

Estas comprobaciones se realizan en el componente `InscripcionMateriaPage.tsx` antes de llamar a la API del backend.

1.  **Ventana de Habilitación para Inscripción a Materias:**
    *   **Condición:** Debe existir una `VentanaHabilitacion` activa (`is_active = True`) y del tipo correcto (`tipo = MATERIAS`).
    *   **Bloqueo:** Si no hay una ventana de habilitación para la inscripción a materias activa, el componente de inscripción mostrará un mensaje indicando que el período de inscripción está cerrado y no permitirá continuar.

2.  **Correlatividades (Validación Duplicada):**
    *   **Condición:** El frontend verifica si el estudiante cumple con las correlatividades (materias que debe tener aprobadas o regulares) definidas en el modelo `Correlatividad`.
    *   **Bloqueo:** Si no se cumplen las correlatividades, el botón para inscribirse a esa materia aparece deshabilitado.

3.  **Superposición Horaria (Validación Duplicada):**
    *   **Condición:** El frontend comprueba si el horario de la materia seleccionada (`HorarioCatedra`) se superpone con los horarios de otras materias en las que el estudiante ya se ha inscripto en el mismo ciclo lectivo.
    *   **Bloqueo:** Si hay superposición, la materia se marca como no disponible para la inscripción.

### B. Validaciones del Lado del Backend (Django / django-ninja)

Estas comprobaciones se realizan en el endpoint de la API `POST /alumnos/inscripcion-materia` (definido en `backend/apps/alumnos/api/_head_api_tmp.py`).

1.  **Correlatividades (Validación Principal):**
    *   **Condición:** El endpoint vuelve a verificar, como medida de seguridad, que el alumno cumpla con todas las correlatividades requeridas para la materia.
    *   **Bloqueo:** Si no se cumplen, la API devuelve un error 400 (Bad Request) con el mensaje "No se cumplen las correlatividades".

2.  **Superposición Horaria (Validación Principal):**
    *   **Condición:** El endpoint realiza la validación definitiva para evitar conflictos de horario con las materias ya inscritas por el alumno.
    *   **Bloqueo:** Si detecta una superposición, la API devuelve un error 400 (Bad Request) con el mensaje "Superposición de horarios detectada".

3.  **Inscripción Duplicada:**
    *   **Condición:** El sistema verifica que el alumno no esté ya inscripto en la misma materia para el ciclo lectivo actual.
    *   **Bloqueo:** Si ya existe una inscripción, devuelve un error.

---

## 3. Lógica Incompleta (en el momento del análisis)

*   **Asignación de Comisión:** El proceso de inscripción a la materia no incluye la selección o asignación de una `Comision` (sección/grupo).
*   **Validaciones de Comisión Ausentes en Backend:** No se encontró lógica en el backend para validar la capacidad de una comisión (`cupo_maximo`), su estado, o si existe una ventana de habilitación específica para la inscripción a comisiones (`VentanaHabilitacion` de tipo `COMISION`). Esta lógica parece ser un paso posterior que no está implementado en la API principal de inscripción a materias.
