# 📖 Diccionario de Datos - IPES6

Este documento describe las entidades principales del Sistema de Gestión Académica del IPES Paulo Freire y sus relaciones core.

---

## 👥 Entidades de Personas y Usuarios

### 1. `Persona`
Es la entidad base para cualquier individuo en el sistema (Estudiantes, Docentes, Staff).
- **dni**: Identificador único (DNI/Pasaporte).
- **cuil**: CUIL del individuo.
- **nombre / apellido**: Datos filiatorios básicos.
- **email / telefono**: Datos de contacto.
- **genero**: M (Masculino), F (Femenino), X (No binario).
- **domicilio / localidad / provincia**: Datos de residencia.

### 2. `Estudiante`
Extiende a `Persona` con datos específicos de la vida académica del alumno.
- **legajo**: Número de legajo único.
- **estado_legajo**: COM (Completo), INC (Incompleto), PEN (Pendiente).
- **anio_ingreso**: Año calendario de ingreso.
- **curso_introductorio_aprobado**: Booleano de estado.
- **documentacion_presentada**: Relación con los documentos físicos entregados.

### 3. `Docente`
Vincula una `Persona` con roles de enseñanza en materias y actas.

---

## 📚 Entidades Académicas (Carreras y Planes)

### 4. `Profesorado` (Carrera)
Representa una oferta académica institucional.
- **nombre**: Título de la carrera.
- **duracion_anios**: Cantidad de años del plan.
- **activo / inscripcion_abierta**: Estados administrativos.

### 5. `PlanDeEstudio`
Estructura curricular de un profesorado bajo una resolución específica.
- **resolucion**: Normativa legal que lo sustenta.
- **vigente**: Booleano que indica si se permiten nuevas inscripciones.

### 6. `Materia`
Unidad pedagógica perteneciente a un plan de estudio.
- **anio_cursada**: (1°, 2°, 3°, 4° año).
- **formato**: Asignatura, Taller, Seminario, Práctica, etc.
- **regimen**: Anual, 1° Cuatrimestre, 2° Cuatrimestre.
- **tipo_formacion**: General, Específica o Práctica Docente.

---

## 🔗 Relaciones y Lógica de Negocio

### 7. `Correlatividad`
Define los requisitos previos para cursar o rendir una materia.
- **Tipos**: Regular para Cursar, Aprobada para Cursar, Aprobada para Rendir.

### 8. `InscripcionMateria`
Vincula a un `Estudiante` con una `Materia` en un ciclo lectivo determinado.

---
**Nota:** El sistema utiliza Django ORM para la gestión de estas entidades, asegurando integridad referencial en MariaDB/MySQL.
