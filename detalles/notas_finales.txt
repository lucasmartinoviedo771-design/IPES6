# Proceso de Notas Finales

Este documento aborda las preguntas clave sobre el proceso de mesas de examen y notas finales, incluyendo requisitos, validaciones y roles involucrados.

---

## 1. Requisitos para Inscribirse a un Final

Para que un estudiante pueda inscribirse a una mesa de examen (mediante el endpoint `POST /inscribir_mesa`), se deben cumplir varias condiciones:

*   **Mesa de Examen Existente:** La `MesaExamen` a la que se desea inscribir debe existir en el sistema.
*   **Identificación del Estudiante:** El estudiante debe estar autenticado o su DNI debe ser proporcionado por un usuario con permisos.
*   **Cupo Disponible:** Si la mesa tiene un `cupo` definido, el número de inscripciones activas a esa mesa no debe excederlo.
*   **Validaciones para Mesas "Ordinarias" (Tipo `FINAL` o `ESPECIAL`):**
    *   **Estado del Legajo:** El `estado_legajo` del estudiante debe ser **`COMPLETO`**.
        *   **Nota:** La excepción que permitía la inscripción con `certificado_titulo_en_tramite` ha sido **eliminada**.
    *   **Regularidad Vigente en la Materia:**
        *   El estudiante debe poseer una `Regularidad` activa para la materia del examen, con `situacion` igual a `REGULAR`.
        *   La fecha del examen no debe exceder la vigencia de la regularidad (2 años desde `fecha_cierre` o hasta el primer llamado ordinario posterior si lo hubiera).
        *   El estudiante no debe haber utilizado 3 intentos de examen (a través de `InscripcionMesa`) para esa materia dentro del período de vigencia de su regularidad.
        *   **Nota:** Si la materia ya está `PROMOCIONADO` o `APROBADO`, el sistema indicará que no requiere final.
    *   **Correlatividades Aprobadas para Rendir:** El estudiante debe tener aprobadas (con `situacion` `APROBADO` o `PROMOCIONADO`) todas las materias que sean correlativas de tipo `APROBADA_PARA_RENDIR` para la materia del examen.
*   **Mesas "Libres" (`modalidad == MesaExamen.Modalidad.LIBRE`):**
    *   El endpoint `inscribir_mesa` **no aplica validaciones de regularidad ni legajo** para mesas con modalidad `LIBRE`; solo valida `MESA_TIPOS_ORDINARIOS`. Esto sugiere que la inscripción a mesas libres se gestiona bajo un conjunto de reglas diferente que no exige regularidad, o mediante otro proceso de inscripción que no fue analizado en este endpoint.

---

## 2. Causas por las que se me cae una Regularidad

La regularidad de un estudiante para una materia se considera caducada o "caída" en los siguientes casos, determinados por la función `_calcular_vigencia_regularidad` y las validaciones en `inscribir_mesa`:

1.  **Vencimiento Básico:** Han transcurrido **2 años** desde la `fecha_cierre` de la regularidad.
2.  **Límite Extendido por Llamado:** Si después de esos 2 años, no ha habido ningún llamado a examen "ordinario" (`FINAL` o `ESPECIAL`) para esa materia, la regularidad caduca. En caso de haber un llamado posterior, la vigencia se extiende hasta la fecha de ese *primer llamado ordinario* posterior a los 2 años.
3.  **Fecha del Examen Posterior al Límite:** La fecha de la `MesaExamen` a la que se intenta inscribir es posterior a la fecha máxima de vigencia calculada.
4.  **Exceso de Intentos:** El estudiante ya ha utilizado **3 intentos de inscripción a examen** para esa materia dentro del período de vigencia de su regularidad.

---

## 3. Aprobación y Gestión de Actas (Notas Finales)

#### A. Completar la Planilla de Mesa (Carga de Notas Individuales)

*   **Proceso:** Un usuario autorizado (docente o administrativo) accede a la planilla de una mesa específica a través del endpoint `GET /mesas/{mesa_id}/planilla`. Aquí se listan los estudiantes inscriptos, y para cada uno se pueden cargar/modificar la `condicion` (APROBADO, DESAPROBADO, AUSENTE, AUSENTE_JUSTIFICADO), `nota`, `folio`, `libro`, `fecha_resultado` y `observaciones`. Los cambios se guardan con `POST /mesas/{mesa_id}/planilla` (`actualizar_mesa_planilla`).
*   **Quiénes pueden completar/modificar:**
    *   **Personal Administrativo:** Usuarios con roles `admin`, `secretaria`, `bedel`.
    *   **Docentes del Tribunal:** Cualquier docente que figure como `docente_presidente`, `docente_vocal1` o `docente_vocal2` en la `MesaExamen`.
