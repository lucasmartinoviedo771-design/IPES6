# Roles y permisos (IPES6)

Resumen de visibilidad y acciones permitidas por tipo de usuario.

## Leyenda de módulos

- **Preinscripción**: Wizard público, gestión administrativa de preinscripciones, confirmación, carga de documentación.
- **Estructura académica**: Profesorados, planes, materias, correlatividades, horarios, docentes/comisiones vinculadas.
- **Gestión académica**: Formalizar inscripciones, comisiones, mesas de examen, pedidos de analíticos, carga de notas.
- **Ventanas / Habilitar fechas**: ABM de `VentanaHabilitacion`.
- **Portal alumno**: Trayectoria, inscripciones a carreras/materias, cambio de comisión, mesas, analíticos, equivalencias.
- **Vistas globales**: Consolidados (docentes y cátedras, estructura por profesorado, listados de preinscriptos/confirmados, horarios, pedidos de comisiones y analíticos, mesas, notas publicadas por fecha, ventanas pasadas/activas/futuras).
- **Vistas restringidas**: Igual que “Vistas globales” pero acotadas al alcance del rol (p.ej. un coordinador solo ve su profesorado).

## Matriz de permisos

| Rol              | Preinscripción | Estructura académica | Gestión académica | Ventanas / Habilitar fechas | Vistas globales | Vistas restringidas | Portal alumno |
|------------------|----------------|-----------------------|--------------------|-----------------------------|-----------------|---------------------|---------------|
| **Admin**        | Total          | Total                 | Total              | Total                       | Total           | —                   | Total         |
| **Secretaría**   | Total          | Total                 | Total              | Total                       | Total           | —                   | Consulta      |
| **Bedel**        | Gestión        | Lectura/Edición (profesorado, planes, materias, correlativas) | Formalizar inscripciones, comisiones, mesas, analíticos, carga notas | Solo lectura | Total (cuando exista) | — | Consulta |
| **Preinscripciones** | Gestión específica (ABM preinscripciones) | — | — | — | — | — | — |
| **Alumno**       | —              | —                     | —                  | —                           | —               | —                   | Total (solo sus datos) |
| **Coordinador**  | —              | Lectura sobre su profesorado | Lectura sobre su profesorado | Lectura | — | Total (solo su profesorado) | Consulta |
| **Tutor**        | —              | Lectura global        | Aprobación cambios de comisión | Lectura | — | Total (todos los profesorados) | Consulta |
| **Jefes**        | —              | Lectura global        | Lectura global     | Lectura                      | —               | Total (todos los profesorados) | Consulta |
| **Jefa AAEE**    | —              | Lectura global        | Lectura global     | Total                       | —               | Total (todos los profesorados) | Consulta |

Notas:

- “Gestión” implica crear/editar/eliminar según corresponda.
- “Consulta” dentro de Portal alumno implica acceso solo lectura a módulos informativos; no habilita las acciones del estudiante.
- Las vistas “en construcción” deben ocultarse si el rol no posee acceso. Cuando estén listas, reutilizar los helpers de roles para definir alcance.

## Reglas adicionales

- **Autorización granular**: usar `ensure_roles` y `ensure_profesorado_access` para limitar acceso a endpoints según `StaffAsignacion` (coordinadores) o reglas globales.
- **Estudiante**: solo endpoints bajo `/alumnos/*` y los asociados a su DNI. Debe retornar 403 para cualquier otra ruta protegida.
- **Bedel**: requiere capacidad de edición en estructura académica y gestión académica pero no crear nuevas ventanas.
- **Preinscripciones**: se concentra en `/preinscripciones/*` (incluye generar PDFs, checklist, confirmaciones).
- **Portal alumno** (modo prueba incluido) debe respetar los permisos: los usuarios administrativos no deberían actuar como alumno salvo que tengan el rol `alumno`.

## Implementación (pendiente de este objetivo)

1. **Backend**
   - Revisar cada endpoint de `core/api.py`, `apps/alumnos/api.py`, `apps/preinscriptions/api.py`, etc., y aplicar `ensure_roles` con la combinación adecuada.
   - Crear grupos para roles nuevos (`coordinador`, `tutor`, `jefes`, `jefa_aaee`) y asegurar que los seeds/tests los contemplen.
   - Extender `allowed_profesorados` para que coordinadores y tutores consulten solo sus unidades académicas.
2. **Frontend**
   - Helpers `hasRole`, `hasAnyRole` y `hasAllRoles` en un único módulo (`src/utils/roles.ts`).
   - Rutas (`App.tsx`) y menús (`AppShell.tsx`) deben usar esos helpers.
   - Tarjetas y componentes de dashboard/secretaría/alumnos mostrarán placeholders u ocultarán secciones según el rol.
3. **Verificación**
   - Actualizar usuarios de prueba (`*_test`) para que cubran todos los roles.
   - Checklist manual que recorra cada área.
