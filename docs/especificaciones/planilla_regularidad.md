# Proceso y Excepciones en la Planilla de Regularidad

Este documento detalla el funcionamiento de la "Planilla de Regularidad", el formulario utilizado para registrar el estado académico final de los estudiantes que cursaron una materia.

---

## 1. Flujo General

1.  **Selección:** Un usuario (docente o administrativo) selecciona una `Comision` o un grupo de "alumnos sin comisión" de una materia y año específicos.
2.  **Carga de Datos:** El sistema llama al endpoint `GET /regularidad`. Este carga la lista de todos los estudiantes formalmente inscriptos en esa cursada (`InscripcionMateriaAlumno`) y sus datos de regularidad existentes (si los hubiera).
3.  **Edición:** El usuario completa o modifica los siguientes campos para cada estudiante en la planilla:
    *   Nota de Trabajos Prácticos (TP).
    *   Nota Final de Cursada.
    *   Porcentaje de Asistencia.
    *   **Situación Académica** (un menú desplegable con opciones como REGULAR, PROMOCIONADO, LIBRE-I, etc.).
    *   Un checkbox de **Excepción**.
    *   Observaciones individuales.
4.  **Guardado:** Al guardar, se llama al endpoint `POST /regularidad`. El backend procesa cada fila y actualiza o crea un registro en el modelo `Regularidad` para cada estudiante.
5.  **Cierre:** Un usuario con permisos puede "cerrar" la planilla a través de `POST /regularidad/cierre`. Esto la convierte en un registro final y la bloquea.

---

## 2. Reglas y Excepciones

Estas son las condiciones y validaciones que el sistema aplica durante el proceso de guardado.

### Excepción 1: Planilla Cerrada (Bloqueada)

*   **Regla:** Una vez que la planilla ha sido "cerrada", ya no puede ser modificada por usuarios estándar (ej. docentes).
*   **Excepción:** Los usuarios con roles privilegiados (**secretaria**, **admin**, o superusuarios) **pueden** modificar una planilla aunque esté cerrada. Para un usuario sin estos permisos, el sistema devuelve un error `403 Prohibido` y la interfaz se muestra en modo de solo lectura.

### Excepción 2: Materias EDI y Curso Introductorio

*   **Regla:** Existe una validación específica para las materias de tipo "EDI" (Espacio de Definición Institucional).
*   **Excepción:** Si un estudiante está cursando una materia EDI pero **no tiene aprobado el curso introductorio** (según su `PreinscripcionChecklist`), el sistema **impide** que se le asigne una situación de `REGULAR`, `PROMOCIONADO` o `APROBADO`. El estado debe ser otro, como "Condicional".

### Excepción 3: El Checkbox "Excepción"

*   **Regla:** Cada estudiante en la planilla tiene un checkbox de "Excepción". Este valor booleano (`true`/`false`) se guarda en el registro de `Regularidad` del alumno.
*   **Excepción:** La lógica de la planilla de regularidad **no cambia su comportamiento** basado en este flag; simplemente lo almacena. Su propósito es ser utilizado por **otras partes del sistema**. Por ejemplo, el módulo de inscripción a mesas de examen podría leer este flag para permitir que un alumno se inscriba a un final aunque su situación no sea "Regular".

### Otras Reglas de Negocio Importantes

*   **Situación Obligatoria:** Es mandatorio seleccionar una "Situación" académica para **todos** los estudiantes de la lista. El sistema no permite guardar la planilla si a algún alumno le falta este dato.
*   **Condición de Promoción:** Para asignar la situación `PROMOCION`, el valor en el campo "Nota Final" debe ser **mayor o igual a 8**.
*   **Validez de la Situación:** La situación académica elegida debe ser compatible con el "formato" de la materia (Asignatura, Taller, etc.). Por ejemplo, "APROBADO" es una situación válida para un Taller, pero no necesariamente para una Asignatura con examen final.
*   **Fuente de Alumnos:** La lista de estudiantes es fija y se basa en las inscripciones formales a la cursada. No es posible añadir o quitar alumnos directamente desde la planilla.
