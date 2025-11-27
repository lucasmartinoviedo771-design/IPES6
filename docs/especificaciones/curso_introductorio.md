# Proceso del Curso Introductorio

Este documento describe el proceso del Curso Introductorio, incluyendo cómo se generan las listas de estudiantes, cómo se aprueba a los estudiantes y quiénes son los responsables de dicha aprobación.

---

## 1. ¿Quiénes deben hacerlo? / ¿Cómo se generan las listas?

Los estudiantes que deben realizar el Curso Introductorio son, implícitamente, **todos los nuevos estudiantes preinscriptos** para un ciclo lectivo. El sistema ofrece dos vías principales para gestionar su participación:

### A. Registro Formal en Cohortes

El sistema permite la creación y gestión de "cohortes" del Curso Introductorio, que son instancias específicas del curso con fechas, cupos y profesorados asociados.

*   **Creación de Cohortes:** El personal administrativo (roles `admin`, `secretaria`) puede crear y gestionar `CursoIntroductorioCohorte` a través de los endpoints `POST /curso-intro/cohortes` y `PUT /curso-intro/cohortes/{cohorte_id}`.
*   **Inscripción de Estudiantes en Cohortes:**
    *   **Manual por Personal:** Un miembro del personal autorizado (roles `admin`, `secretaria`, `bedel`, `curso_intro`) puede inscribir manualmente a un estudiante en una cohorte específica utilizando el endpoint `POST /curso-intro/registros` (`curso_intro_inscribir`).
    *   **Auto-inscripción del Estudiante:** Los estudiantes pueden auto-inscribirse en una cohorte disponible a través del endpoint `POST /curso-intro/auto-inscripcion`, siempre que haya una `VentanaHabilitacion` activa de tipo `CURSO_INTRODUCTORIO` para esa cohorte.
*   **Listado de Pendientes:** El endpoint `GET /curso-intro/pendientes` (`curso_intro_listar_pendientes`) proporciona una lista de estudiantes que aún no tienen el curso introductorio aprobado y no están registrados en ninguna cohorte. Esta es la lista de "quiénes deberían hacerlo".

### B. Checklist de Preinscripción (Vía Administrativa Directa)

Aunque no es el flujo formal de gestión del curso, el sistema permite una aprobación directa a través del checklist de preinscripción.

*   **Creación del Checklist:** Un `PreinscripcionChecklist` se crea automáticamente para una preinscripción cuando un administrativo interactúa por primera vez con ella.

---

## 2. El Proceso de Aprobación

Existen dos mecanismos para marcar a un estudiante como "aprobado" en el Curso Introductorio:

### A. Aprobación Formal a través de `CursoIntroductorioRegistro`

Este es el método estructurado y preferido para la gestión del curso.

1.  **Registro de Asistencia y Notas:** El personal puede registrar la asistencia (`POST /curso-intro/registros/{registro_id}/asistencia`) y, finalmente, la nota final y el resultado.
2.  **Cierre del Registro:** El endpoint `POST /curso-intro/registros/{registro_id}/cierre` (`curso_intro_cerrar_registro`) es el que establece el `resultado` final del estudiante en la cohorte (ej. `APROBADO`, `DESAPROBADO`, `AUSENTE`).
3.  **Sincronización:** Cuando el `resultado` se establece como `APROBADO` en un `CursoIntroductorioRegistro`, el campo `estudiante.curso_introductorio_aprobado` en el modelo `Estudiante` se actualiza automáticamente a `True`.

### B. Aprobación Administrativa Directa a través de `PreinscripcionChecklist`

Este método permite una anulación o registro directo del estado de aprobación.

1.  **Actualización del Checklist:** Un usuario autorizado puede acceder al checklist de preinscripción de un estudiante y marcar directamente el campo `curso_introductorio_aprobado` como `True` a través del endpoint `PUT /preinscriptions/{pre_id}/checklist`.
2.  **Nota sobre Sincronización:** Es importante destacar que esta actualización directa del `PreinscripcionChecklist` **no** actualiza automáticamente el campo `estudiante.curso_introductorio_aprobado`. Esto sugiere que `Estudiante.curso_introductorio_aprobado` es la fuente principal de verdad para el estado general del estudiante, mientras que el checklist es más para el seguimiento administrativo de la documentación.

---

## 3. ¿Quiénes aprueban a los estudiantes?

Los permisos para gestionar el Curso Introductorio están basados en roles:

*   **Gestión de Cohortes y Registros (Vía Formal):**
    *   Roles permitidos: `admin`, `secretaria`, `bedel`, `curso_intro`.
    *   Estos roles pueden crear/actualizar cohortes, inscribir estudiantes y, fundamentalmente, establecer el `resultado` final de un `CursoIntroductorioRegistro` a `APROBADO`.
    *   El sistema aplica filtros de acceso (`_ci_ensure_profesorado_access`) para asegurar que el personal solo gestione los profesorados a los que está asignado.
*   **Aprobación Administrativa Directa (Vía Checklist):**
    *   Roles permitidos: `admin`, `secretaria`, `bedel`.
    *   Estos roles pueden marcar directamente la casilla `curso_introductorio_aprobado` en el `PreinscripcionChecklist` de un estudiante.

---

## 4. Campo `estudiante.curso_introductorio_aprobado`

Este campo en el modelo `Estudiante` es la fuente principal de verdad para el estado de aprobación del Curso Introductorio de un estudiante. Se actualiza automáticamente cuando un `CursoIntroductorioRegistro` se marca como `APROBADO` a través del proceso formal. Sin embargo, no se actualiza automáticamente si solo se modifica el `PreinscripcionChecklist`.

---

## 5. Componentes de Frontend Implícitos

Basado en los endpoints de la API, se espera la existencia de las siguientes interfaces de usuario:

*   **Vista del Estudiante:** Una página donde los estudiantes pueden ver su estado actual del curso introductorio y auto-inscribirse en cohortes disponibles.
*   **Gestión de Cohortes (Personal):** Una interfaz para que el personal cree, liste y actualice las `CursoIntroductorioCohorte`.
*   **Gestión de Registros (Personal):** Una interfaz para que el personal liste los registros de estudiantes, los inscriba manualmente, registre la asistencia y establezca los resultados finales.
*   **Lista de Pendientes (Personal):** Una lista de estudiantes que necesitan ser inscritos en un curso introductorio.
*   **Editor de Checklist (Personal):** La interfaz `PreConfirmEditor.tsx` donde el personal puede marcar directamente la casilla "Curso Introductorio Aprobado" en el checklist de preinscripción.
