# Proceso de Gestión de Equivalencias

Este documento detalla el proceso de solicitudes de equivalencias curriculares, desde su pedido inicial, pasando por el seguimiento de su flujo de trabajo, hasta su resolución y registro formal.

---

## 1. Modelos Clave Involucrados

Los modelos principales que rigen el proceso de equivalencias son:

*   **`VentanaHabilitacion`:** Define los períodos durante los cuales se pueden realizar solicitudes de equivalencia (`Tipo.EQUIVALENCIAS`).
*   **`PedidoAnalitico`:** Registra solicitudes de analíticos. Aunque puede indicar `motivo=Motivo.EQUIVALENCIA`, no gestiona el proceso de equivalencia en sí.
*   **`EquivalenciaCurricular`:** Define **equivalencias preestablecidas** entre materias de distintos profesorados o planes de estudio. Es una configuración de datos, no un proceso de seguimiento.
*   **`PedidoEquivalencia`:** El modelo central que representa la **solicitud individual de equivalencia de un estudiante** y gestiona el flujo de trabajo de procesamiento.
*   **`PedidoEquivalenciaMateria`:** Detalla las materias específicas (del plan de origen del estudiante) que forman parte de un `PedidoEquivalencia`.
*   **`EquivalenciaDisposicion`:** Registra el **acto administrativo formal** que otorga una equivalencia (disposición o resolución).
*   **`EquivalenciaDisposicionDetalle`:** Detalla las materias específicas (del plan de destino) que se reconocen como equivalentes, vinculadas a una `EquivalenciaDisposicion`.

---

## 2. Proceso de Solicitud de Equivalencia

### A. Creación de `PedidoEquivalencia`

*   **Origen:** La solicitud de equivalencia, representada por un `PedidoEquivalencia`, es iniciada por un `Estudiante`.
*   **API / Admin:** Si bien se podría hacer mediante una API específica (no directamente evidente en el `legacy_api.py` analizado para `PedidoEquivalencia`), es probable que se gestione a través de un panel de usuario (para el estudiante) que interactúa con la API o directamente mediante la interfaz de administración de Django para el personal.
*   **Ventana de Habilitación:** La solicitud debe realizarse dentro de un período activo de `VentanaHabilitacion` de tipo `EQUIVALENCIAS`.
*   **Campos de Solicitud:** El `PedidoEquivalencia` captura detalles como:
    *   El estudiante solicitante (`estudiante`).
    *   El tipo de equivalencia (`tipo`: Anexo A o Anexo B).
    *   El ciclo lectivo.
    *   Información del profesorado/plan de estudio de destino (`profesorado_destino`, `plan_destino`).
    *   Detalles de la institución de origen (`profesorado_origen_nombre`, `establecimiento_origen`, etc.).
*   **Materias Solicitadas (`PedidoEquivalenciaMateria`):** Cada solicitud incluye una o varias entradas de `PedidoEquivalenciaMateria`, que especifican las materias cursadas en la institución de origen para las cuales se pide la equivalencia, incluyendo su nombre, formato, año de cursada y nota.
*   **Estado Inicial:** El `workflow_estado` de un nuevo `PedidoEquivalencia` comienza como `BORRADOR`.

---

## 3. Seguimiento y Flujo de Trabajo

El `PedidoEquivalencia` tiene un flujo de trabajo detallado que se gestiona a través del campo `workflow_estado`:

*   **`BORRADOR`:** Estado inicial de la solicitud.
*   **`PENDIENTE_DOCUMENTACION`:** La solicitud está esperando que el estudiante presente la documentación requerida. Se pueden registrar detalles de la documentación (`documentacion_presentada`, `documentacion_detalle`, `documentacion_registrada_por`, `documentacion_registrada_en`).
*   **`EN_EVALUACION`:** La solicitud está siendo revisada por el personal académico. Se registran observaciones de la evaluación (`evaluacion_observaciones`, `evaluacion_registrada_por`, `evaluacion_registrada_en`).
*   **`EN_TITULOS`:** La solicitud está en el departamento de títulos o registros para la emisión de la documentación formal. Se capturan detalles administrativos como tipo de documento (`titulos_documento_tipo`), número de nota/disposición y fechas.
*   **`NOTIFICADO`:** Se ha comunicado el resultado final de la equivalencia al estudiante (`notificado_por`, `notificado_en`).
*   **Bloqueo de Edición:** Los campos `bloqueado_por` y `bloqueado_en` indican si un usuario ha bloqueado la edición del pedido, posiblemente durante una fase de revisión activa, para evitar modificaciones concurrentes.

---

## 4. Finalización de la Equivalencia

La finalización del proceso de equivalencia implica la determinación de un resultado y su registro formal.

### A. Resolución del `PedidoEquivalencia`

*   **Resultado Final (`resultado_final`):** Se establece el resultado final de la solicitud: `OTORGADA` (totalmente), `DENEGADA` (totalmente), `MIXTA` (parcialmente) o `PENDIENTE`.
*   **Estado Terminal (`estado`):** El `estado` del `PedidoEquivalencia` cambia a `FINALIZADO` una vez que se ha resuelto y registrado adecuadamente. La propiedad `esta_finalizado` refleja este estado.

### B. Registro Formal: `EquivalenciaDisposicion` y `EquivalenciaDisposicionDetalle`

*   **Acto Administrativo:** Si se otorga la equivalencia (total o parcialmente), se crea un registro `EquivalenciaDisposicion`. Este modelo documenta el acto administrativo (disposición o resolución) que oficializa la equivalencia, incluyendo:
    *   `origen` (ej. `primera_carga`, `secretaria`).
    *   El estudiante, profesorado y plan afectados.
    *   El `numero_disposicion` y `fecha_disposicion` del documento oficial.
*   **Materias Reconocidas:** Para cada materia que recibe equivalencia, se crea una instancia de `EquivalenciaDisposicionDetalle`. Esta entrada vincula la `EquivalenciaDisposicion` con la `Materia` específica del plan de destino y registra la `nota` de equivalencia y observaciones.

### C. Impacto en el Registro del Estudiante

*   La creación de los registros `EquivalenciaDisposicion` y `EquivalenciaDisposicionDetalle` constituye el historial formal de las equivalencias otorgadas a un estudiante.
*   Esto implica que las materias correspondientes en el plan de estudio del estudiante se consideran aprobadas. Aunque los modelos analizados no muestran el mecanismo de actualización directo en las `InscripcionMateriaAlumno` o `Regularidad` del estudiante, estos registros servirían como la base para que el sistema marque las materias como cumplidas.

---

## 5. Roles y Permisos

*   **Estudiantes:** Inician el `PedidoEquivalencia` (posiblemente a través de un panel de usuario).
*   **Roles Administrativos (`admin`, `secretaria`):** Se infiere que son los principales responsables de gestionar el flujo de trabajo de `PedidoEquivalencia`, actualizando sus estados, registrando documentación, observaciones de evaluación y detalles de disposición. También gestionarían las `EquivalenciaCurricular` (preestablecidas) y las `VentanaHabilitacion` relevantes.

---
