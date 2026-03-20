# PROYECTO DE SOFTWARE  
# Convocatoria “Desarrollo de Software – Gestión de Estudiantes 2025”

**Título:** IPES6 – Sistema Integral de Gestión de Estudiantes del I.P.E.S. “Paulo Freire”  
**Institución:** I.P.E.S. “Paulo Freire”  
**Postulante:** Oviedo Lucas Martín  
**Fecha:** [Completar]  
**Versión del documento:** 1.0

---

## Índice sugerido
1. Presentación del proyecto  
2. a) Fundamentación de la propuesta  
3. b) Tipo de software o programa propuesto  
4. c) Aspectos técnicos y de programación  
5. d) Alcances del software  
6. e) Cronograma tentativo de desarrollo e implementación  
7. f) Presupuesto estimativo (si corresponde)  
8. g) Prototipo o demo del programa propuesto  
9. Cierre  
10. Anexos (capturas de pantalla, diagramas, etc.)

> **Nota:** Este documento está diseñado para copiar/pegar directamente en un procesador de texto (Word, LibreOffice, Google Docs) o convertirlo a PDF sin ajustes adicionales.

---

## Presentación del proyecto
IPES6 es una plataforma concebida para unificar la gestión estudiantil del instituto en una única aplicación web. El desarrollo alcanza aproximadamente un 90 % de avance, incluye prototipos navegables y responde a necesidades detectadas en terreno durante los últimos dos ciclos lectivos. Su foco es reducir la carga administrativa, mejorar la trazabilidad de la información y brindar a los equipos directivos datos oportunos para la toma de decisiones.

---

## a) Fundamentación de la propuesta
### Justificación del enfoque técnico
En el I.P.E.S. “Paulo Freire” conviven planillas aisladas, formatos en papel y aplicaciones parciales. Esta dispersión ocasiona duplicidad de información, retrasos en la actualización de legajos y escasa visibilidad integral de las trayectorias de los estudiantes. IPES6 concentra en una única base central todos los procesos claves (preinscripciones, legajos, asistencia, reportes) y los expone mediante una interfaz web moderna.

La elección de una arquitectura web full-stack (React + Django) responde a criterios concretos:
- **Accesibilidad:** ingreso desde cualquier navegador autorizado sin instalaciones locales complejas.
- **Escalabilidad:** separación frontend/backend permite crecer por módulos y distribuir la carga en varios servidores.
- **Mantenibilidad:** frameworks consolidados, comunidad activa y disponibilidad de talento en el mercado local.
- **Estandarización:** API REST documentada que facilita integraciones futuras con sistemas jurisdiccionales.

### Ventajas frente a la organización actual
- Eliminación de la doble carga gracias a formularios validados y reutilización de datos maestros.
- Emisión instantánea de constancias, listados y estadísticas con filtros dinámicos.
- Base única para estudiantes, carreras y comisiones, con historial unificado.
- Disminución de errores de transcripción y alertas automáticas ante datos incompletos.
- Capacidad de auditar cada modificación y responder a requerimientos del Ministerio con evidencia trazable.

### Vinculación con objetivos institucionales
IPES6 se alinea con el plan estratégico del instituto: digitalizar procesos, acompañar trayectorias con datos confiables y profesionalizar la gestión administrativa. El diseño surge del relevamiento directo de secretaría, bedelía, coordinación y rectorado, por lo que el producto refleja la práctica cotidiana (no solo la normativa). Además, la arquitectura elegida admite ampliaciones futuras, asegurando sostenibilidad y mejoras continuas.

---

## b) Tipo de software o programa propuesto
- **Denominación:** IPES6 – Sistema Integral de Gestión de Estudiantes.
- **Tipo:** Aplicación web full-stack con arquitectura cliente-servidor.

### Frontend (cliente)
- Lenguaje: TypeScript.
- Framework: React 18 con Vite.
- Librerías complementarias: React Router (ruteo), React Query (sincronización de datos), React Hook Form + Zod (formularios), Recharts (gráficos), Tailwind CSS (estilos utilitarios) o equivalente.
- Distribución: SPA servida como archivos estáticos optimizados.
- Requisitos: navegadores modernos (Chrome, Firefox, Edge) y conexión segura HTTPS dentro de la intranet institucional.