*   **Cuándo pueden modificar:**
    *   Pueden modificar mientras la planilla **no esté cerrada**.
    *   Si la planilla está cerrada, **solo `admin` o `secretaria`** tienen la capacidad de modificarla (ya sea reabriéndola para edición, o directamente si poseen los permisos de anulación del bloqueo).

#### B. Generación del Acta de Examen (Documento Formal)

*   **Proceso:** Una vez cargadas las calificaciones individuales en la planilla de mesa, se genera el documento formal del Acta de Examen. Esto se realiza a través del endpoint `POST /actas` (`crear_acta_examen` en `carga_notas_api.py`). Este endpoint toma un payload con los datos de la mesa, el tribunal y los resultados definitivos de los alumnos.
*   **Quiénes pueden completar las Actas:** No hay una verificación de rol explícita en el endpoint `crear_acta_examen`, pero el acceso a este proceso se infiere que está restringido a roles administrativos (`admin`, `secretaria`, bedeles) que operarían desde una interfaz de usuario protegida.
*   **Modificación de Actas:** El endpoint `crear_acta_examen` es exclusivamente para *crear* nuevas actas. No existe un endpoint directo para modificar actas *una vez creadas* con la lógica analizada. Cualquier corrección a un acta ya generada probablemente implicaría un proceso administrativo separado (ej. anulación y recreación o rectificación formal).

---

## 4. Cierre de la Planilla de Examen (Actas)

*   **Mecanismo de Cierre:** Sí, existe un mecanismo para cerrar las planillas de examen asociadas a una `MesaExamen`. Esto se gestiona a través del endpoint `POST /mesas/{mesa_id}/planilla/cierre` (`gestionar_mesa_planilla_cierre`).
*   **Quiénes pueden cerrar:** `admin`, `secretaria`, `bedel`, o cualquier `docente` que forme parte del tribunal de la mesa.
*   **Quiénes pueden reabrir:** **Solo** `admin` o `secretaria` pueden reabrir una planilla que ha sido cerrada.
*   **Efecto del Cierre:** Una vez cerrada, la planilla no puede ser modificada por los docentes del tribunal ni por bedeles. Para realizar cambios, un `admin` o `secretaria` debe reabrirla.

---

## 5. Manejo de Aprobados

### A. Aprobados en Regularidades (`Regularidad.situacion`)

*   **Valores que indican "cursada aprobada":**
    *   `PROMOCIONADO`: El estudiante ha aprobado la cursada por promoción directa.
    *   `APROBADO`: Cursada aprobada (generalmente para formatos tipo Taller que no tienen examen final).
    *   `REGULAR`: Cursada aprobada, lo que habilita al estudiante a rendir el examen final.
*   **Criterio:** La situación se asigna en base a la `nota_final_cursada`, `asistencia_porcentaje` y el formato de la materia (definido en las lógicas de `_situaciones_para_formato` dentro de `carga_notas_api.py`). Por ejemplo, la promoción requiere usualmente una nota `>= 8`.

### B. Aprobados en Finales (`InscripcionMesa.condicion` / `ActaExamenAlumno.calificacion_definitiva`)

*   **Valor de "Aprobado":**
    *   En la planilla de mesa (`InscripcionMesa`): `InscripcionMesa.Condicion.APROBADO`.
    *   En el acta formal (`ActaExamenAlumno`): Una `calificacion_definitiva` numérica que, según la función `_clasificar_resultado`, es `>= 6`.
*   **Criterio:** Calificación numérica obtenida en el examen final, que debe ser mayor o igual a 6.

### C. Rendir Final sin Regularidad

*   **Para Mesas "Ordinarias" (`FINAL`, `ESPECIAL`):**
    *   **No se permite si la materia ya está `PROMOCIONADO` o `APROBADO`**.
    *   **No se permite si la `situacion` no es `REGULAR`** o si la regularidad no está vigente.
*   **Para Mesas "Libres" (`modalidad == MesaExamen.Modalidad.LIBRE`):**
    *   La lógica analizada en el endpoint `inscribir_mesa` no aplica validaciones de regularidad para mesas con modalidad `LIBRE`. Esto sugiere que **sí se permite rendir un final sin regularidad si la mesa es de modalidad "Libre"**, y que las validaciones son diferentes (o menos estrictas) para estas mesas, gestionándose posiblemente a través de otra funcionalidad no analizada en profundidad aquí.

---