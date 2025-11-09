Manual de uso - Rol Secretaría
==============================

Objetivo del rol
----------------
Secretaría es el corazón operativo del IPES6: administra carreras, controla ventanas académicas, formaliza alumnos y mantiene las comunicaciones oficiales. Posee acceso amplio a los formularios de carga de datos y a los reportes ejecutivos.

Acceso y seguridad
------------------
- Credenciales personales con contraseña robusta y, cuando esté disponible, segundo factor.
- Evita compartir sesiones o reutilizar contraseñas fuera del dominio institucional.
- Al finalizar la jornada, cierra sesión desde el menú superior para liberar licencias y evitar bloqueos.

Paneles disponibles en AppShell
-------------------------------
- **Dashboard / Preinscripciones:** resumen de altas recientes y accesos al asistente de preinscripción y panel de formalización.
- **Secretaría:** índice con accesos a Profesorados, Planes, Materias, Correlatividades, Docentes, Asignar Rol, Horarios, Cátedra Docente, Comisiones, Habilitar Fechas, Mesas, Carga de Notas, Analíticos, Estudiantes y Confirmar Inscripción.
- **Carreras y Materia Inscriptos:** navegación rápida para validar planes y cupos por materia.
- **Mensajes:** bandeja única para comunicados a alumnos, docentes y otros roles.
- **Reportes y Vistas globales:** exportación de listados (CSV/XLSX) y tableros con métricas institucionales.
- **Asistencia / Panel Docente:** seguimiento de firmas, cierres y ausencias.
- **Portal de Alumnos:** vista previa de trámites (`/alumnos`), útil para contestar consultas.
- **Primera Carga / Actas Primera Carga:** circuitos especiales para cohortes iniciales o migraciones.

Procesos operativos
-------------------

1. Alta integral de una carrera
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Ingresar a `Secretaría > Cargar Profesorado` y completar **nombre**, **resolución**, **modalidad** y **vigencia**. Guardar para generar el identificador.
2. Desde el listado seleccionar “Planes” para abrir `/secretaría/profesorado/:id/planes`. Completar **plan**, **año**, **carga horaria** y adjuntar documentación si corresponde.
3. Abrir `Secretaría > Cargar Materias`, elegir el plan y cargar cada materia indicando **año**, **cuatrimestre**, **régimen**, **horas**, **tipo** y, si aplica, **modalidad virtual/presencial**.
4. Configurar correlatividades en `Secretaría > Correlatividades` marcando requisitos de cursada y examen.
5. Crear comisiones y horarios en `Secretaría > Comisiones` y `Secretaría > Horarios`. Cada carga requiere definir **docente**, **día**, **hora de inicio/fin**, **aula** y **cupo**.

2. Gestión de alumnos y legajos
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Revisar solicitudes en `Preinscripciones`. Los filtros por estado, carrera y DNI aceleran la búsqueda.
2. Abrir cada registro con “Ver / Editar”, corregir datos y guardar. El histórico queda en el panel derecho.
3. Pasar a `Secretaría > Confirmar Inscripción` o `Gestión > Confirmar` para completar el checklist documental. Marcar cada ítem presentado (DNI, analítico, fotos, etc.) y definir estado **Regular** o **Condicional** (requiere DDJJ).
4. Cambiar el estado a **Confirmada**, **Observada** o **Rechazada** según corresponda; el sistema notifica al aspirante y habilita el legajo.
5. Para estudiantes activos usar `Secretaría > Estudiantes` para actualizar datos personales, carreras, homologaciones y estado administrativo.

3. Ventanas y trámites habilitados
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Acceder a `Secretaría > Habilitar Fechas`.
2. Crear una ventana indicando **tipo** (Preinscripción, Inscripción a Materias, Cambio de Comisión, Mesa, Analítico, Pedido Especial, etc.), **profesorado/plan**, fechas **desde/hasta** y estado **Activo**.
3. Guardar. Los módulos del portal de alumnos solo muestran formularios cuando existe una ventana activa, por lo que toda carga de información depende de este paso.

