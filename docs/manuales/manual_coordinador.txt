Manual de uso - Rol Coordinador
===============================

Objetivo del rol
----------------
El coordinador académico supervisa la ejecución de los profesorados a su cargo, acompaña a docentes y estudiantes, y canaliza ajustes curriculares hacia Secretaría o Dirección. Aunque no modifica la estructura directamente, dispone de pantallas para relevar información y registrar comunicaciones formales.

Acceso en AppShell
------------------
- **Dashboard:** visión rápida de preinscripciones e indicadores generales.
- **Carreras:** exploración completa de profesorados, planes y materias, con acceso al detalle de inscriptos por materia.
- **Reportes y Vistas globales:** descarga de listados y paneles con métricas (regularidades, mesas, documentación, etc.).
- **Mensajes:** canal institucional para comunicarse con docentes, tutores, bedeles y estudiantes de las cohortes asignadas.
- **Portal de Alumnos:** acceso a `/alumnos` para anticipar qué opciones ve cada estudiante (útil cuando se los acompaña en inscripciones).

Procedimientos habituales
-------------------------

1. Revisión de planes y comisiones
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Ir a `Carreras`.
2. Seleccionar el profesorado bajo tu responsabilidad.
3. Ingresar al plan vigente para ver la grilla de materias con datos de **año**, **régimen**, **horas** y botones “Ver inscriptos”.
4. Desde “Ver inscriptos” se abre `/carreras/:profesoradoId/planes/:planId/materias/:materiaId/inscriptos`, donde puedes descargar listados o copiar la lista para solicitar ajustes a Secretaría.

2. Seguimiento mediante reportes
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Abrir `Reportes`.
2. Elegir el dataset (preinscripciones, inscripciones a materias, mesas, documentación, etc.).
3. Aplicar filtros por carrera, cohorte o estado.
4. Usar **Exportar CSV/XLSX** para compartir con directivos o cargar en tus planillas internas.
5. En `Vistas` revisar las gráficas automáticas (ej. avance por año, alumnos condicionales). Cada tarjeta ofrece filtros rápidos para focalizar en tu departamento.

3. Comunicación institucional
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. En `Mensajes` pulsar “Nuevo mensaje”.
2. Definir **asunto** y, opcionalmente, un **tema** para facilitar la búsqueda futura.
3. Seleccionar destinatarios:
   - Buscar por nombre/DNI cuando sea un caso puntual.
   - Usar filtros por rol (Docentes, Estudiantes, Tutores) y limitar por carrera para notificaciones masivas.
4. Redactar el cuerpo del mensaje, adjuntar PDFs si corresponde y enviar.
5. Cada vez que recibas consultas, responde en el mismo hilo para dejar trazabilidad; puedes fijar hilos importantes para monitoreo.

4. Relevamiento de incidentes académicos
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Usa `Portal de Alumnos > Trayectoria / Inscripción a Materias / Mesa de Examen` para reproducir el escenario que reporta el estudiante.
2. Documenta el hallazgo en `Mensajes`, etiquetando a Secretaria o Bedelía.
3. Adjunta capturas o exportes desde `Reportes` si la incidencia afecta a varias personas.


5. Seguimiento de correlatividades por cohorte
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
1. Entra a `Secretaria > Correlatividades`, filtra el profesorado y plan que coordinas y selecciona la **Version** activa.
2. Usa el filtro **Cohorte** para validar que requisitos ve cada ingreso y detectar cohortes sin planilla asignada.
3. En `Gestionar versiones` se visualiza nombre, rango y fechas; comparte esos datos con Secretaria cuando necesites ajustes (coordinacion tiene vista pero no edicion).
4. Cada vez que se publica una version con `cohorte desde` posterior, la version previa se cierra automaticamente (`cohorte hasta = nuevo - 1`). Confirmar la cobertura continua antes de escalar cambios.

Buenas prácticas
----------------
- Mantén plantillas de mensajes para recordatorios periódicos (fechas de inscripción, entrega de notas, etc.).
- Antes de solicitar una modificación curricular, verifica en `Carreras` y `Reportes` que la información esté actualizada; adjunta los ID de plan/materia al escalar el pedido.
- Revisa el Dashboard al iniciar el día para detectar picos de actividad que requieran refuerzo del equipo tutor o de bedelía.