### Backend (servidor)
- Lenguaje: Python 3.11.
- Framework principal: Django 5 con Django Ninja/Django REST Framework para la API REST tipada.
- Autenticación: JWT (SimpleJWT) para el frontend y sesiones de Django para personal administrativo/administración.
- Internacionalización: configurado para es-AR y zona horaria America/Argentina/Buenos_Aires.
- Servicios adicionales: Celery + Redis opcionales para tareas diferidas (envío de notificaciones, generación de reportes masivos).

### Base de datos
- Desarrollo: SQLite, para simplificar la instalación local y pruebas.
- Producción: MySQL/MariaDB en contenedor Docker (configurable vía variables de entorno); soporta réplicas de solo lectura.
- Backups programados y posibilidad de exportar a formatos abiertos (CSV/ODS).

### Compatibilidad y requisitos mínimos
- Servidor Linux o Windows con Python 3.11, acceso a MySQL/MariaDB y Nginx/Apache como proxy inverso.
- HTTPS con certificados válidos (Let’s Encrypt o provisión institucional).
- Política de usuarios con roles diferenciados (secretaría, bedelía, coordinación, docentes, administrador).

---

## c) Aspectos técnicos y de programación
### Lenguajes principales
- Python para la lógica de negocio y la API.
- TypeScript/JavaScript para la interfaz SPA.
- SQL para consultas especializadas y reporting.

### Frameworks y bibliotecas
**Backend**
- Django (ORM, migraciones, panel administrativo).
- Django Ninja + DRF (endpoints REST, documentación automática Swagger/Redoc).
- django-cors-headers (políticas CORS).
- reportlab / WeasyPrint (PDFs oficiales y constancias).
- django-filter y django-import-export (listados filtrables y cargas masivas).
- pytest + factory_boy (pruebas automatizadas).

**Frontend**
- React 18 con hooks + Context API/Redux Toolkit según módulo.
- Vite (desarrollo rápido, builds optimizadas).
- React Router 6 (navegación declarativa).
- React Hook Form + Zod (formularios y validaciones declarativas).
- TanStack Query (sincronización con la API, cache local).
- Tailwind CSS / Chakra UI (componentes accesibles y consistentes).

### Arquitectura y capas
1. **Datos:** base MySQL/SQLite gestionada por el ORM de Django (tablas para estudiantes, carreras, comisiones, asistencias, trámites).
2. **Negocio:** aplicaciones Django independientes (admisiones, alumnos, carreras, asistencia, métricas) con servicios compartidos (notificaciones, auditoría).
3. **Presentación:** SPA en React que consume la API REST vía HTTPS; manejo de estado por módulo y control de permisos en el cliente.
4. **Integración:** endpoints JSON listos para interoperar con sistemas provinciales; soporte para CSV/Excel en import/export.

### Instalación y mantenimiento
- Variables de entorno gestionadas mediante `.env` (credenciales DB, claves JWT, configuraciones de correo SMTP, reCAPTCHA).
- Scripts estándar de Django (`migrate`, `loaddata`, `createsuperuser`) y npm (`npm run build`, `npm run preview`).
- Automatización recomendada con contenedores Docker y orquestación simple (docker-compose) para despliegues reproducibles.
- Monitorización: logs estructurados, métricas básicas mediante Django Admin + paneles (Grafana/Elastic opcional).

### Escalabilidad y seguridad
- Despliegue en contenedores replicables (gunicorn + nginx).
- CORS/CSRF configurados según dominios autorizados.
- Tokens con expiración renovable, refresh tokens almacenados de forma segura.
- Copias de seguridad diarias con retención de 30 días.
- Control de acceso por rol y bitácora (quién modificó qué y cuándo).
- Compatibilidad futura con SSO institucional (OAuth2/SAML).

---

## d) Alcances del software
### Procesos cubiertos
1. **Preinscripciones**
   - Formularios guiados con validaciones dinámicas y carga de documentación digitalizada.
   - Emisión automática de comprobantes PDF con número de trámite.
   - Panel de seguimiento para bedelía (estado, observaciones, requisitos faltantes).
2. **Gestión de estudiantes**
   - Altas, bajas y modificaciones de legajos.
   - Asignación a carreras, cohortes, comisiones y trayectos formativos.
   - Historial completo de inscripciones, equivalencias y cursadas.
3. **Carreras y planes**
   - Administración de planes, materias, correlatividades.
   - Gestión de comisiones, horarios y cupos.
   - Relación automática entre materias y estudiantes inscriptos.
4. **Asistencia (módulo inicial)**
   - Registro de asistencia para comisiones piloto.
   - Reportes de porcentaje por estudiante y alertas por ausentismo reiterado.
