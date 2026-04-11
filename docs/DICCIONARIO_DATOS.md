# Diccionario de Datos — IPES6

**Base de datos:** `ipes6` (MySQL 8.0, puerto local 3307)  
**Backend:** Django — Python  
**Última actualización:** 2026-04-10

---

## Índice de Módulos

1. [Personas y Usuarios](#1-personas-y-usuarios)
2. [Carreras y Planes de Estudio](#2-carreras-y-planes-de-estudio)
3. [Estudiantes](#3-estudiantes)
4. [Horarios y Comisiones](#4-horarios-y-comisiones)
5. [Preinscripciones](#5-preinscripciones)
6. [Inscripciones a Materias](#6-inscripciones-a-materias)
7. [Curso Introductorio](#7-curso-introductorio)
8. [Mesas de Examen](#8-mesas-de-examen)
9. [Regularidades y Planillas](#9-regularidades-y-planillas)
10. [Actas de Examen](#10-actas-de-examen)
11. [Pedidos (Analíticos y Equivalencias)](#11-pedidos-analíticos-y-equivalencias)
12. [Asistencia](#12-asistencia)
13. [Mensajería](#13-mensajería)
14. [Auditoría y Logs](#14-auditoría-y-logs)
15. [Django / Auth (tablas del framework)](#15-django--auth-tablas-del-framework)
16. [Tablas de Perfilado (Silk)](#16-tablas-de-perfilado-silk)

---

## Convenciones

| Símbolo | Significado |
|---------|-------------|
| PK | Clave primaria |
| FK | Clave foránea |
| UQ | Valor único |
| NN | Not Null (obligatorio) |
| IDX | Columna indexada |

---

## 1. Personas y Usuarios

### `core_persona`

Datos personales compartidos por estudiantes, docentes y usuarios administrativos. Es la entidad central de identidad del sistema.

> **Señal automática:** Al guardar, sincroniza `auth_user.username` (con el DNI), `first_name` y `last_name`.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `dni` | varchar(20) | NN, UQ, IDX | Documento Nacional de Identidad. Se usa también como `username` en `auth_user` |
| `cuil` | varchar(20) | IDX, NULL | CUIL con formato `XX-XXXXXXXX-X` |
| `nombre` | varchar(150) | NN | Nombre/s de pila |
| `apellido` | varchar(150) | NN | Apellido/s |
| `email` | varchar(255) | NULL | Correo electrónico de contacto |
| `telefono` | varchar(50) | NULL | Teléfono principal |
| `telefono_emergencia` | varchar(50) | NULL | Teléfono de contacto de emergencia |
| `parentesco_emergencia` | varchar(100) | NULL | Parentesco del contacto de emergencia |
| `fecha_nacimiento` | date | NULL | Fecha de nacimiento |
| `genero` | varchar(1) | NULL | `M`=Masculino · `F`=Femenino · `X`=No binario/Otro |
| `nacionalidad` | varchar(100) | NULL | Default: `Argentina` |
| `domicilio` | varchar(255) | NULL | Dirección de residencia |
| `localidad` | varchar(150) | NULL | Localidad de residencia |
| `provincia` | varchar(150) | NULL | Default: `Tierra del Fuego` |
| `pais` | varchar(100) | NULL | Default: `Argentina` |
| `lugar_nacimiento` | varchar(255) | NULL | Lugar de nacimiento (texto libre) |
| `estado_civil` | varchar(3) | NULL | `SOL`=Soltero/a · `CAS`=Casado/a · `DIV`=Divorciado/a · `VIU`=Viudo/a · `CON`=Conviviente · `OTR`=Otro |
| `localidad_nac` | varchar(150) | NULL | Localidad de nacimiento |
| `provincia_nac` | varchar(150) | NULL | Provincia de nacimiento |
| `pais_nac` | varchar(150) | NULL | País de nacimiento |
| `created_at` | datetime(6) | NN | Fecha de creación del registro |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_docente`

Perfil de docente. No almacena datos personales propios; los delega a `core_persona`.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `persona_id` | bigint | FK → `core_persona`, UQ, NULL | Persona asociada al docente |

> Los campos `nombre`, `apellido`, `dni`, `email`, `telefono`, `cuil` y `fecha_nacimiento` son propiedades derivadas que se leen desde `core_persona`.

---

### `core_userprofile`

Extiende `auth_user` con datos específicos del sistema (forzar cambio de contraseña, credenciales temporales).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `user_id` | int | FK → `auth_user`, UQ, NN | Usuario de Django asociado |
| `persona_id` | bigint | FK → `core_persona`, UQ, NULL | Persona vinculada (puede ser nulo para superusers) |
| `must_change_password` | tinyint(1) | NN | Si `1`, el usuario debe cambiar contraseña en el próximo login |
| `temp_password` | varchar(128) | NULL | Contraseña temporal en texto plano (se borra tras primer login o envío) |
| `credentials_sent_at` | datetime(6) | NULL | Timestamp del último envío de credenciales por email |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

## 2. Carreras y Planes de Estudio

### `core_profesorado`

Carrera ofrecida por el instituto (ej. "Profesorado de Matemática").

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | int | PK, NN, AUTO | Identificador interno |
| `nombre` | varchar(255) | NN | Nombre completo de la carrera |
| `duracion_anios` | int | NN | Duración en años |
| `activo` | tinyint(1) | NN | Si `1`, la carrera está habilitada en el sistema |
| `inscripcion_abierta` | tinyint(1) | NN | Si `1`, acepta preinscripciones |
| `es_certificacion_docente` | tinyint(1) | NN | Si `1`, es un trayecto de certificación (requiere título terciario/universitario previo) |

---

### `core_plandeestudio`

Versión del plan curricular de una carrera, identificada por su resolución ministerial.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera a la que pertenece |
| `resolucion` | varchar(100) | UQ, NN | Número de resolución o normativa (ej. `"Res. 4145/11"`) |
| `anio_inicio` | int | NN | Año en que entró en vigencia |
| `anio_fin` | int | NULL | Año en que dejó de estar vigente. Nulo = sigue vigente |
| `vigente` | tinyint(1) | NN | Si `1`, es el plan actualmente en uso |

---

### `core_materia`

Espacio curricular dentro de un plan de estudio.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `plan_de_estudio_id` | bigint | FK → `core_plandeestudio`, NN | Plan al que pertenece |
| `nombre` | varchar(255) | NN | Nombre de la materia |
| `anio_cursada` | int | NN | Año de la carrera (1, 2, 3, 4…) |
| `horas_semana` | int | NN | Carga horaria semanal (hs) |
| `formato` | varchar(3) | NN | `ASI`=Asignatura · `PRA`=Práctica · `MOD`=Módulo · `TAL`=Taller · `LAB`=Laboratorio · `SEM`=Seminario |
| `regimen` | varchar(3) | NN | `ANU`=Anual · `PCU`=Primer Cuatrimestre · `SCU`=Segundo Cuatrimestre |
| `tipo_formacion` | varchar(3) | NN | `FGN`=Formación General · `FES`=Formación Específica · `PDC`=Práctica Docente |
| `is_edi` | tinyint(1) | NN | Si `1`, es un Espacio de Definición Institucional (EDI) |
| `fecha_inicio` | date | NULL | Fecha de inicio de vigencia del EDI |
| `fecha_fin` | date | NULL | Fecha de fin de vigencia del EDI. Nulo = activo |

**Restricción única:** `(plan_de_estudio, anio_cursada, nombre, regimen, fecha_inicio)`  
> **Regla de integridad:** El sistema valida por software que no existan materias EDI con el mismo nombre y plan cuyos rangos de fecha (`inicio` - `fin`) se solapen.

---

### `core_correlatividad`

Requisito de correlatividad entre dos materias de un plan.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `materia_origen_id` | bigint | FK → `core_materia`, NN | Materia que exige la correlativa (ej. Didáctica II) |
| `materia_correlativa_id` | bigint | FK → `core_materia`, NN | Materia que debe estar aprobada/regularizada (ej. Pedagogía) |
| `tipo` | varchar(3) | NN | `RPC`=Regular para Cursar · `APC`=Aprobada para Cursar · `APR`=Aprobada para Rendir Final |

**Restricción única:** `(materia_origen, materia_correlativa, tipo)`

---

### `core_correlatividadversion`

Versión de una planilla de correlatividades, aplicable a un rango de cohortes.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `plan_de_estudio_id` | bigint | FK → `core_plandeestudio`, NN | Plan al que aplica |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera a la que aplica |
| `nombre` | varchar(255) | NN | Etiqueta identificadora (ej. `"Default 2023+"`) |
| `descripcion` | longtext | NN | Descripción extendida |
| `cohorte_desde` | int unsigned | NN | Año de cohorte inicial (inclusive) |
| `cohorte_hasta` | int unsigned | NULL | Año de cohorte final (inclusive). Nulo = aplica en adelante |
| `vigencia_desde` | date | NULL | Fecha de inicio de vigencia |
| `vigencia_hasta` | date | NULL | Fecha de fin de vigencia |
| `activo` | tinyint(1) | NN | Si `1`, esta versión está activa |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(plan_de_estudio, nombre)`

---

### `core_correlatividadversiondetalle`

Línea de detalle que asocia una correlatividad específica a una versión.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `version_id` | bigint | FK → `core_correlatividadversion`, NN | Versión a la que pertenece |
| `correlatividad_id` | bigint | FK → `core_correlatividad`, NN | Regla de correlatividad incluida |
| `created_at` | datetime(6) | NN | Fecha de creación |

**Restricción única:** `(version, correlatividad)`

---

### `core_documento`

Tipos de documentos requeridos al estudiante para completar su legajo.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `nombre` | varchar(255) | UQ, NN | Nombre del documento (ej. `"DNI legalizado"`) |
| `obligatorio` | tinyint(1) | NN | Si `1`, es obligatorio para completar el legajo |

---

## 3. Estudiantes

### `core_estudiante`

Perfil académico-administrativo del estudiante. Sus datos personales viven en `core_persona`.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `user_id` | int | FK → `auth_user`, UQ, NN | Usuario de acceso al sistema |
| `persona_id` | bigint | FK → `core_persona`, UQ, NULL | Datos personales vinculados |
| `legajo` | varchar(20) | UQ, NULL | Número de legajo único (asignado por secretaría) |
| `estado_legajo` | varchar(3) | NN | `COM`=Completo · `INC`=Incompleto/Condicional · `PEN`=Pendiente de Revisión |
| `must_change_password` | tinyint(1) | NN | Si `1`, debe cambiar contraseña en el próximo login |
| `curso_introductorio_aprobado` | tinyint(1) | NN | Si `1`, tiene el Curso Introductorio aprobado |
| `anio_ingreso` | int | NULL | Año de ingreso al instituto |
| `cohorte` | varchar(50) | NULL | Identificador de cohorte (texto libre) |
| `observaciones` | longtext | NULL | Notas internas del personal administrativo |
| `libreta_entregada` | tinyint(1) | NN | Si `1`, se entregó la libreta universitaria |
| `sec_titulo` | varchar(255) | NULL | Título del nivel secundario |
| `sec_establecimiento` | varchar(255) | NULL | Establecimiento donde cursó el secundario |
| `sec_fecha_egreso` | varchar(100) | NULL | Fecha de egreso secundario (texto libre) |
| `sec_localidad` | varchar(150) | NULL | Localidad del establecimiento secundario |
| `sec_provincia` | varchar(150) | NULL | Provincia del establecimiento secundario |
| `sec_pais` | varchar(100) | NULL | País del establecimiento secundario |
| `trabaja` | tinyint(1) | NN | Si `1`, el estudiante trabaja actualmente |
| `empleador` | varchar(255) | NULL | Nombre del empleador |
| `horario_trabajo` | varchar(255) | NULL | Horario laboral |
| `domicilio_trabajo` | varchar(255) | NULL | Dirección del lugar de trabajo |
| `cud_informado` | tinyint(1) | NN | Si `1`, informó Certificado Único de Discapacidad (CUD) |
| `condicion_salud_informada` | tinyint(1) | NN | Si `1`, declaró alguna condición de salud relevante |
| `condicion_salud_detalle` | longtext | NULL | Detalle de la condición de salud informada |
| `dni_legalizado` | tinyint(1) | NN | Flag: DNI legalizado entregado |
| `fotos_4x4` | tinyint(1) | NN | Flag: fotos carnet 4×4 entregadas |
| `certificado_salud` | tinyint(1) | NN | Flag: certificado de salud entregado |
| `folios_oficio` | int | NN | Cantidad de folios de oficio entregados |
| `titulo_secundario_legalizado` | tinyint(1) | NN | Flag: título secundario legalizado entregado |
| `certificado_titulo_en_tramite` | tinyint(1) | NN | Flag: certificado de título en trámite |
| `analitico_legalizado` | tinyint(1) | NN | Flag: analítico legalizado entregado |
| `articulo_7` | tinyint(1) | NN | Flag: habilitado por Art. 7 (mayor de 25 sin título secundario) |
| `datos_extra` | json | NN | Datos adicionales no estructurados |

**Tabla M2M:** `core_estudiante_documentacion_presentada` → vincula con `core_documento`

---

### `core_estudiante_documentacion_presentada`

Tabla intermedia M2M: documentos presentados por un estudiante.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante |
| `documento_id` | bigint | FK → `core_documento`, NN | Documento presentado |

---

### `core_estudiantecarrera`

Inscripción de un estudiante a una carrera específica, con su estado académico.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera |
| `anio_ingreso` | int unsigned | NULL | Año de ingreso/cohorte en esta carrera |
| `cohorte` | varchar(32) | NN | Identificador de cohorte |
| `estado_academico` | varchar(3) | NN | `ACT`=Activo · `BAJ`=Baja/Abandono · `EGR`=Egresado · `SUS`=Suspendido · `INA`=Inactivo |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(estudiante, profesorado)`

---

## 4. Horarios y Comisiones

### `core_turno`

Turno académico (Mañana, Tarde, Noche).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `nombre` | varchar(50) | UQ, NN | Nombre del turno (ej. `"Mañana"`, `"Tarde"`, `"Noche"`) |

---

### `core_bloque`

Bloque horario dentro de un turno (período con hora de inicio y fin).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `turno_id` | bigint | FK → `core_turno`, NN | Turno al que pertenece |
| `dia` | int | NN | `1`=Lunes · `2`=Martes · `3`=Miércoles · `4`=Jueves · `5`=Viernes · `6`=Sábado |
| `hora_desde` | time | NN | Hora de inicio del bloque |
| `hora_hasta` | time | NN | Hora de fin del bloque |
| `es_recreo` | tinyint(1) | NN | Si `1`, es un bloque de recreo (sin clase) |

**Restricción única:** `(turno, dia, hora_desde, hora_hasta)`

---

### `core_horariocatedra`

Horario anual de una cátedra (materia + turno + año lectivo).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `espacio_id` | bigint | FK → `core_materia`, NN | Materia / espacio curricular |
| `turno_id` | bigint | FK → `core_turno`, NN | Turno en que se dicta |
| `anio_academico` | int | NN | Año académico (ej. `2025`) |
| `cuatrimestre` | varchar(3) | NULL | `PCU`=Primer Cuatrimestre · `SCU`=Segundo Cuatrimestre. Nulo si es anual |

**Restricción única:** `(espacio, turno, anio_academico, cuatrimestre)`

---

### `core_horariocatedradetalle`

Bloques asignados a un horario de cátedra.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `horario_catedra_id` | bigint | FK → `core_horariocatedra`, NN | Horario al que pertenece |
| `bloque_id` | bigint | FK → `core_bloque`, NN | Bloque horario asignado |

**Restricción única:** `(horario_catedra, bloque)`

---

### `core_comision`

Instancia concreta de una materia dictada en un año lectivo por un docente.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia dictada |
| `anio_lectivo` | int | NN | Año académico en que se dicta |
| `codigo` | varchar(32) | NN | Código identificador (ej. `"2025-MAT1-M"`) |
| `turno_id` | bigint | FK → `core_turno`, NN | Turno del dictado |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente a cargo |
| `horario_id` | bigint | FK → `core_horariocatedra`, NULL | Horario asignado |
| `cupo_maximo` | int | NULL | Cupo máximo de inscriptos. Nulo = sin límite |
| `estado` | varchar(3) | NN | `ABI`=Abierta · `CER`=Cerrada · `SUS`=Suspendida · `LIC`=En Licencia |
| `rol` | varchar(3) | NN | `TIT`=Titular · `INT`=Interino · `SUP`=Suplente |
| `orden` | int unsigned | NN | Orden de jerarquía/suplencia (1 = principal) |
| `observaciones` | varchar(255) | NULL | Notas internas |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(materia, anio_lectivo, codigo, docente, rol, orden)`

---

### `core_staffasignacion`

Asignación de un usuario administrativo (bedel, coordinador, tutor) a una carrera.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `user_id` | int | FK → `auth_user`, NN | Usuario del staff |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera asignada |
| `rol` | varchar(20) | NN | `bedel` · `coordinador` · `tutor` · `curso_intro` |
| `created_at` | datetime(6) | NN | Fecha de asignación |

**Restricción única:** `(user, profesorado, rol)`

---

### `core_ventanahabilitacion`

Períodos de habilitación para distintos trámites del sistema.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `tipo` | varchar(32) | NN | `INSCRIPCION` · `MESAS_FINALES` · `MESAS_EXTRA` · `MATERIAS` · `CARRERAS` · `COMISION` · `ANALITICOS` · `EQUIVALENCIAS` · `PREINSCRIPCION` · `CURSO_INTRODUCTORIO` · `CALENDARIO_CUATRIMESTRE` |
| `desde` | date | NN | Fecha de inicio de la habilitación |
| `hasta` | date | NN | Fecha de fin de la habilitación |
| `activo` | tinyint(1) | NN | Si `1`, la ventana está actualmente activa |
| `periodo` | varchar(16) | NULL | Para inscripción a materias/calendario: `"1C_ANUALES"` · `"1C"` · `"2C"` |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

## 5. Preinscripciones

### `preinscripciones`

Solicitud de ingreso de un aspirante a una carrera para un año académico.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | int | PK, NN, AUTO | Identificador interno |
| `codigo` | varchar(30) | NN | Código único generado por el sistema |
| `estado` | varchar(15) | NN | `Enviada` · `Observada` · `Confirmada` · `Rechazada` · `Borrador` |
| `alumno_id` | bigint | FK → `core_estudiante`, NN | Estudiante que se preinscribe |
| `carrera_id` | int | FK → `core_profesorado`, NN | Carrera a la que se postula |
| `anio` | int | NN | Año académico de la preinscripción |
| `datos_extra` | json | NN | Datos adicionales del formulario en JSON |
| `activa` | tinyint(1) | NN | Si `1`, la preinscripción está vigente |
| `cuil` | varchar(13) | NULL | CUIL del aspirante (formato `XX-XXXXXXXX-X`) |
| `created_at` | datetime(6) | NULL | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(alumno, carrera, anio)`

---

### `core_preinscripcionchecklist`

Checklist administrativo de documentación para confirmar una preinscripción. El estado del legajo se calcula automáticamente.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `preinscripcion_id` | int | FK → `preinscripciones`, UQ, NN | Preinscripción asociada (relación 1:1) |
| `dni_legalizado` | tinyint(1) | NN | DNI legalizado presentado |
| `fotos_4x4` | tinyint(1) | NN | Fotos carnet 4×4 presentadas |
| `certificado_salud` | tinyint(1) | NN | Certificado de salud presentado |
| `folios_oficio` | tinyint(1) | NN | Folios de oficio presentados |
| `titulo_secundario_legalizado` | tinyint(1) | NN | Título secundario legalizado presentado |
| `certificado_titulo_en_tramite` | tinyint(1) | NN | Certificado de título en trámite presentado |
| `analitico_legalizado` | tinyint(1) | NN | Analítico legalizado presentado |
| `certificado_alumno_regular_sec` | tinyint(1) | NN | Certificado de alumno regular del secundario |
| `adeuda_materias` | tinyint(1) | NN | Si `1`, adeuda materias del secundario |
| `adeuda_materias_detalle` | longtext | NN | Detalle de materias adeudadas |
| `escuela_secundaria` | varchar(255) | NN | Nombre del establecimiento secundario |
| `es_certificacion_docente` | tinyint(1) | NN | Si `1`, es trayecto de certificación docente |
| `titulo_terciario_univ` | tinyint(1) | NN | Título terciario/universitario presentado |
| `incumbencia` | tinyint(1) | NN | Incumbencia presentada (para certificación) |
| `curso_introductorio_aprobado` | tinyint(1) | NN | Curso introductorio aprobado |
| `articulo_7` | tinyint(1) | NN | Habilitado por Art. 7 (mayor de 25 sin título secundario) |
| `estado_legajo` | varchar(3) | NN | Estado calculado: `COM`=Completo · `INC`=Incompleto · `PEN`=Pendiente. Se sincroniza automáticamente a `core_estudiante.estado_legajo` |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

> **Lógica de negocio:** Para ser `COM` se requiere: `dni_legalizado + certificado_salud + fotos_4x4 + folios_oficio` AND (`titulo_secundario_legalizado` OR `articulo_7`). Para certificación docente: los anteriores + `titulo_terciario_univ + incumbencia`.

---

### `core_requisitodocumentaciontemplate`

Plantilla maestra de requisito documental. Define los requisitos base que se instancian por carrera.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `codigo` | varchar(64) | UQ, NN | Código identificador del requisito |
| `titulo` | varchar(255) | NN | Nombre del requisito |
| `descripcion` | longtext | NN | Descripción detallada |
| `categoria` | varchar(5) | NN | `GEN`=Generales · `SEC`=Secundario · `COM`=Complementario · `FOTO`=Foto · `OTRO`=Otros |
| `obligatorio` | tinyint(1) | NN | Si `1`, es obligatorio por defecto |
| `orden` | int unsigned | NN | Orden de visualización |
| `activo` | tinyint(1) | NN | Si `1`, está disponible para su uso |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_profesoradorequisitodocumentacion`

Instancia de un requisito documental para una carrera específica. Puede personalizarse independientemente de la plantilla.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera a la que aplica |
| `template_id` | bigint | FK → `core_requisitodocumentaciontemplate`, NULL | Plantilla base |
| `codigo` | varchar(64) | NN | Código del requisito para esta carrera |
| `titulo` | varchar(255) | NN | Título visible del requisito |
| `descripcion` | longtext | NN | Descripción del requisito |
| `categoria` | varchar(5) | NN | `GEN` · `SEC` · `COM` · `FOTO` · `OTRO` |
| `obligatorio` | tinyint(1) | NN | Si `1`, es obligatorio para esta carrera |
| `orden` | int unsigned | NN | Orden de visualización |
| `activo` | tinyint(1) | NN | Si `1`, está activo |
| `personalizado` | tinyint(1) | NN | Si `1`, fue editado para esta carrera (no se sincroniza con la plantilla) |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(profesorado, codigo)`

---

### `core_preinscripcion_archivo`

Archivos adjuntos subidos durante el proceso de preinscripción.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `preinscripcion_id` | int | FK → `preinscripciones`, NN | Preinscripción a la que pertenece |
| `archivo` | varchar(255) | NN | Ruta relativa del archivo en el storage |
| `nombre_original` | varchar(255) | NN | Nombre original del archivo subido |
| `uploaded_at` | datetime(6) | NN | Fecha y hora de subida |

---

## 6. Inscripciones a Materias

### `core_inscripcionmateriaestudiante`

Inscripción anual de un estudiante a una materia/comisión.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante inscripto |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia a la que se inscribe |
| `comision_id` | bigint | FK → `core_comision`, NULL | Comisión asignada definitivamente |
| `comision_solicitada_id` | bigint | FK → `core_comision`, NULL | Comisión solicitada por el estudiante (puede diferir de la asignada) |
| `anio` | int | NN | Año lectivo de la inscripción |
| `estado` | varchar(4) | NN | `CONF`=Confirmada · `PEND`=Pendiente · `RECH`=Rechazada · `ANUL`=Anulada |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(estudiante, materia, anio)`  
**Índices:** `(estudiante, anio)`, `(estudiante, estado)`

---

### `core_equivalenciacurricular`

Grupo de materias equivalentes entre distintos profesorados/planes.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `codigo` | varchar(32) | UQ, NN | Código del grupo (ej. `"P101"`) |
| `nombre` | varchar(255) | NULL | Nombre descriptivo del grupo |

**Tabla M2M:** `core_equivalenciacurricular_materias` → vincula con `core_materia`

---

### `core_equivalenciacurricular_materias`

Tabla intermedia M2M: materias pertenecientes a un grupo de equivalencia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `equivalenciacurricular_id` | bigint | FK → `core_equivalenciacurricular`, NN | Grupo de equivalencia |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia incluida en el grupo |

---

## 7. Curso Introductorio

### `core_cursointroductoriocohorte`

Define una apertura del curso introductorio (por año, carrera y turno).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `nombre` | varchar(128) | NN | Nombre descriptivo. Si está vacío, se muestra como `"Cohorte YYYY"` |
| `anio_academico` | int | NN | Año académico |
| `profesorado_id` | int | FK → `core_profesorado`, NULL | Carrera. Nulo = curso general |
| `turno_id` | bigint | FK → `core_turno`, NULL | Turno. Nulo = aplica a todos |
| `ventana_inscripcion_id` | bigint | FK → `core_ventanahabilitacion`, NULL | Ventana de inscripción habilitada |
| `fecha_inicio` | date | NULL | Fecha de inicio del curso |
| `fecha_fin` | date | NULL | Fecha de fin del curso |
| `cupo` | int unsigned | NULL | Cupo máximo. Nulo = sin límite |
| `observaciones` | longtext | NN | Notas adicionales |
| `created_by_id` | int | FK → `auth_user`, NULL | Usuario que creó el registro |
| `updated_by_id` | int | FK → `auth_user`, NULL | Usuario que modificó el registro |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_cursointroductorioregistro`

Registro individual de un estudiante en una cohorte del curso introductorio.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `cohorte_id` | bigint | FK → `core_cursointroductoriocohorte`, NULL | Cohorte del curso |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante inscripto |
| `profesorado_id` | int | FK → `core_profesorado`, NULL | Carrera en la que se inscribe |
| `turno_id` | bigint | FK → `core_turno`, NULL | Turno del curso |
| `inscripto_en` | datetime(6) | NN | Fecha y hora de inscripción |
| `asistencias_totales` | int unsigned | NULL | Clases a las que asistió |
| `nota_final` | int | NULL | Nota final obtenida (Solo enteros) |
| `resultado` | varchar(3) | NN | `PEN`=Pendiente · `APR`=Aprobado · `DES`=Desaprobado · `AUS`=Ausente |
| `observaciones` | longtext | NN | Notas del resultado |
| `resultado_at` | datetime(6) | NULL | Fecha/hora en que se cargó el resultado |
| `resultado_por_id` | int | FK → `auth_user`, NULL | Usuario que registró el resultado |
| `es_historico` | tinyint(1) | NN | Si `1`, es un registro importado de años anteriores |

**Restricción única:** `(cohorte, estudiante)`

---

## 8. Mesas de Examen

### `core_mesaexamen`

Mesa de examen final (ordinaria, extraordinaria o especial) para una materia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia de la mesa |
| `tipo` | varchar(3) | NN | `FIN`=Ordinaria · `EXT`=Extraordinaria · `ESP`=Especial |
| `modalidad` | varchar(3) | NN | `REG`=Regular · `LIB`=Libre |
| `fecha` | date | NN | Fecha del examen |
| `hora_desde` | time | NULL | Hora de inicio |
| `hora_hasta` | time | NULL | Hora de fin |
| `aula` | varchar(64) | NULL | Aula asignada |
| `cupo` | int | NN | Cupo máximo (`0` = sin límite) |
| `ventana_id` | bigint | FK → `core_ventanahabilitacion`, NULL | Ventana de inscripción habilitada |
| `codigo` | varchar(40) | UQ, NULL | Código autogenerado: `MESA-YYYYMMDD-NNNNN` |
| `docente_presidente_id` | bigint | FK → `core_docente`, NULL | Docente presidente del tribunal |
| `docente_vocal1_id` | bigint | FK → `core_docente`, NULL | Vocal 1 del tribunal |
| `docente_vocal2_id` | bigint | FK → `core_docente`, NULL | Vocal 2 del tribunal |
| `planilla_cerrada_en` | datetime(6) | NULL | Fecha en que se cerró la planilla de resultados |
| `planilla_cerrada_por_id` | int | FK → `auth_user`, NULL | Usuario que cerró la planilla |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_inscripcionmesa`

Inscripción de un estudiante a una mesa de examen y su resultado final.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `mesa_id` | bigint | FK → `core_mesaexamen`, NN | Mesa a la que se inscribe |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante inscripto |
| `estado` | varchar(3) | NN | `INS`=Inscripto · `CAN`=Cancelado |
| `condicion` | varchar(3) | NULL | `APR`=Aprobado · `DES`=Desaprobado · `AUS`=Ausente · `AUJ`=Ausente Justificado |
| `nota` | int | NULL | Nota final obtenida (Solo enteros) |
| `fecha_resultado` | date | NULL | Fecha en que se registró el resultado |
| `folio` | varchar(32) | NULL | Folio del acta donde consta el resultado |
| `libro` | varchar(32) | NULL | Libro del acta |
| `observaciones` | longtext | NULL | Observaciones del resultado |
| `cuenta_para_intentos` | tinyint(1) | NN | Si `1`, esta inscripción cuenta como intento al rendir |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(mesa, estudiante)`

---

### `core_mesaactaoral`

Acta del examen oral para una inscripción a mesa específica.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `mesa_id` | bigint | FK → `core_mesaexamen`, NN | Mesa de examen |
| `inscripcion_id` | bigint | FK → `core_inscripcionmesa`, UQ, NN | Inscripción asociada (1:1) |
| `acta_numero` | varchar(64) | NN | Número de acta |
| `folio_numero` | varchar(64) | NN | Folio del acta |
| `fecha` | date | NULL | Fecha del examen oral |
| `curso` | varchar(128) | NN | Identificación del curso/comisión |
| `nota_final` | varchar(32) | NN | Nota final como texto |
| `observaciones` | longtext | NN | Observaciones del examen |
| `temas_alumno` | json | NN | Lista JSON de temas sorteados por el alumno |
| `temas_docente` | json | NN | Lista JSON de temas propuestos por el docente |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

## 9. Regularidades y Planillas

### `core_regularidad`

Resultado de cursada de un estudiante en una materia (cierre de año/cuatrimestre).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `inscripcion_id` | bigint | FK → `core_inscripcionmateriaestudiante`, NULL | Inscripción origen |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante evaluado |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia cursada |
| `fecha_cierre` | date | NN | Fecha de cierre de la cursada |
| `nota_trabajos_practicos` | int | NULL | Nota de trabajos prácticos |
| `nota_final_cursada` | int | NULL | Nota final de la cursada |
| `asistencia_porcentaje` | int | NULL | Porcentaje de asistencia (0–100) |
| `excepcion` | tinyint(1) | NN | Si `1`, se aplicó una excepción al criterio estándar |
| `situacion` | varchar(3) | NN | `PRO`=Promocionado · `REG`=Regular · `APR`=Aprobado sin final · `DPA`=Desaprobado por Parciales · `DTP`=Desaprobado por TPs · `LBI`=Libre por Inasistencias · `LAT`=Libre Antes de Tiempo |
| `observaciones` | longtext | NULL | Notas adicionales |
| `created_at` | datetime(6) | NN | Fecha de creación |

**Restricción única:** `(estudiante, materia, fecha_cierre)`

---

### `core_regularidadformato`

Define el tipo/formato de planilla de regularidad.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `slug` | varchar(32) | UQ, NN | Identificador en formato slug |
| `nombre` | varchar(64) | NN | Nombre legible |
| `descripcion` | longtext | NULL | Descripción del formato |
| `metadata` | json | NN | Configuración adicional en JSON |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_regularidadplantilla`

Plantilla de planilla de regularidad para un formato y régimen de dictado.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `formato_id` | bigint | FK → `core_regularidadformato`, NN | Formato al que pertenece |
| `dictado` | varchar(8) | NN | `ANUAL` · `1C`=Primer Cuatrimestre · `2C`=Segundo Cuatrimestre |
| `nombre` | varchar(128) | NN | Nombre de la plantilla |
| `descripcion` | longtext | NULL | Descripción |
| `columnas` | json | NN | Definición JSON de las columnas de la planilla |
| `situaciones` | json | NN | Situaciones académicas disponibles |
| `referencias` | json | NN | Referencias/notas al pie de la planilla |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(formato, dictado)`

---

### `core_planillaregularidad`

Planilla de regularidad emitida para una materia en un año académico (equivalente al libro de actas).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `codigo` | varchar(64) | UQ, NN | Código único de la planilla |
| `numero` | int unsigned | NN | Número correlativo |
| `anio_academico` | int | NN | Año lectivo |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia evaluada |
| `plantilla_id` | bigint | FK → `core_regularidadplantilla`, NN | Plantilla utilizada |
| `formato_id` | bigint | FK → `core_regularidadformato`, NN | Formato de la planilla |
| `dictado` | varchar(8) | NN | `ANUAL` · `1C` · `2C` |
| `plan_resolucion` | varchar(128) | NN | Resolución del plan (snapshot al momento de crear) |
| `folio` | varchar(32) | NN | Número de folio del libro |
| `fecha` | date | NN | Fecha de la planilla |
| `observaciones` | longtext | NN | Observaciones generales |
| `estado` | varchar(16) | NN | `draft`=Borrador · `final`=Finalizada |
| `datos_adicionales` | json | NN | Datos extra en JSON |
| `pdf` | varchar(255) | NULL | Ruta al archivo PDF generado |
| `created_by_id` | int | FK → `auth_user`, NULL | Usuario que creó la planilla |
| `updated_by_id` | int | FK → `auth_user`, NULL | Usuario que modificó la planilla |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Índices:** `(profesorado, anio_academico)`, `(materia, fecha)`

---

### `core_planillaregularidaddocente`

Docente firmante de una planilla de regularidad.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `planilla_id` | bigint | FK → `core_planillaregularidad`, NN | Planilla a la que pertenece |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente (puede ser nulo si fue cargado manualmente) |
| `nombre` | varchar(255) | NN | Nombre del docente (snapshot) |
| `dni` | varchar(20) | NN | DNI del docente |
| `rol` | varchar(16) | NN | `profesor` · `bedel` · `otro` |
| `orden` | int unsigned | NN | Orden de aparición en la planilla |

---

### `core_planillaregularidadfila`

Fila individual de estudiante en una planilla de regularidad.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `planilla_id` | bigint | FK → `core_planillaregularidad`, NN | Planilla contenedora |
| `orden` | int unsigned | NN | Número de orden en la planilla |
| `estudiante_id` | bigint | FK → `core_estudiante`, NULL | Estudiante (puede ser nulo en registros históricos) |
| `dni` | varchar(20) | NN | DNI del estudiante |
| `apellido_nombre` | varchar(255) | NN | Apellido y nombre (snapshot) |
| `nota_final` | int | NULL | Nota final de la cursada |
| `asistencia_porcentaje` | int | NULL | Porcentaje de asistencia (0–100) |
| `situacion` | varchar(32) | NN | Situación académica resultante |
| `excepcion` | tinyint(1) | NN | Si `1`, se aplicó una excepción |
| `datos` | json | NN | Datos dinámicos de la planilla (notas parciales, etc.) en JSON |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricciones únicas:** `(planilla, orden)`, `(planilla, dni)`

---

### `core_planillaregularidadhistorial`

Log de acciones realizadas sobre una planilla de regularidad.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `planilla_id` | bigint | FK → `core_planillaregularidad`, NN | Planilla afectada |
| `accion` | varchar(32) | NN | `create`=Creación · `update`=Edición · `delete_row`=Eliminación de fila · `regenerate_pdf`=Regeneración de PDF |
| `usuario_id` | int | FK → `auth_user`, NULL | Usuario que realizó la acción |
| `payload` | json | NN | Datos de la acción en JSON (diff de cambios) |
| `created_at` | datetime(6) | NN | Fecha y hora de la acción |

---

### `core_regularidadplanillalock`

Bloqueo de carga de regularidades para una comisión o materia/año. Impide modificaciones una vez cerrado el período.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `comision_id` | bigint | FK → `core_comision`, UQ, NULL | Comisión bloqueada |
| `materia_id` | bigint | FK → `core_materia`, NULL | Materia bloqueada |
| `anio_virtual` | int | NULL | Año académico del bloqueo por materia |
| `cerrado_por_id` | int | FK → `auth_user`, NULL | Usuario que cerró |
| `cerrado_en` | datetime(6) | NN | Fecha y hora del cierre |

**Restricción única:** `(materia, anio_virtual)`

---

## 10. Actas de Examen

### `core_actaexamen`

Acta oficial de examen final de una materia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `codigo` | varchar(64) | UQ, NN | Código único del acta |
| `numero` | int unsigned | NN | Número correlativo del acta |
| `anio_academico` | int | NN | Año académico |
| `tipo` | varchar(4) | NN | `REG`=Regular · `LIB`=Libre |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia examinada |
| `plan_id` | bigint | FK → `core_plandeestudio`, NN | Plan de estudio |
| `anio_cursada` | int | NULL | Año de la carrera al que corresponde |
| `fecha` | date | NN | Fecha del examen |
| `folio` | varchar(64) | NN | Folio del libro de actas |
| `libro` | varchar(64) | NN | Libro de actas |
| `observaciones` | longtext | NN | Observaciones del acta |
| `total_alumnos` | int unsigned | NN | Total de alumnos inscriptos |
| `total_aprobados` | int unsigned | NN | Total de aprobados |
| `total_desaprobados` | int unsigned | NN | Total de desaprobados |
| `total_ausentes` | int unsigned | NN | Total de ausentes |
| `created_by_id` | int | FK → `auth_user`, NULL | Usuario que creó el acta |
| `updated_by_id` | int | FK → `auth_user`, NULL | Usuario que modificó el acta |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(profesorado, anio_academico, numero)`

---

### `core_actaexamendocente`

Docente integrante del tribunal examinador de un acta.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `acta_id` | bigint | FK → `core_actaexamen`, NN | Acta a la que pertenece |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente del sistema (puede ser nulo) |
| `nombre` | varchar(255) | NN | Nombre completo (snapshot) |
| `dni` | varchar(32) | NN | DNI del docente |
| `rol` | varchar(4) | NN | `PRES`=Presidente · `VOC1`=Vocal 1 · `VOC2`=Vocal 2 |
| `orden` | int unsigned | NN | Orden de aparición |

---

### `core_actaexamenestudiante`

Línea de resultado individual de un estudiante en un acta de examen.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `acta_id` | bigint | FK → `core_actaexamen`, NN | Acta a la que pertenece |
| `numero_orden` | int unsigned | NN | Número de orden en el acta |
| `permiso_examen` | varchar(64) | NN | Permiso o número de libreta |
| `dni` | varchar(16) | NN | DNI del estudiante |
| `apellido_nombre` | varchar(255) | NN | Apellido y nombre (snapshot) |
| `examen_escrito` | varchar(4) | NN | Nota del examen escrito |
| `examen_oral` | varchar(4) | NN | Nota del examen oral |
| `calificacion_definitiva` | varchar(4) | NN | Calificación definitiva. `AJ`=Ausente Justificado · `AI`=Ausente Injustificado |
| `observaciones` | longtext | NN | Observaciones |

---

## 11. Pedidos: Analíticos y Equivalencias

### `core_pedidoanalitico`

Solicitud de emisión de analítico académico por parte de un estudiante.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante solicitante |
| `ventana_id` | bigint | FK → `core_ventanahabilitacion`, NN | Ventana habilitada para analíticos |
| `motivo` | varchar(20) | NN | `equivalencia` · `beca` · `control` · `otro` |
| `motivo_otro` | varchar(255) | NULL | Detalle si el motivo es `otro` |
| `profesorado_id` | int | FK → `core_profesorado`, NULL | Carrera para la que se solicita |
| `cohorte` | int | NULL | Año de ingreso (cohorte) |
| `created_at` | datetime(6) | NN | Fecha de creación |

---

### `core_pedidoequivalencia`

Pedido de equivalencia curricular (Anexo A o Anexo B) de un estudiante.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante solicitante |
| `ventana_id` | bigint | FK → `core_ventanahabilitacion`, NN | Ventana habilitada |
| `tipo` | varchar(16) | NN | `ANEXO_A` · `ANEXO_B` |
| `ciclo_lectivo` | varchar(16) | NN | Ciclo lectivo del pedido |
| `profesorado_destino_id` | int | FK → `core_profesorado`, NULL | Carrera de destino en el IPES |
| `profesorado_destino_nombre` | varchar(255) | NN | Nombre de la carrera destino (snapshot) |
| `plan_destino_id` | bigint | FK → `core_plandeestudio`, NULL | Plan destino |
| `plan_destino_resolucion` | varchar(255) | NN | Resolución del plan destino (snapshot) |
| `profesorado_origen_nombre` | varchar(255) | NN | Nombre del profesorado de origen |
| `plan_origen_resolucion` | varchar(255) | NN | Resolución del plan de origen |
| `establecimiento_origen` | varchar(255) | NN | Nombre del establecimiento de origen |
| `establecimiento_localidad` | varchar(255) | NN | Localidad del establecimiento de origen |
| `establecimiento_provincia` | varchar(255) | NN | Provincia del establecimiento de origen |
| `estado` | varchar(12) | NN | `draft`=Borrador · `final`=Finalizado |
| `workflow_estado` | varchar(20) | NN | `draft` · `pending_docs`=Pendiente de documentación · `review`=En evaluación · `titulos`=En Títulos · `notified`=Notificado |
| `resultado_final` | varchar(16) | NN | `pendiente` · `otorgada` · `denegada` · `mixta` |
| `titulos_documento_tipo` | varchar(12) | NN | `ninguno` · `nota` · `disposicion` · `ambos` |
| `titulos_nota_numero` | varchar(128) | NN | Número de nota de Títulos |
| `titulos_nota_fecha` | date | NULL | Fecha de la nota |
| `titulos_disposicion_numero` | varchar(128) | NN | Número de disposición |
| `titulos_disposicion_fecha` | date | NULL | Fecha de la disposición |
| `bloqueado_por_id` | int | FK → `auth_user`, NULL | Usuario que tiene el pedido bloqueado para edición |
| `bloqueado_en` | datetime(6) | NULL | Fecha del bloqueo |
| `requiere_tutoria` | tinyint(1) | NN | Si `1`, requiere tutoría |
| `documentacion_presentada` | tinyint(1) | NN | Si `1`, el estudiante presentó documentación física |
| `documentacion_cantidad` | int unsigned | NULL | Cantidad de documentos presentados |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

> **Nota de integridad:** Al guardar un pedido, el sistema sincroniza siempre que el FK esté seteado (`profesorado_destino_id` o `plan_destino_id`), asegurando que el snapshot refleje el valor actual aunque el nombre haya cambiado posteriormente.

---

### `core_pedidoequivalenciamateria`

Materia de origen incluida en un pedido de equivalencia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `pedido_id` | bigint | FK → `core_pedidoequivalencia`, NN | Pedido al que pertenece |
| `nombre` | varchar(255) | NN | Nombre de la materia de origen |
| `formato` | varchar(128) | NN | Formato de la materia |
| `anio_cursada` | varchar(64) | NN | Año en que la cursó |
| `nota` | varchar(32) | NN | Nota obtenida |
| `orden` | int unsigned | NN | Orden de aparición |
| `resultado` | varchar(16) | NN | `pendiente` · `otorgada` · `rechazada` |
| `observaciones` | varchar(255) | NN | Observaciones del evaluador |

---

### `core_equivalenciadisposicion`

Equivalencia formal otorgada a un estudiante mediante disposición oficial.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `origen` | varchar(32) | NN | `primera_carga`=importado · `secretaria`=cargado por secretaría |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante beneficiado |
| `profesorado_id` | int | FK → `core_profesorado`, NN | Carrera en la que se otorga |
| `plan_id` | bigint | FK → `core_plandeestudio`, NN | Plan de estudio aplicable |
| `numero_disposicion` | varchar(64) | NN | Número de la disposición oficial |
| `fecha_disposicion` | date | NN | Fecha de la disposición |
| `observaciones` | varchar(255) | NN | Notas adicionales |
| `creado_por_id` | int | FK → `auth_user`, NULL | Usuario que cargó la disposición |
| `creado_en` | datetime(6) | NN | Fecha de creación |

**Índice:** `(estudiante, profesorado, numero_disposicion)`

---

### `core_equivalenciadisposiciondetalle`

Materia reconocida mediante una disposición de equivalencia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `disposicion_id` | bigint | FK → `core_equivalenciadisposicion`, NN | Disposición a la que pertenece |
| `materia_id` | bigint | FK → `core_materia`, NN | Materia reconocida |
| `nota` | varchar(32) | NN | Nota acreditada |
| `observaciones` | varchar(255) | NN | Observaciones |

**Restricción única:** `(disposicion, materia)`

---

## 12. Asistencia

### `asistencia_claseprogramada`

Clase individual programada para una comisión.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `comision_id` | bigint | FK → `core_comision`, NN | Comisión a la que pertenece la clase |
| `fecha` | date | NN | Fecha de la clase |
| `hora_inicio` | time | NULL | Hora de inicio |
| `hora_fin` | time | NULL | Hora de fin |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente asignado para esta clase |
| `docente_dni` | varchar(20) | NN | DNI del docente (snapshot) |
| `docente_nombre` | varchar(255) | NN | Nombre del docente al momento de crear la clase (snapshot) |
| `estado` | varchar(20) | NN | `programada` · `en_curso` · `impartida` · `cancelada` |
| `notas` | longtext | NN | Notas sobre la clase |
| `creado_en` | datetime(6) | NN | Fecha de creación |
| `actualizado_en` | datetime(6) | NN | Fecha de última modificación |

**Restricción única:** `(comision, fecha, hora_inicio, hora_fin)`  
**Índices:** `(fecha)`, `(comision, fecha)`

---

### `asistencia_asistenciaalumno`

Registro de asistencia de un estudiante a una clase programada.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `clase_id` | bigint | FK → `asistencia_claseprogramada`, NN | Clase correspondiente |
| `estudiante_id` | bigint | FK → `core_estudiante`, NN | Estudiante |
| `estado` | varchar(24) | NN | `presente` · `ausente` · `ausente_justificada` · `tarde` |
| `justificacion_id` | bigint | FK → `asistencia_justificacion`, NULL | Justificación vinculada |
| `registrado_por_id` | int | FK → `auth_user`, NULL | Usuario que registró la asistencia |
| `registrado_via` | varchar(12) | NN | `docente` · `staff` · `sistema` |
| `registrado_en` | datetime(6) | NN | Fecha y hora del registro |
| `observaciones` | longtext | NN | Observaciones |

**Restricción única:** `(clase, estudiante)`  
**Índices:** `(clase, estado)`, `(estudiante, estado)`

---

### `asistencia_asistenciadocente`

Registro de asistencia de un docente a una clase programada.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `clase_id` | bigint | FK → `asistencia_claseprogramada`, NN | Clase correspondiente |
| `docente_id` | bigint | FK → `core_docente`, NN | Docente |
| `estado` | varchar(16) | NN | `presente` · `ausente` · `justificada` |
| `justificacion_id` | bigint | FK → `asistencia_justificacion`, NULL | Justificación vinculada |
| `registrado_por_id` | int | FK → `auth_user`, NULL | Usuario que registró |
| `registrado_via` | varchar(12) | NN | `docente`=autoregistro · `staff`=staff administrativo · `sistema` |
| `registrado_en` | datetime(6) | NN | Fecha y hora del registro |
| `observaciones` | longtext | NN | Observaciones |
| `marcada_en_turno` | varchar(64) | NN | Nombre del turno al momento del registro (snapshot) |
| `marcacion_categoria` | varchar(12) | NN | `normal` · `tarde`=llegada tarde · `diferida`=carga diferida |
| `alerta` | tinyint(1) | NN | Si `1`, el sistema generó una alerta en este registro |
| `alerta_tipo` | varchar(32) | NN | Tipo de alerta |
| `alerta_motivo` | varchar(255) | NN | Descripción de la alerta |

**Restricción única:** `(clase, docente)`  
**Índices:** `(clase)`, `(docente, estado)`, `(docente, registrado_en)`

---

### `asistencia_justificacion`

Justificación de ausencia (para estudiante o docente) con período de vigencia y estado de aprobación.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `tipo` | varchar(16) | NN | `estudiante` · `docente` |
| `estado` | varchar(16) | NN | `pendiente` · `aprobada` · `rechazada` |
| `motivo` | varchar(255) | NN | Motivo de la justificación |
| `observaciones` | longtext | NN | Observaciones internas |
| `archivo_url` | varchar(200) | NN | URL del documento justificante adjunto |
| `vigencia_desde` | date | NN | Inicio del período justificado |
| `vigencia_hasta` | date | NN | Fin del período justificado |
| `origen` | varchar(12) | NN | `anticipada`=presentada antes de la ausencia · `posterior`=presentada después |
| `creado_por_id` | int | FK → `auth_user`, NULL | Usuario que creó la justificación |
| `aprobado_por_id` | int | FK → `auth_user`, NULL | Usuario que aprobó o rechazó |
| `aprobado_en` | datetime(6) | NULL | Fecha y hora de la resolución |
| `creado_en` | datetime(6) | NN | Fecha de creación |
| `actualizado_en` | datetime(6) | NN | Fecha de última modificación |

---

### `asistencia_justificaciondetalle`

Línea de detalle que vincula una justificación con una clase y persona específica.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `justificacion_id` | bigint | FK → `asistencia_justificacion`, NN | Justificación padre |
| `clase_id` | bigint | FK → `asistencia_claseprogramada`, NN | Clase justificada |
| `estudiante_id` | bigint | FK → `core_estudiante`, NULL | Estudiante (excluyente con docente) |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente (excluyente con estudiante) |
| `aplica_automaticamente` | tinyint(1) | NN | Si `1`, al aprobar la justificación se actualiza el estado de asistencia automáticamente |

**Restricciones únicas:** `(justificacion, clase, estudiante)`, `(justificacion, clase, docente)`

---

### `asistencia_docentemarcacionlog`

Log de cada intento de marcación de asistencia docente (desde kiosco u otros orígenes).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `dni` | varchar(20) | NN | DNI ingresado al marcar |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente identificado. Nulo si el DNI no fue reconocido |
| `clase_id` | bigint | FK → `asistencia_claseprogramada`, NULL | Clase vinculada. Nulo si no se pudo resolver |
| `resultado` | varchar(16) | NN | `typing`=ingreso parcial · `aceptado` · `rechazado` |
| `detalle` | varchar(255) | NN | Mensaje descriptivo del resultado |
| `alerta` | tinyint(1) | NN | Si `1`, se generó una alerta |
| `registrado_en` | datetime(6) | NN | Fecha y hora del intento |
| `origen` | varchar(32) | NN | Identificador del origen (ej. `"kiosk"`) |

**Índices:** `(dni, registrado_en)`, `(resultado)`

---

### `asistencia_cursohorariosnapshot`

Copia local del horario de una comisión para el módulo de asistencia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `comision_id` | bigint | FK → `core_comision`, NN | Comisión correspondiente |
| `dia_semana` | smallint unsigned | NN | `0`=Dom · `1`=Lun · … · `6`=Sáb |
| `hora_inicio` | time | NN | Hora de inicio |
| `hora_fin` | time | NN | Hora de fin |
| `origen_id` | varchar(64) | NN | Referencia al sistema fuente |
| `sincronizado_en` | datetime(6) | NN | Fecha de última sincronización |

**Restricción única:** `(comision, dia_semana, hora_inicio, hora_fin)`

---

### `asistencia_cursoalumnosnapshot`

Copia local de la lista de estudiantes de una comisión para el módulo de asistencia.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `comision_id` | bigint | FK → `core_comision`, NN | Comisión |
| `estudiante_id` | bigint | FK → `core_estudiante`, NULL | Estudiante del sistema (puede ser nulo) |
| `dni` | varchar(16) | NN | DNI del alumno |
| `apellido` | varchar(128) | NN | Apellido (snapshot) |
| `nombre` | varchar(128) | NN | Nombre (snapshot) |
| `activo` | tinyint(1) | NN | Si `1`, el alumno sigue activo en la comisión |
| `sincronizado_en` | datetime(6) | NN | Fecha de última sincronización |

**Restricción única:** `(comision, dni)`

---

### `asistencia_calendarioasistenciaevento`

Evento del calendario de asistencia (feriado, suspensión, licencia, receso).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `nombre` | varchar(255) | NN | Nombre descriptivo del evento |
| `tipo` | varchar(20) | NN | `feriado` · `suspension` · `licencia` · `receso` |
| `subtipo` | varchar(32) | NN | `general` · `licencia_invierno` · `licencia_anual` · `licencia_docente` · `feria_academica` · `periodo_sin_asistencia` · `otro` |
| `fecha_desde` | date | NN | Fecha de inicio del evento |
| `fecha_hasta` | date | NN | Fecha de fin del evento |
| `turno_id` | bigint | FK → `core_turno`, NULL | Turno afectado. Nulo = aplica a todos |
| `aplica_docentes` | tinyint(1) | NN | Si `1`, afecta la asistencia docente |
| `aplica_estudiantes` | tinyint(1) | NN | Si `1`, afecta la asistencia estudiantil |
| `motivo` | longtext | NN | Descripción del motivo |
| `activo` | tinyint(1) | NN | Si `1`, el evento está activo |
| `profesorado_id` | int | FK → `core_profesorado`, NULL | Limita el evento a una carrera. Nulo = general |
| `plan_id` | bigint | FK → `core_plandeestudio`, NULL | Limita el evento a un plan de estudio |
| `comision_id` | bigint | FK → `core_comision`, NULL | Limita el evento a una comisión |
| `docente_id` | bigint | FK → `core_docente`, NULL | Docente afectado (para licencias individuales) |
| `creado_por_id` | int | FK → `auth_user`, NULL | Usuario que creó el evento |
| `actualizado_por_id` | int | FK → `auth_user`, NULL | Usuario que modificó el evento |
| `creado_en` | datetime(6) | NN | Fecha de creación |
| `actualizado_en` | datetime(6) | NN | Fecha de última modificación |

**Índices:** `(fecha_desde, fecha_hasta)`, `(tipo)`, `(turno)`, `(activo)`, `(docente)`, `(profesorado)`, `(plan)`, `(comision)`

---

## 13. Mensajería

### `core_messagetopic`

Categorías/temas disponibles para organizar conversaciones.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `slug` | varchar(64) | UQ, NN | Identificador único en formato slug |
| `name` | varchar(128) | NN | Nombre visible del tema |
| `description` | longtext | NULL | Descripción del tema |
| `is_active` | tinyint(1) | NN | Si `1`, el tema está disponible |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

### `core_conversation`

Hilo de conversación entre participantes del sistema.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `topic_id` | bigint | FK → `core_messagetopic`, NULL | Tema de la conversación |
| `created_by_id` | int | FK → `auth_user`, NULL | Usuario que inició la conversación |
| `subject` | varchar(255) | NN | Asunto/título |
| `context_type` | varchar(64) | NULL | Tipo de entidad contextual (ej. `"inscripcion"`) |
| `context_id` | varchar(64) | NULL | ID de la entidad contextual |
| `status` | varchar(32) | NN | `open`=Abierta · `close_requested`=Cierre solicitado · `closed`=Cerrada |
| `is_massive` | tinyint(1) | NN | Si `1`, es un envío masivo a múltiples destinatarios |
| `allow_student_reply` | tinyint(1) | NN | Si `1`, los estudiantes pueden responder |
| `last_message_at` | datetime(6) | NULL | Fecha del último mensaje |
| `close_requested_by_id` | int | FK → `auth_user`, NULL | Usuario que solicitó el cierre |
| `close_requested_at` | datetime(6) | NULL | Fecha de la solicitud de cierre |
| `closed_by_id` | int | FK → `auth_user`, NULL | Usuario que cerró la conversación |
| `closed_at` | datetime(6) | NULL | Fecha de cierre |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

**Índices:** `(status)`, `(last_message_at)`, `(context_type, context_id)`

---

### `core_conversationparticipant`

Participante de una conversación.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `conversation_id` | bigint | FK → `core_conversation`, NN | Conversación |
| `user_id` | int | FK → `auth_user`, NN | Usuario participante |
| `role_snapshot` | varchar(64) | NULL | Rol del usuario al momento de ser agregado |
| `can_reply` | tinyint(1) | NN | Si `1`, puede responder |
| `last_read_at` | datetime(6) | NULL | Última vez que leyó la conversación |
| `added_at` | datetime(6) | NN | Fecha en que fue agregado |

**Restricción única:** `(conversation, user)`

---

### `core_message`

Mensaje individual dentro de una conversación.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `conversation_id` | bigint | FK → `core_conversation`, NN | Conversación a la que pertenece |
| `author_id` | int | FK → `auth_user`, NULL | Autor. Nulo = mensaje del sistema |
| `body` | longtext | NN | Contenido del mensaje |
| `attachment` | varchar(255) | NULL | Ruta del archivo adjunto (solo PDF, máx. 2 MB) |
| `created_at` | datetime(6) | NN | Fecha y hora del mensaje |

---

### `core_conversationaudit`

Registro de acciones de moderación sobre conversaciones.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `conversation_id` | bigint | FK → `core_conversation`, NN | Conversación afectada |
| `action` | varchar(32) | NN | `close_requested` · `closed` · `reopened` |
| `actor_id` | int | FK → `auth_user`, NULL | Usuario que realizó la acción |
| `payload` | json | NN | Datos adicionales de la acción |
| `created_at` | datetime(6) | NN | Fecha y hora de la acción |

---

## 14. Auditoría y Logs

### `audit_log`

Log de auditoría de todas las acciones CRUD, autenticación y eventos del sistema.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `timestamp` | datetime(6) | NN, IDX | Fecha y hora del evento |
| `usuario_id` | int | FK → `auth_user`, NULL | Usuario que realizó la acción |
| `nombre_usuario` | varchar(100) | NN | Username al momento del evento (snapshot) |
| `roles` | json | NN | Roles del usuario al momento del evento |
| `accion` | varchar(16) | NN | `CREATE` · `UPDATE` · `DELETE` · `LOGIN` · `LOGOUT` · `OTHER` |
| `tipo_accion` | varchar(16) | NN | `CRUD` · `AUTH`=Autenticación · `SYSTEM` · `OTHER` |
| `detalle_accion` | varchar(100) | NN | Descripción corta (ej. `"Creó estudiante"`) |
| `entidad_afectada` | varchar(50) | NN | Nombre del modelo/entidad afectada |
| `id_entidad` | varchar(64) | NN | ID del objeto afectado |
| `resultado` | varchar(8) | NN | `OK` · `ERROR` |
| `ip_origen` | varchar(45) | NN | IP del cliente |
| `session_id` | varchar(100) | NN | ID de sesión |
| `request_id` | varchar(100) | NN | ID del request HTTP |
| `payload` | json | NN | Datos adicionales del evento (diff, errores, etc.) |

**Índices:** `(timestamp)`, `(usuario)`, `(accion)`, `(tipo_accion)`, `(entidad_afectada, id_entidad)`, `(request_id)`

---

### `core_systemlog`

Registro de errores, discrepancias y alertas internas del sistema.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | bigint | PK, NN, AUTO | Identificador interno |
| `tipo` | varchar(50) | NN | `REGULARIDAD_MISMATCH` · `ACTA_MISMATCH` · `EQUIVALENCIA_MISMATCH` · `IMPORT_ERROR` · `SYSTEM_ERROR` · `SECURITY_ALERT` |
| `mensaje` | longtext | NN | Descripción del problema |
| `metadata` | json | NN | Datos adicionales en JSON |
| `resuelto` | tinyint(1) | NN | Si `1`, fue revisado y marcado como resuelto |
| `created_at` | datetime(6) | NN | Fecha de creación |
| `updated_at` | datetime(6) | NN | Fecha de última modificación |

---

## 15. Django / Auth (tablas del framework)

Tablas estándar generadas por Django. No contienen lógica de negocio propia del IPES.

### `auth_user`

Usuarios del sistema (docentes, estudiantes, staff, administradores).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | int PK | Identificador interno |
| `username` | varchar(150) UQ | Nombre de usuario — en este sistema es el **DNI** de la persona |
| `first_name` | varchar(150) | Nombre (sincronizado desde `core_persona`) |
| `last_name` | varchar(150) | Apellido (sincronizado desde `core_persona`) |
| `email` | varchar(254) | Correo electrónico |
| `password` | varchar(128) | Contraseña hasheada (PBKDF2) |
| `is_active` | tinyint(1) | Si `1`, la cuenta está activa |
| `is_staff` | tinyint(1) | Si `1`, puede acceder al panel de administración |
| `is_superuser` | tinyint(1) | Si `1`, tiene todos los permisos sin restricción |
| `date_joined` | datetime(6) | Fecha de registro |
| `last_login` | datetime(6) | Último acceso |

### `auth_group`
Grupos de permisos de Django. Permite asignar roles (ej. `"bedeles"`, `"coordinadores"`).

### `auth_permission`
Permisos individuales del sistema (add/change/delete/view por modelo).

### `auth_user_groups` / `auth_user_user_permissions`
Tablas intermedias M2M para asignación de grupos y permisos a usuarios.

### `django_content_type`
Registro de todos los modelos del sistema. Usado por el sistema de permisos genéricos.

### `django_migrations`
Historial de migraciones aplicadas a la base de datos.

### `django_session`
Sesiones activas de usuarios.

### `django_admin_log`
Log de acciones realizadas desde el panel de administración de Django.

---

## 16. Tablas de Perfilado (Silk)

Tablas generadas por **django-silk**, herramienta de profiling HTTP. Solo presentes en entornos de desarrollo/diagnóstico. No contienen datos de negocio.

| Tabla | Descripción |
|-------|-------------|
| `silk_request` | Registro de requests HTTP capturados |
| `silk_response` | Respuestas HTTP asociadas |
| `silk_profile` | Bloques de código perfilados |
| `silk_profile_queries` | Relación entre perfiles y queries SQL |
| `silk_sqlquery` | Queries SQL ejecutadas durante un request |

---

## Resumen de módulos y tablas

| Módulo | Tablas |
|--------|--------|
| Personas y Usuarios | `core_persona`, `core_docente`, `core_userprofile` |
| Carreras | `core_profesorado`, `core_plandeestudio`, `core_materia`, `core_correlatividad`, `core_correlatividadversion`, `core_correlatividadversiondetalle`, `core_documento` |
| Estudiantes | `core_estudiante`, `core_estudiante_documentacion_presentada`, `core_estudiantecarrera` |
| Horarios | `core_turno`, `core_bloque`, `core_horariocatedra`, `core_horariocatedradetalle`, `core_comision`, `core_staffasignacion`, `core_ventanahabilitacion` |
| Preinscripciones | `preinscripciones`, `core_preinscripcionchecklist`, `core_preinscripcion_archivo`, `core_requisitodocumentaciontemplate`, `core_profesoradorequisitodocumentacion` |
| Inscripciones | `core_inscripcionmateriaestudiante`, `core_equivalenciacurricular`, `core_equivalenciacurricular_materias` |
| Curso Introductorio | `core_cursointroductoriocohorte`, `core_cursointroductorioregistro` |
| Mesas de Examen | `core_mesaexamen`, `core_inscripcionmesa`, `core_mesaactaoral` |
| Regularidades | `core_regularidad`, `core_regularidadformato`, `core_regularidadplantilla`, `core_planillaregularidad`, `core_planillaregularidaddocente`, `core_planillaregularidadfila`, `core_planillaregularidadhistorial`, `core_regularidadplanillalock` |
| Actas de Examen | `core_actaexamen`, `core_actaexamendocente`, `core_actaexamenestudiante` |
| Pedidos | `core_pedidoanalitico`, `core_pedidoequivalencia`, `core_pedidoequivalenciamateria`, `core_equivalenciadisposicion`, `core_equivalenciadisposiciondetalle` |
| Asistencia | `asistencia_claseprogramada`, `asistencia_asistenciaalumno`, `asistencia_asistenciadocente`, `asistencia_justificacion`, `asistencia_justificaciondetalle`, `asistencia_docentemarcacionlog`, `asistencia_cursohorariosnapshot`, `asistencia_cursoalumnosnapshot`, `asistencia_calendarioasistenciaevento` |
| Mensajería | `core_messagetopic`, `core_conversation`, `core_conversationparticipant`, `core_message`, `core_conversationaudit` |
| Auditoría | `audit_log`, `core_systemlog` |
| Django/Auth | `auth_user`, `auth_group`, `auth_permission`, `auth_user_groups`, `auth_user_user_permissions`, `django_content_type`, `django_migrations`, `django_session`, `django_admin_log` |
| Silk (profiling) | `silk_request`, `silk_response`, `silk_profile`, `silk_profile_queries`, `silk_sqlquery` |

---

*Generado el 2026-04-10 a partir del esquema real de la base de datos `ipes6` y los modelos Django del proyecto IPES6.*
