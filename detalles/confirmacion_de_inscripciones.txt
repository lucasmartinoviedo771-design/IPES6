Análisis del Proceso de Confirmación de Inscripciones

Este documento detalla las reglas y condiciones que rigen la confirmación de una preinscripción, la inscripción en carreras adicionales y el cambio de plan de estudios.

---

### Reglas que Impiden la Confirmación de una Carrera

La confirmación se realiza a través de la función `confirmar_por_codigo` y está sujeta a las siguientes condiciones:

1.  **Autenticación y Autorización:**
    *   El usuario que intenta confirmar la preinscripción debe tener uno de los siguientes roles: `admin`, `secretaria` o `bedel`.

2.  **Existencia de la Preinscripción:**
    *   El `código` de preinscripción proporcionado debe corresponder a una preinscripción existente en el sistema.

3.  **Completitud del Checklist (Requisito Funcional):**
    *   Aunque la API permite confirmar una preinscripción con un checklist incompleto, el `estado_legajo` (estado del legajo) se calcula automáticamente. Funcionalmente, una inscripción no se consideraría completa hasta que el legajo esté en estado "COMPLETO".
    *   **Condiciones que marcan un legajo como "INCOMPLETO":**
        *   Falta de `dni_legalizado`, `certificado_salud`, `fotos_4x4`.
        *   Menos de 3 `folios_oficio`.
        *   No cumplir con los requisitos de documentación de educación secundaria (ej. no presentar título, certificado de título en trámite o analítico).
        *   Si se presenta analítico, pueden requerirse documentos adicionales como el certificado de alumno regular.
        *   Para la certificación docente, puede requerirse `titulo_terciario_univ` o `incumbencia`.

---

### Reglas que Impiden la Inscripción en Otra Carrera (Agregar Carrera)

Un alumno puede cursar múltiples carreras simultáneamente. El proceso para añadir una carrera adicional está sujeto a estas reglas:

1.  **Autenticación y Autorización:**
    *   Si el proceso lo realiza un administrador, este debe tener rol de `admin`, `secretaria` o `bedel`.

2.  **Existencia de la Preinscripción y la Carrera:**
    *   Debe existir el alumno y la carrera a la que se desea inscribir.

3.  **Preinscripción Activa Duplicada:**
    *   Un estudiante no puede tener dos preinscripciones *activas* para la **misma carrera** en el **mismo año académico**. Sí puede tener preinscripciones para carreras diferentes en el mismo año.

**Flujos de Trabajo para Agregar una Carrera:**

Existen dos maneras de agregar una carrera para un alumno ya existente:

*   **Flujo Público (Realizado por el Alumno):**
    1.  El alumno vuelve a llenar el formulario de preinscripción, seleccionando la nueva carrera.
    2.  El sistema lo identifica por su DNI y crea una **nueva preinscripción** separada para la nueva carrera.
    3.  Esta nueva preinscripción debe ser confirmada por un administrador.

*   **Flujo Administrativo (Panel "Profesorados asociados"):**
    1.  Un administrador, desde el panel del alumno, utiliza la opción para "asociar" o "agregar" un nuevo profesorado.
    2.  Esto invoca la función `agregar_carrera` en el backend.
    3.  Aunque la interfaz es más simple, el sistema igualmente crea una **nueva preinscripción** separada para la nueva carrera, la cual también debe ser confirmada.

---

### Reglas que Impiden el Cambio de Plan de Estudios (Cambiar de Carrera)

Este proceso es para cuando un alumno desea *cambiar* de una carrera a otra, no cursarlas simultáneamente.

1.  **Autenticación y Autorización:**
    *   El usuario debe tener uno de los siguientes roles: `admin`, `secretaria` o `bedel`.

2.  **Existencia de la Preinscripción:**
    *   El `código` de preinscripción proporcionado debe existir.

3.  **Actividad Académica Existente (El Bloqueo Principal):**
    *   **No se puede cambiar de carrera si el estudiante ya registra actividad académica en la carrera actual.** Esto es para proteger el historial del alumno e incluye:
        *   `InscripcionMateriaAlumno` (inscripciones a materias).
        *   `Regularidad` (registros de regularidad/asistencia).
        *   `InscripcionMesa` (inscripciones a exámenes).
    *   Si existe cualquiera de estos registros, el cambio de carrera será bloqueado.
