# Proceso de Carga de Horarios y Vinculación

Este documento describe cómo se gestionan los horarios en el sistema, incluyendo la creación de bloques y horarios de cátedra, la asignación de docentes a comisiones y la vinculación de estudiantes a estos horarios.

---

## 1. Modelos Clave Involucrados

*   **`Turno`:** Define los turnos (Mañana, Tarde, Noche).
*   **`Bloque`:** Representa un bloque horario específico (día, hora de inicio, hora de fin) dentro de un `Turno`.
*   **`HorarioCatedra`:** Vincula una `Materia` con un `Turno`, `anio_cursada` y `cuatrimestre`. Es la definición general del horario de una materia.
*   **`HorarioCatedraDetalle`:** Asocia un `HorarioCatedra` con uno o varios `Bloque`s, detallando los momentos específicos en que se dicta la materia.
*   **`Comision`:** Agrupa una `Materia` para un `anio_lectivo` y `Turno` específicos. Puede vincularse a un `Docente` y a un `HorarioCatedra`.
*   **`Docente`:** El profesor asignado a una `Comision`.
*   **`InscripcionMateriaAlumno`:** La inscripción de un estudiante a una `Materia`, que puede incluir la asignación a una `Comision`.

---

## 2. Carga y Gestión de Horarios (Turnos, Bloques, Horarios de Cátedra)

La creación y gestión de los componentes básicos de los horarios se realiza a través de endpoints de la API, principalmente por roles administrativos.

### A. Gestión de `Turno`s

*   **Listar:** `GET /turnos`
*   **Crear:** `POST /turnos`
    *   **Permisos:** Roles de edición de estructura (`admin`, `secretaria`, `bedel`).

### B. Gestión de `Bloque`s

*   **Listar por Turno:** `GET /turnos/{turno_id}/bloques`
*   **Crear por Turno:** `POST /turnos/{turno_id}/bloques`
    *   **Permisos:** Roles de edición de estructura (`admin`, `secretaria`, `bedel`).

### C. Gestión de `HorarioCatedra`

Representa el horario general de una materia (ej. "Pedagogía - Turno Mañana - Año 2025").

*   **Listar:** `GET /horarios_catedra` (con filtros por materia, turno, año, cuatrimestre).
*   **Crear:** `POST /horarios_catedra`
    *   **Permisos:** Roles de edición de estructura (`admin`, `secretaria`, `bedel`), con acceso al `Profesorado` de la `Materia` asociada.
    *   **Validación:** Asegura la consistencia del `cuatrimestre` con el `regimen` de la `Materia`. Es idempotente: si ya existe un `HorarioCatedra` idéntico, devuelve el existente.
*   **Actualizar:** `PUT /horarios_catedra/{horario_id}`
    *   **Permisos:** Roles de edición de estructura.
*   **Eliminar:** `DELETE /horarios_catedra/{horario_id}`
    *   **Permisos:** Roles de edición de estructura.

### D. Gestión de `HorarioCatedraDetalle`

Asocia un `HorarioCatedra` con `Bloque`s específicos (ej. "Pedagogía - Lunes 8:00-10:00").

*   **Listar por Horario de Cátedra:** `GET /horarios_catedra/{horario_catedra_id}/detalles`
*   **Crear:** `POST /horarios_catedra/{horario_catedra_id}/detalles`
    *   **Permisos:** Roles de edición de estructura.
    *   **Validación Crucial (Detección de Superposiciones):** Este endpoint verifica si el `Bloque` que se intenta asignar ya está ocupado por otro `HorarioCatedra` en el mismo `turno`, `anio_cursada`, `plan_de_estudio` y `anio_cursada` de la `Materia`.
        *   **Caso Especial (Talleres/Residencias):** Si la `Materia` es un taller o residencia, permite superposiciones con otros talleres/residencias (hasta 2 en paralelo), pero no con materias regulares.
        *   En caso de conflicto, devuelve un error `409 Conflict` con detalles del horario en conflicto.
*   **Eliminar:** `DELETE /horarios_catedra_detalles/{detalle_id}`
    *   **Permisos:** Roles de edición de estructura.

---

## 3. Vinculación de Horarios con Docentes (`Comision`)

La asignación de docentes a horarios se realiza a través de la gestión de `Comision`es.

### A. Gestión de `Comision`es

*   **Listar:** `GET /comisiones` (con filtros por profesorado, plan, materia, año, turno, estado).
*   **Crear:** `POST /comisiones`
    *   **Permisos:** Roles de gestión académica (`admin`, `secretaria`, `bedel`), con acceso al `Profesorado` de la `Materia`.
    *   **Payload:** Permite especificar `materia_id`, `anio_lectivo`, `codigo`, `turno_id`, y opcionalmente `docente_id` y `horario_id` (vinculando explícitamente el docente y el horario de cátedra a la comisión). También incluye `cupo_maximo`, `estado` y `observaciones`.
*   **Generación Masiva:** `POST /comisiones/generar`
    *   **Permisos:** Roles de gestión académica.
    *   **Lógica:** Permite generar múltiples comisiones para todas las materias de un `PlanDeEstudio`, asignando códigos auto-generados y distribuyendo los turnos de forma rotativa.
*   **Actualizar:** `PUT /comisiones/{comision_id}`
    *   **Permisos:** Roles de gestión académica.
*   **Eliminar:** `DELETE /comisiones/{comision_id}`
    *   **Permisos:** Roles de gestión académica.

---

## 4. Vinculación de Horarios con Estudiantes

Los estudiantes se vinculan a los horarios de forma indirecta, a través de su inscripción a una `Comision`.

*   **Inscripción a Materias:** El endpoint `inscripcion_materia` (analizado previamente) permite a los estudiantes inscribirse a una `Materia`. Durante este proceso, se realizan verificaciones de superposición horaria con los `HorarioCatedra`s existentes.
*   **Asignación a `Comision`:** El registro `InscripcionMateriaAlumno` tiene campos `comision` y `comision_solicitada`. La asignación de un estudiante a una `Comision` específica (y, por lo tanto, a un docente y horario concretos) es un paso posterior a la inscripción inicial a la materia. Este proceso se gestionaría a través del endpoint `cambio_comision` (actualmente un placeholder) o mediante otro proceso administrativo.

---

## 5. Roles y Permisos

*   **Roles de Edición de Estructura (`admin`, `secretaria`, `bedel`):** Tienen permisos para crear, actualizar y eliminar `Turno`, `Bloque`, `HorarioCatedra` y `HorarioCatedraDetalle`.
*   **Roles de Gestión Académica (`admin`, `secretaria`, `bedel`):** Tienen permisos para crear, actualizar y eliminar `Comision`.
*   **Roles de Vista de Estructura (más amplios, incluyendo `coordinador`, `tutor`, `jefes`, `jefa_aaee`, `consulta`):** Pueden ver estas entidades.

---
