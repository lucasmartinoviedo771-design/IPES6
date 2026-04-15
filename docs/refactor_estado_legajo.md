# Refactor: Unificación de estado de legajo

## Problema técnico

Actualmente existe **duplicación de datos** para representar el mismo concepto
(si el legajo documental de un estudiante está completo):

### Fuente 1 — `EstudianteCarrera.estado_legajo` (campo almacenado en DB)
- Modelo: `core/models/estudiantes.py` línea ~216, clase `EstudianteCarrera`
- Valores: `COM` / `INC` / `PEN`
- Se usa en: listado de estudiantes para mostrar el chip de color y para el filtro "Estado legajo"
- Históricamente era seteable a mano por secretaría (aunque el campo está `disabled` en el form actual)

### Fuente 2 — `Estudiante.estado_legajo` (campo almacenado en DB, modelo padre)
- Modelo: `core/models/estudiantes.py` línea ~34, clase `Estudiante`
- **Este es diferente al anterior** — es el estado global del estudiante (no por carrera)
- Se usa en lugares críticos (ver tabla de usos abajo)
- **No debe eliminarse** como parte de este refactor

### Fuente 3 — `condicion_calculada` (calculado en el momento, nunca persistido)
- Se computa en: `_determine_condicion()` en `backend/apps/estudiantes/api/helpers/estudiante_admin.py`
- Valores: `"Regular"` / `"Condicional"` / `"Pendiente"`
- Lógica:
  - **Regular** = dni_legalizado + fotos_4x4 + certificado_salud + folios_oficio >= 3 + (titulo_secundario_legalizado o articulo_7)
  - **Condicional** = tiene alguna documentación pero no el set completo
  - **Pendiente** = sin documentación
- Fuente de datos: merge de campos `Estudiante` + `PreinscripcionChecklist`
- Se usa en: ficha del estudiante (chip "Condición" arriba a la derecha)

### Por qué se desincronizaban

`EstudianteCarrera.estado_legajo` no se actualizaba al modificar checkboxes de
documentación. Se agregó `_sync_estado_legajo_carreras()` como parche temporal
que sincroniza al guardar la ficha, pero la duplicación persiste.

---

## Alcance real del refactor

### Solo aplica a `EstudianteCarrera.estado_legajo`

El plan es eliminar únicamente el campo **por carrera** (`EstudianteCarrera.estado_legajo`)
y reemplazarlo por cálculo dinámico. El campo en `Estudiante.estado_legajo` (global)
tiene usos críticos propios y **no se toca**.

### Mapa completo de usos que hay que resolver

| Archivo | Qué hace | Impacto |
|---|---|---|
| `mesas_api.py` líneas ~185, ~244 | `est.estado_legajo == COMPLETO` para autorizar a rendir examen | **Crítico** — usa `Estudiante.estado_legajo` (no el de carrera, queda igual) |
| `trayectoria_api.py` línea ~595 | `est.get_estado_legajo_display()` en analíticos | Medio — usa `Estudiante.estado_legajo`, queda igual |
| `preinscriptions/services.py` líneas ~123-124 | Sincroniza `PreinscripcionChecklist.estado_legajo → Estudiante.estado_legajo` | Medio — revisar si también sincroniza `EstudianteCarrera` |
| `preinscriptions/admin_api.py` línea ~113 | Setea `Estudiante.estado_legajo = COMPLETO` al confirmar preinscripción | Medio — uses `Estudiante`, queda igual |
| `auth_schemas.py` línea ~36 | `estado_legajo` en schema de autenticación (portal del estudiante) | Medio — expone `Estudiante.estado_legajo`, queda igual |
| `core/admin.py` línea ~92 | Django admin lista `estado_legajo` de `Estudiante` | Bajo — queda igual |
| `estudiante_service.py` líneas ~72-87 | Lee `cd.estado_legajo` de `EstudianteCarrera` para el listado | **Cambiar** — calcular dinámicamente |
| `admin_estudiantes_api.py` línea ~59 | `qs.filter(estado_legajo=...)` para filtrar listado | **Cambiar** — filtrar en Python post-cálculo |
| `EstudiantesTable.tsx` | Muestra `c.estado_legajo_display` | **Cambiar** — usar campo `condicion` |
| `EstudianteDetailForm.tsx` línea ~289 | Selector `estado_legajo` disabled en form de carrera | **Eliminar** |
| `useEstudianteAdminMutations.ts` línea ~108 | Envía `estado_legajo` en `carreras_update` | **Eliminar** |

---

## Cambios necesarios

### Backend

1. **`core/models/estudiantes.py`**: eliminar `estado_legajo` de `EstudianteCarrera`
   y crear migración.

2. **`backend/apps/estudiantes/services/estudiante_service.py` líneas ~72-87**:
   en el loop del listado, en lugar de leer `cd.estado_legajo`, calcular
   `condicion_calculada` por estudiante usando `_determine_condicion` con merge
   de checklist. Devolver como campo `condicion` en `carreras_detalle`.

3. **`backend/apps/estudiantes/api/admin_estudiantes_api.py` línea ~59**:
   el filtro `qs.filter(estado_legajo=...)` deja de funcionar sin el campo.
   Filtrar en Python después del cálculo (viable con 3482 estudiantes).

4. **`backend/apps/estudiantes/schemas/estudiantes_admin.py`**: cambiar
   `estado_legajo` / `estado_legajo_display` por `condicion: str` en el schema
   de `carreras_detalle`.

5. **Eliminar `_sync_estado_legajo_carreras()`** y sus llamadas en
   `_apply_estudiante_updates` y `_perform_documentacion_update`.

6. **`preinscriptions/services.py`**: verificar si al confirmar una preinscripción
   también setea `EstudianteCarrera.estado_legajo`. Si es así, eliminar esa línea.

### Frontend

7. **`EstudiantesTable.tsx`**: cambiar `c.estado_legajo_display` por `c.condicion`
   y mapear colores: Regular → `success`, Condicional → `warning`, Pendiente → `default`.

8. **`EstudianteDetailForm.tsx` línea ~289**: eliminar el bloque del selector
   `estado_legajo` de carrera (está `disabled`, no sirve).

9. **`useEstudianteAdminMutations.ts` línea ~108**: quitar `estado_legajo` del
   `carreras_update`.

10. **Filtro "Estado legajo" en la UI**: ajustar valores del select de
    `Estado legajo` → `condicion`: `Regular` / `Condicional` / `Pendiente`.

---

## Preguntas respondidas

- **¿Filtro frecuente?** Volumen bajo (3482 estudiantes). Filtrar en Python
  post-cálculo es perfectamente viable, sin annotate ORM.
- **¿Exportaciones Excel?** No hay referencias a `EstudianteCarrera.estado_legajo`
  en reportes, salvo `trayectoria_api.py` que usa `Estudiante.estado_legajo` (no se toca).
- **¿Portal del estudiante?** `auth_schemas.py` expone `Estudiante.estado_legajo`
  (el global), no el de carrera. No se ve afectado.

---

## Estado actual (producción, rama `v1.001_estabilidad`)

- Ambos campos existen. `EstudianteCarrera.estado_legajo` se sincroniza como
  caché via `_sync_estado_legajo_carreras()` al guardar la ficha.
- Se corrió sincronización masiva sobre 3482 estudiantes.
- El sistema funciona correctamente pero con la duplicación descrita.
- **No hacer el refactor en producción hasta validar en entorno de prueba.**
