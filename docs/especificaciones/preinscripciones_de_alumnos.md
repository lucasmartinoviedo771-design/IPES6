Análisis de las Condiciones de Preinscripción de Alumnos

De acuerdo con el análisis del código y las aclaraciones realizadas, un aspirante no podría inscribirse si se cumple alguna de las siguientes condiciones:

**Validaciones Automáticas y de Seguridad:**

1.  **Falla en la Verificación Anti-Spam:**
    *   Si la verificación de reCAPTCHA (el sistema "No soy un robot") falla o no alcanza una puntuación mínima.
    *   Si se detecta un comportamiento de bot, como rellenar un campo "honeypot" oculto en el formulario.
    *   Si se supera el límite de inscripciones permitidas desde una misma dirección IP en una hora.

2.  **Datos de Formulario Inválidos:**
    *   Si faltan campos obligatorios como DNI, nombre, apellido, fecha de nacimiento o la carrera a la que se inscribe.
    *   Si los datos ingresados no tienen el formato correcto (por ejemplo, un texto donde debería ir una fecha).

**Reglas de Negocio de la Institución:**

3.  **Carrera no Habilitada:**
    *   Si la carrera seleccionada no existe en la base de datos.
    *   Si la carrera tiene explícitamente deshabilitada la inscripción (el campo `inscripcion_abierta` está en `False`).

4.  **Inscripción Duplicada (en un caso específico):**
    *   Aunque el sistema actualiza una preinscripción si el aspirante vuelve a enviar el formulario, bloquea explícitamente el intento de añadir una *segunda* preinscripción a la **misma carrera y en el mismo año** a través de la función de "agregar carrera".

**Hallazgo Importante:**

*   **Ausencia de Ventana de Inscripción en el Backend:** El análisis reveló que las fechas de inicio y fin del período de preinscripción (`VentanaHabilitacion`) **no se están validando en el servidor**. Esto significa que la API de preinscripción está técnicamente siempre abierta, y la restricción de fechas probablemente solo se controla en la interfaz de usuario (frontend). Esto es una debilidad, ya que un usuario con conocimientos técnicos podría saltarse la restricción de fechas.

---

**Restricciones a Nivel de Base de Datos:**

Estas son limitaciones impuestas directamente por la estructura de la base de datos para garantizar la integridad y unicidad de los datos:

1.  **Un DNI por Alumno:** La tabla de `Estudiante` tiene una restricción `UNIQUE` en el campo `dni`.
    *   **Condición:** Es imposible que existan dos registros de estudiantes con el mismo número de DNI.
    *   **Comportamiento del sistema:** El código está diseñado para manejar esto de forma elegante. Antes de crear un nuevo estudiante, busca si ya existe uno con ese DNI. Si lo encuentra, actualiza sus datos (nombre, apellido, etc.) en lugar de intentar crear un duplicado y provocar un error de base de datos.

2.  **Una Preinscripción por Carrera y Año:** La tabla `Preinscripcion` tiene una restricción `UNIQUE` combinada para los campos `(alumno, carrera, anio)`.
    *   **Condición:** Un alumno no puede tener más de una preinscripción para la misma carrera en el mismo año académico.
    *   **Comportamiento del sistema:** Al igual que con el DNI, el código primero verifica si ya existe una preinscripción para ese alumno en esa carrera y año. Si existe, la actualiza. Esto evita un error directo de la base de datos y asegura que el aspirante simplemente actualice su postulación si vuelve a llenar el formulario.

---

**Aclaraciones Adicionales:**

*   **Preinscripción "por año"**: Se refiere al **año académico para el cual se realiza la preinscripción**. Si te preinscribiste en una carrera para el año académico 2025 y no comenzaste, podrías volver a preinscribirte para la misma carrera en el año académico 2026. La base de datos considera estas dos preinscripciones como distintas porque el valor del campo `anio` sería diferente (2025 vs. 2026).

*   **Inscripción en Múltiples Carreras**: Sí, puedes inscribirte en múltiples carreras. El sistema permite que un mismo alumno se inscriba en diferentes carreras, ya sea en el mismo año académico o en años distintos. El sistema te identificará por tu DNI y creará una nueva preinscripción que te vinculará a la segunda carrera para el año académico correspondiente.