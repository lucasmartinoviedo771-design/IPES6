# Reglas de Negocio IPES6

Este documento detalla el funcionamiento interno y las reglas de negocio de los módulos clave del sistema.

## 1. Preinscripciones de Alumnos

Un aspirante NO puede inscribirse si se cumple alguna de las siguientes condiciones:
- **Falla Anti-Spam**: reCAPTCHA fallido o bot detectado (campo honeypot).
- **Datos Inválidos**: Falta de campos obligatorios (DNI, nombre, apellido, carrera) o formato incorrecto.
- **Carrera Deshabilitada**: El campo `inscripcion_abierta` está en `False`.
- **Inscripción Duplicada**: Un alumno no puede tener más de una preinscripción para la misma carrera en el mismo año académico (actualización permitida).

## 2. Inscripción a Materias

- **Condición**: El alumno debe estar registrado y tener la carrera asignada.
- **Correlatividades**: Se verifica si el alumno cumple con los requisitos del plan de estudios (aprobaciones previas).
- **Asignación de Comisiones**: Si hay cupos limitados, se aplica la prioridad definida. Durante el período de "cambio de comisión", el alumno puede solicitarlo sujeto a aprobación de tutoría.

## 3. Confirmación de Inscripciones

- **Bedelía**: El perfil de Bedelía valida la documentación presentada (DNI, Título Secundario).
- **Estado**: Al confirmar, el preinscrito pasa a ser alumno regular con legajo activo. Se genera automáticamente el PDF de confirmación.

## 4. Planilla de Regularidad (Mantenimiento)

- **Carga de Notas**: Se validan los rangos permitidos (0-10 o aprobación conceptual).
- **Asistencia**: Se calcula el porcentaje automático basado en las faltas cargadas vs. el total de clases.
- **Persistencia**: Al guardar una planilla, se pueden "mantener" los alumnos para la carga de la siguiente materia de la misma comisión.

## 5. Equivalencias y Títulos

- **Equivalencias**: Se registran las resoluciones de equivalencia otorgadas. Estas se computan para el analítico como materias aprobadas.
- **Analíticos**: Los pedidos de analíticos recorren la trayectoria completa (notas finales + equivalencias + mesas de examen).

---
*Para detalles técnicos de la implementación, consulte DOCUMENTACION_TECNICA.md.*
