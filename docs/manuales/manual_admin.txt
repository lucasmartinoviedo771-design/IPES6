Manual de uso - Rol Admin
=========================

Objetivo del rol
----------------
El rol admin gobierna la configuracion estructural y los procesos criticos del sistema IPES6. Puede crear o editar usuarios, carreras, calendarios academicos, mesas y reportes globales. Se asigna a un equipo reducido, usualmente direccion de sistemas o responsables institucionales.

Autenticacion y seguridad
-------------------------
- Usar credenciales personales con contrasena robusta (12+ caracteres).
- Activar el segundo factor si la institucion lo habilito; el portal soporta MFA via Authenticator.
- No reutilizar sesiones ni operar con cuentas compartidas. Cada accion queda registrada por usuario, fecha e IP.
- Mantener actualizado el correo institucional porque recibe alertas y resets.
- Cuando se trabaje fuera de la intranet, utilizar VPN o los mecanismos aprobados por TI.

Navegacion rapida (AppShell)
----------------------------
Al iniciar sesion se carga `AppShell`, que provee topbar, sidebar y acceso al boton de "Guia de Usuario". Desde el menu lateral el rol admin ve todos los modulos:
- Dashboard y accesos rapidos a preinscripciones.
- Preinscripciones y Confirmar Inscripcion (formalizacion).
- Carreras, Reportes y Vistas globales.
- Mensajes (bandeja unificada).
- Portal de Alumnos (vista previa de tramites).
- Bloque Secretaria (profesorados, planes, materias, docentes, horarios, correlatividades, comisiones, mesas, analiticos, carga de notas, actas, estudiantes, habilitar fechas).
- Asistencia (reportes y panel docente).
- Primera Carga y Actas de Primera Carga.
- Ajustes transversales: Catedra Docente, Asignar Rol, Confirmacion de Inscripcion Secretaria.

Modulos clave
-------------

Dashboard
~~~~~~~~~
Ruta `/dashboard`. Muestra graficos de preinscripciones, accesos directos a Alta rapida, botones al wizard de preinscripcion y a la formalizacion. Desde aqui tambien se puede abrir reportes resumidos.

Preinscripciones
~~~~~~~~~~~~~~~~
Ruta `/preinscripciones`. Permite revisar todas las solicitudes creadas por aspirantes. Incluye filtros por estado, carrera, DNI y periodo. Desde cada registro se puede editar datos, adjuntar notas internas o derivarlo a Confirmar Inscripcion. El boton "Crear preinscripcion" abre el mismo wizard que el publico.

Mensajes
~~~~~~~~
Ruta `/mensajes`. Bandeja unica con hilos agrupados. Se pueden crear campañas por rol (ej. alumnos de cierto profesorado) o contactar usuarios individuales. Los admins pueden fijar conversaciones importantes y usar plantillas guardadas.

Carreras y planes
~~~~~~~~~~~~~~~~~
Ruta `/carreras`. Permite navegar por profesorados, planes y materias; incluye atajos a `/carreras/:profesoradoId/planes/:planId/materias/:materiaId/inscriptos` para ver inscriptos por materia. Desde esta vista se validan correlatividades y se exportan listados.

Secretaria
~~~~~~~~~~
Bloque principal con varias pantallas:

Estructura academica
- `/secretaria/profesorado`: alta y edicion de carreras.
- `/secretaria/profesorado/:profesoradoId/planes`: planes por carrera.
- `/secretaria/plan/:planId/materias`: materias, turnos y creditos.
- `/secretaria/correlatividades`: requisitos de cursada y examen.
- `/secretaria/comisiones`: asignacion de comisiones, cupos y horarios.

Gestion de personal y alumnos
- `/secretaria/docentes`: alta y relacion de docentes.
- `/secretaria/asignar-rol`: asignacion de roles y profesorados a usuarios.
- `/secretaria/estudiantes`: buscador general de alumnos y legajos.
- `/secretaria/catedra-docente`: relacion docentes/comisiones.
- `/secretaria/horarios`: carga y exportacion de horarios.
- `/asistencia/reportes` y `/docentes/asistencia`: seguimiento de asistencia.

Procesos academicos
- `/secretaria/habilitar-fechas`: administra ventanas de preinscripcion, inscripcion a materias, cambio de comision, mesas y tramites.
- `/secretaria/mesas`: creacion de mesas, tribunas y cupos.
- `/secretaria/carga-notas` y `/secretaria/actas-examen`: registro de notas finales y generacion de actas.
- `/secretaria/analiticos`: emision de analiticos y certificados.
- `/secretaria/confirmar-inscripcion` y `/gestion/confirmar`: formalizacion de aspirantes.
- `/admin/primera-carga` y `/admin/primera-carga/actas-examen`: workflows especiales para el primer cuatrimestre o migraciones historicas.

Correlatividades por cohorte
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Abrir `/secretaria/correlatividades`, seleccionar **Profesorado** y **Plan** para cargar la grilla.
2. Elegir una **Version** desde el selector superior. Sin version activa, la matriz queda bloqueada.
3. Con el boton `Gestionar versiones` se pueden:
   - Crear una nueva version (nombre, descripcion, `cohorte desde`, `cohorte hasta` opcional, vigencias y estado Activo). Los rangos no deben superponerse salvo que la version previa termine en el ano anterior al nuevo inicio.
   - Duplicar una version existente para partir de su matriz.
   - Editar datos o cerrar una version completando `cohorte hasta`.