4. Mesas, notas y actas
~~~~~~~~~~~~~~~~~~~~~~~
1. Desde `Secretaría > Mesas` crear la mesa indicando **materia**, **turno**, **tribunal**, **cupos** y modalidad (regular/libre/extraordinaria). Publicar para habilitar inscripciones.
2. Controlar inscriptos y asistencia desde la misma pantalla o en `Alumnos > Mesa de Examen` (vista alumno) para validar qué verán los estudiantes.
3. Cargar calificaciones desde `Secretaría > Carga de Notas`, seleccionando la mesa o comisión, ingresando **nota**, **condición** y observaciones.
4. Emitir actas oficiales en `Secretaría > Actas Examen` (o en “Actas Primera Carga” cuando se trate de cohortes iniciales). Completar datos del acta, revisar totales y descargar PDF firmado.
5. Generar analíticos y certificados en `Secretaría > Analíticos`. El formulario solicita **tipo de certificado**, **motivo** y **destino** para registrar el trámite.

5. Comunicación y reportes
~~~~~~~~~~~~~~~~~~~~~~~~~~
1. En `Mensajes` iniciar conversaciones nuevas con botones “Nuevo mensaje” o responder hilos existentes. Seleccionar destinatarios por rol, carrera o usuario puntual. Adjuntar PDFs cuando respaldes resoluciones.
2. Usar `Reportes` para exportar CSV/XLSX con filtros por carrera, cohorte, estado documental, etc. Ideal para respaldos diarios antes de ejecutar tareas masivas.
3. Consultar `Vistas` para presentar indicadores en reuniones (inscriptos por plan, alumnos condicionales, mesas abiertas).

6. Correlatividades por cohorte
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Ingresar a `Secretaria > Correlatividades` y elegir **Profesorado** y **Plan** desde los filtros superiores. El tablero muestra dos columnas: la lista de **materias** y la grilla de correlativas para la version seleccionada.
2. Antes de editar la matriz elegir una **Version de correlatividad** (selector desplegable). Sin version activa la grilla queda bloqueada para evitar errores.
3. Crear o editar versiones desde el boton `Gestionar versiones`:
   - **Nueva version** solicita **nombre**, **descripcion**, **cohorte desde**, **cohorte hasta** (opcional), fechas de **vigencia** y estado **Activo**. Los rangos no pueden superponerse: por ejemplo, si cohorte 2020-2022 ya existe, la siguiente debe iniciar en 2023. Dejar cohorte hasta vacio aplica a todas las cohortes futuras.
   - **Duplicar** permite copiar la matriz completa de una version previa para acelerar ajustes anuales (ej.: duplicar 2022 para construir la cohorte 2023).
   - **Editar** sirve para corregir descripciones o cerrar una version estableciendo el anio final (cohorte hasta). Cada cohorte academica debe quedar asociada a una unica version.
4. Con la version correcta seleccionada, marcar las materias requeridas en las columnas **Regular para cursar (RPC)**, **Aprobada para cursar (APC)** y **Aprobada para rendir (APR)**. Guardar para que el backend registre los cambios en esa version sin afectar las restantes.
5. Para revisar lo que ve cada cohorte, utilizar el filtro **Cohorte** del panel izquierdo o el filtro **Anio lectivo** del listado de materias. Ejemplo: los ingresantes 2023 consumen la version 2023+, mientras que las cohortes 2020-2022 continuan con el diseno anterior.
6. Al publicar una nueva planilla validar:
   - Que no existan superposiciones de cohortes en las versiones listadas.
   - Que los requisitos no apunten a materias de anios superiores al de la materia origen (la API rechaza esa configuracion).
   - Que las versiones inactivas solo se utilicen para consulta historica.
7. Si la nueva version inicia en un anio mayor al de una version existente, el sistema cierra automaticamente la anterior asignando `cohorte hasta = cohorte desde nuevo - 1`, evitando ediciones manuales.

Buenas prácticas
----------------
- Antes de modificar estructura académica, exportar al menos un reporte de materias y comisiones.
- Documentar en Mensajes o en el repositorio institucional cualquier cambio estructural (nuevas correlatividades, cierre de comisiones).
- Verificar diariamente la bandeja de Mensajes y la cola de trámites en Analíticos para evitar demoras.
- Utilizar el panel de alumnos como vista previa cuando asesores a estudiantes; los mismos pasos aplican para ellos, por lo que es la mejor forma de detectar bloqueos.