5. **Métricas y reportes**
   - Listados por cohorte/carrera/comisión exportables a CSV/PDF.
   - Indicadores básicos: matrícula activa, egresos, abandonos.
   - Dashboards resumidos para equipos directivos.

### Perspectivas de mejora
- Extender el módulo de asistencia a todas las carreras y sumar firmas digitales.
- Reportes estadísticos avanzados (abandono temprano, seguimiento de egreso).
- Integración con sistemas provinciales y con plataformas de comunicación institucional.
- Notificaciones automáticas por correo/SMS y mensajería interna a docentes y estudiantes.
- Portal autogestionado para estudiantes (consultar estado, descargar constancias).

---

## e) Cronograma tentativo
El desarrollo actual permite enfocar esfuerzos en pruebas, formación y despliegue. Se propone el siguiente cronograma (estimado 12–16 semanas):

| Fase | Periodo estimado | Estado | Actividades principales |
| --- | --- | --- | --- |
| 1. Diseño y relevamiento | Finalizado | ✔ | Relevamiento de procesos, modelado de datos, prototipo inicial. |
| 2. Desarrollo módulos principales | Finalizado en 90 % | ✔ | Preinscripciones, legajos, carreras, asistencia inicial. |
| 3. Pruebas y ajustes | Semanas 1–4 | En curso | QA con datos reales, mejoras UX, pruebas de carga básica. |
| 4. Capacitación | Semanas 5–6 | Pendiente | Talleres para secretaría/bedelía/coordinación, manuales rápidos. |
| 5. Implementación progresiva | Semanas 7–12 | Pendiente | Puesta en marcha por módulos, mesa de ayuda, ajustes finales. |

> Las fases 3–5 pueden solaparse parcialmente para acelerar resultados sin comprometer la calidad.

---

## f) Presupuesto estimativo (referencial)
La convocatoria no requiere licenciamiento comercial; sin embargo, se proyectan costos para su sostenimiento:

| Concepto | Descripción | Estimación (referencial) |
| --- | --- | --- |
| Desarrollo evolutivo | 120–160 horas para ajustes normativos, nuevos módulos y mejoras UX. | [Completar monto] |
| Mantenimiento anual | Actualizaciones de dependencias, monitoreo, backups, soporte correctivo (6–8 hs/mes). | [Completar monto] |
| Capacitación | 2–3 jornadas iniciales + refuerzos semestrales; materiales impresos/digitales. | [Completar monto] |
| Infraestructura | Hosting en servidor institucional o nube, certificados SSL, almacenamiento de respaldos. | [Completar monto] |

Se pueden detallar montos concretos si la base de la convocatoria lo exige, presentando cotizaciones actualizadas.

---

## g) Prototipo / demo prevista
- **Opción A – Entorno de prueba:** acceso a una instancia demo con datos ficticios, usuario invitado y tiempo de navegación supervisado.
- **Opción B – Video demostrativo:** recorrido guiado (5–7 minutos) que cubre preinscripción, edición de legajo, emisión de constancia y listado filtrado por cohorte.
- **Opción C – Demo en vivo:** sesión virtual/presencial ante el jurado, con carga de casos reales (anonimizados) y espacio para preguntas técnicas.

Cada modalidad incluye guion de presentación, checklist de casos de uso críticos y material de apoyo (capturas + ficha técnica).

---

## Cierre
IPES6 integra en un único ecosistema procesos que hoy consumen tiempo y generan errores. Con un stack moderno (React + Django + MySQL), un avance tangible del 90 % y un conocimiento profundo de la realidad del I.P.E.S. “Paulo Freire”, el proyecto ofrece:
- Modernización real de la gestión estudiantil.
- Datos confiables para decisiones estratégicas.
- Flexibilidad para crecer y alinearse a futuras normativas.

Se deja constancia de la voluntad de realizar una demostración práctica y de responder cualquier consulta técnica, funcional o presupuestaria que el jurado considere pertinente.

---

## Anexos sugeridos
1. Capturas de pantallas clave (preinscripción, vista de estudiante, listados, reportes).
2. Diagramas de arquitectura lógica y modelo entidad-relación.
3. Manual rápido para usuarios finales (resumen de acciones más frecuentes).
4. Cronograma detallado (Gantt) y tabla RACI de roles durante la implementación.
5. Curriculum Vitae y documentación respaldatoria (DNI, antecedentes, certificaciones).

> **Instrucción:** Adjuntar estos anexos en PDF o incorporarlos como sección adicional al final del documento antes de exportar.