4. Seleccionar la version deseada y marcar correlativas en las columnas **RPC**, **APC** y **APR**. Guardar para persistir la planilla.
5. Usar el filtro **Cohorte** para verificar que cada ingreso vea la version correcta (ej. cohorte 2023 toma la version 2023+).
6. Cuando se crea una version cuyo `cohorte desde` es posterior al de otra version del mismo plan, el sistema ajusta automaticamente la version anterior colocando `cohorte hasta = nuevo_inicio - 1`, por lo que no hace falta editarla manualmente.

Portal de alumnos
~~~~~~~~~~~~~~~~~
Ruta `/alumnos` expone las tarjetas de tramites: inscripcion a materias, pedido de analitico, cambio de comision, mesa de examen, horario, trayectoria, certificado regular y completar perfil. Los admins lo usan para probar los flujos exactamente como los ve un alumno (poseen permiso global).

Reportes y vistas globales
~~~~~~~~~~~~~~~~~~~~~~~~~~
`/reportes` ofrece reportes personalizables (csv/xlsx) sobre preinscripciones, materias, docentes y tramites. `/vistas` muestra paneles prearmados con indicadores para direccion (ej. cupos, documentacion pendiente, distribucion por carrera).

Procedimientos recomendados
---------------------------

1. Alta de personal administrativo o docente
   - Crear el usuario (import, backend o formulario dedicado).
   - Ingresar en `/secretaria/asignar-rol` y asociar los roles necesarios, profesorados visibles y permisos especiales.
   - Si actuara como docente, completar legajo en `/secretaria/docentes` y vincular en `/secretaria/catedra-docente`.
   - Enviar instrucciones de acceso y exigir cambio de contrasena.

2. Publicar o modificar una ventana academica
   - Abrir `/secretaria/habilitar-fechas`, elegir tipo de ventana (preinscripcion, inscripcion a materias, cambio de comision, mesas, tramites).
   - Definir rango de fechas, carrera/plan objetivo y estado Activo.
   - Notificar mediante `/mensajes` y, si aplica, fijar aviso en Dashboard.

3. Formalizar una preinscripcion
   - Revisar listado en `/preinscripciones` y abrir el registro.
   - Corregir datos y enviar a `/secretaria/confirmar-inscripcion` o `/gestion/confirmar`.
   - Completar el checklist documental (toda documentacion obligatoria + DDJJ en caso condicional).
   - Cambiar estado a Confirmada, Observada o Rechazada; los cambios quedan auditados.

4. Gestionar mesas, actas y notas
   - Crear mesa en `/secretaria/mesas`, asignar tribunal y cupos.
   - Habilitar inscripciones a mesa desde `/secretaria/habilitar-fechas`.
   - Cargar notas en `/secretaria/carga-notas` y generar acta en `/secretaria/actas-examen` o en la version de Primera Carga si es cohorte inicial.
   - Publicar resultados via `/mensajes` o reportes.

5. Enviar comunicacion masiva
   - Ir a `/mensajes`, crear hilo nuevo, seleccionar destinatarios por rol/carrera/comision.
   - Adjuntar archivos cuando sea necesario (ej. cronogramas).
   - Fijar el hilo para seguimiento y responder consultas desde la misma pantalla.

Buenas practicas
----------------
- Trabajar primero en ambiente de prueba antes de cambios estructurales.
- Exportar respaldos de BD y documentos antes de migraciones o lotes grandes.
- Registrar en `/mensajes` o en el backlog (docs/ISSUES.md) cualquier decision relevante.
- Revisar diariamente las alertas del Dashboard y la bandeja de Mensajes.
- Utilizar el boton de Guia de Usuario para validar que los manuales locales esten actualizados.

Escalamiento y soporte
----------------------
- Incidentes criticos (errores 500, caida de API, problemas de login generalizados): notificar a TI con captura de pantalla, hora y usuario afectado.
- Cambios funcionales o nuevas pantallas: abrir issue en docs/ISSUES.md y priorizar con el equipo de desarrollo.
- Requerimientos legales (auditorias, reportes oficiales): usar `/reportes` o `/vistas` y, si se necesita informacion adicional, coordinar con Datos.
- Si un rol no tiene acceso a un modulo, verificar primero en `/secretaria/asignar-rol` antes de escalar.

Circuitos administrativos clave
-------------------------------

Nueva preinscripcion
- El formulario publico y `/preinscripcion` comparten el wizard `PreinscripcionWizard`.
- Pasos: datos personales, contacto, estudios, carrera/documentos, declaracion jurada y confirmacion.
- Cada envio crea un registro visible en `/preinscripciones` con codigo unico y estado "Pendiente".

Sistema de mensajeria
- Todos los roles administrativos pueden abrir hilos con alumnos, docentes o autoridades.
- Los filtros por rol y carrera permiten segmentar comunicados.
- El contador en el icono del sidebar muestra mensajes sin leer.

Confirmacion de inscripciones (formalizacion)
- Se realiza en `/secretaria/confirmar-inscripcion` o `/gestion/confirmar`.
- Checklist documental define si el alumno queda Regular o Condicional.
- El cambio de estado notifica automaticamente (si hay notificaciones activas) y genera el legajo para portal de alumnos.
