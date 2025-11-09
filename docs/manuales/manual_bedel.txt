Manual de uso - Rol Bedel
=========================

Propósito del rol
-----------------
El equipo de bedelía es la primera línea de soporte para estudiantes y docentes. Controla documentación, administra mesas, colabora con la carga de notas y responde consultas mediante el portal.

Acceso a módulos
----------------
- **Dashboard / Preinscripciones:** seguimiento rápido de solicitudes nuevas.
- **Gestión > Confirmar** y **Secretaría > Confirmar Inscripción:** panel completo para validar datos y subir checklist documental.
- **Secretaría > Comisiones, Mesas, Carga de Notas, Analíticos, Estudiantes y Habilitar Fechas:** subconjunto de pantallas habilitadas para actualizar información operativa.
- **Portal de Alumnos:** ingreso a `/alumnos`, `/alumnos/mesa-examen`, `/alumnos/trayectoria` (solo consulta) y `/alumnos/certificado-regular` para asistir a los estudiantes en mostrador.
- **Mensajes, Carreras, Reportes y Vistas:** comunicación institucional y consulta de indicadores.
- **Primera Carga / Actas Primera Carga** y **Asistencia/Reportes** cuando se gestiona la cohorte inicial o se controlan firmas.

Procedimientos clave
--------------------

1. Formalización de preinscripciones
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Abrir `Preinscripciones`, filtrar por estado “Pendiente” y ubicar al aspirante (DNI o código PRE-XXXX).
2. Ingresar con “Ver / Editar” para revisar datos personales, corregir errores y guardar.
3. Desde el botón “Confirmar” o desde `Secretaría > Confirmar Inscripción`, completar el checklist documental marcando cada ítem recibido (DNI, analítico, fotos, certificados). 
4. Definir el estado documental:
   - **Regular:** toda la documentación obligatoria cargada.
   - **Condicional:** falta algún documento; es obligatorio marcar “DDJJ / Nota compromiso”.
5. Cambiar el estado de la preinscripción a **Confirmada**, **Observada** (requiere motivo) o **Rechazada**. El sistema registra al usuario que realizó la acción y notifica al aspirante.

2. Gestión de comisiones y horarios
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Ingresar a `Secretaría > Comisiones`.
2. Seleccionar la carrera/plan y usar “Nueva comisión” para cargar **materia**, **turno**, **docente** y **cupo**.
3. Editar horarios desde la misma pantalla o completarlos en `Secretaría > Horarios` cuando se habilite (día, hora inicio/fin, aula). Esto evita superposiciones y permite responder consultas de alumnos.

3. Administración de mesas y notas
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. `Secretaría > Mesas`: crear la mesa indicando **materia**, **tipo** (final, libre, extraordinaria), **fecha**, **tribunal** y **cupos**. Publicar para habilitar el formulario de alumnos.
2. Controlar inscriptos con los filtros de la tabla o desde `Alumnos > Mesa de Examen` para verificar qué ven los estudiantes.
3. Una vez tomada la mesa, abrir `Secretaría > Carga de Notas`, seleccionar la mesa y cargar **nota**, **condición** y observaciones por cada estudiante. Guardar sección por sección.
4. Generar el acta oficial en `Secretaría > Actas Examen` (o en Primera Carga cuando corresponda), revisar totales y descargar el PDF para firmas.

4. Certificados y trámites de alumnos
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. `Secretaría > Analíticos`: recibir pedidos provenientes de `/alumnos/pedido-analitico`. Al abrir uno, completar datos de emisión (número, destino, observaciones) y actualizar el estado.
2. Para constancias rápidas, orientar al estudiante a `/alumnos/certificado-regular`; si no puede acceder, generar el PDF desde el mismo módulo y enviarlo por Mensajes.
3. En `Secretaría > Estudiantes`, buscar por DNI y actualizar datos de contacto, estado documental u observaciones internas.

5. Comunicación y reportes
~~~~~~~~~~~~~~~~~~~~~~~~~~
1. En `Mensajes` responder consultas y crear avisos masivos (por ejemplo, cambios de aula). Usar filtros por rol para dirigir la comunicación.
2. `Reportes` permite descargar listados de inscriptos por comisión, mesas abiertas o documentación pendiente. Útil para reportar a dirección al cierre del día.
3. `Vistas` ofrece gráficos listos para exponer en reuniones (cantidad de confirmaciones, regularidades próximas a vencer, etc.).

Buenas prácticas
----------------
- Registrar cada entrega documental en el checklist para evitar duplicar trabajo entre turnos.
- Antes de cerrar una mesa, verificar que todas las notas estén cargadas y que el acta se haya descargado.
- Utilizar el portal de alumnos como vista previa al asistir a cada estudiante; así confirmarás exactamente qué botón o mensaje ve en su pantalla.
- Documentar incidencias en Mensajes o escalar a Secretaría/Admin cuando la acción exceda los permisos de bedelía.
