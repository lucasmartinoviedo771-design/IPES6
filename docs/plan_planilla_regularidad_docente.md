# Plan: Planilla de Regularidad para Docentes (carga durante el cuatrimestre)

---

## Cambios aplicados en producción — rama `v1.001_estabilidad`

### Contexto previo (commit `146d3aa`)
El sistema tenía `EstudianteCarrera.estado_legajo` como campo almacenado
que secretaría seteaba manualmente, y `condicion_calculada` como cálculo
dinámico desde los checkboxes de documentación. Eran dos fuentes de datos
distintas que se desincronizaban.

### Commit `1579e2c` — Refactor: estado_legajo unificado a cálculo dinámico
- **Eliminó** `EstudianteCarrera.estado_legajo` del modelo y la DB (migración `0088`).
- El listado de estudiantes pasó a calcular la condición dinámicamente en
  cada consulta desde los checkboxes de documentación.
- Esto resolvió la desincronización entre ficha y listado.

### Commits `7797935` y `8996177` — Correcciones al sync (descartadas por el refactor de arriba)
Parches intermedios que intentaban mantener sincronizado el campo almacenado.
Quedaron superados por el refactor del commit anterior.

### Commit `3baec5c` — feat: recalcular Estudiante.estado_legajo automáticamente
**Este es el estado actual en producción.**

Se identificó que `Estudiante.estado_legajo` (campo distinto al eliminado,
en el modelo padre) es usado por `mesas_api.py` para autorizar inscripción
a exámenes finales y nunca se actualizaba automáticamente.

**Decisión de diseño final:**
- `Estudiante.estado_legajo` es la **única fuente de verdad** del estado del legajo.
- **No se calcula en cada consulta** — se calcula **una sola vez** cada vez
  que secretaría modifica los checkboxes de documentación y se persiste en la DB.
- Todas las partes del sistema (listado, autorización para rendir, portal
  del estudiante) leen de este campo sin recalcular.
- La función `_recalcular_estado_legajo()` en
  `apps/estudiantes/api/helpers/estudiante_admin.py` se dispara automáticamente
  en `_apply_estudiante_updates` y `_perform_documentacion_update`.
- Se corrió sincronización masiva sobre 3491 estudiantes para alinear los
  valores existentes.

---

## Objetivo

Habilitar al docente para cargar y visualizar la planilla de regularidad de su
materia durante el cuatrimestre, con datos pre-populados del sistema y la
posibilidad de ir completando notas progresivamente hasta el cierre.

---

## Requerimiento especial: Planillas inter-profesorado

Un estudiante de Profesorado A puede cursar una materia en Profesorado B
(ejemplo: estudiante de Primaria cursa Pedagogía en Especial porque le
superpone con otra cursada).

**Reglas:**
- La planilla de Pedagogía en Especial tiene **dos planillas separadas**:
  1. Una con los alumnos regulares de Especial (queda en Especial)
  2. Una con los alumnos visitantes de Primaria (va físicamente a Primaria)
- Si hay 2 estudiantes de Primaria cursando Pedagogía en Especial → **una sola
  planilla** para ambos (misma materia, mismo profesorado de origen).
- Si hay 1 estudiante de Primaria cursando Pedagogía y otro cursando Cs.
  Naturales en Especial → **dos planillas separadas** (una por materia).
- La nota se asigna al profesorado de origen del estudiante, no al de destino.
- Al imprimir, cada planilla lleva el encabezado del profesorado al que pertenece.

**Impacto en el modelo:**
- La planilla necesita saber cuál es el **profesorado de origen** de los
  estudiantes que la componen, además del profesorado donde se dicta.
- Agregar campo `profesorado_destino` (FK) al modelo de planilla para indicar
  a qué profesorado va la nota (puede diferir del profesorado del docente).

---

## Respuestas a preguntas de diseño

**1. ¿Qué ve el docente?**
Solo las materias/planillas que tiene activas en el período actual.
- El docente puede entrar y salir guardando borradores progresivamente
  (notas de TP, parciales, etc.) durante todo el cuatrimestre.
- Al vencer el plazo, el docente hace el **guardado definitivo** → la planilla
  se cierra y ya no puede modificarla.
- Solo Secretaría puede reabrir una planilla cerrada para correcciones.
  Cuando el docente guarda de nuevo → se vuelve a cerrar automáticamente.

**2. ¿Primera carga y planillas de docentes coexisten?**
Sí, siempre coexisten. Primera carga contiene planillas históricas de años
anteriores. Todas las planillas (históricas y nuevas) conviven en el sistema.
Pueden existir dos planillas con la misma fecha lectiva si tienen distintos
grupos de estudiantes.

**3. ¿Numeración de planillas?**
Auto-generada por el sistema con la misma lógica que primera carga
(prefijo PRP o similar, sin intervención manual).

**4. ¿La ventana de entrega es única o por profesorado?**
**Por profesorado**: cada profesorado tiene su propio rango de fechas para
la entrega de planillas de regularidad (fecha_desde / fecha_hasta).
No es un único global para todo el instituto.
Secretaría configura la ventana por profesorado desde el panel de habilitación
de fechas.

**5. ¿Cómo se carga la asistencia?**
El docente ingresa el porcentaje libremente (no se calcula automáticamente
por ahora). Esto aplica para este cuatrimestre y posiblemente el siguiente
hasta que el módulo de asistencia esté en uso pleno.

**Permisos de edición:**
| Rol | Puede editar |
|-----|-------------|
| Docente | Solo sus propias planillas asignadas |
| Bedel | Planillas de su profesorado |
| Secretaría | Todas las planillas |
| Docente de otra materia | No puede ver planillas ajenas |

---

## Módulos del plan

### MÓDULO 1 — Ventana de entrega de planillas de regularidad

**Modelo nuevo:** `VentanaPlanillaRegularidad`
```
profesorado   FK → Profesorado
anio_lectivo  int
cuatrimestre  str (1C / 2C / ANUAL)
fecha_desde   date
fecha_hasta   date
```
- Frontend: nueva entrada en `Secretaria/habilitar-fechas`.
- El sistema verifica esta ventana antes de permitir guardado definitivo.

**Complejidad:** Baja.

---

### MÓDULO 2 — Modelo de planilla de docentes (borrador)

Nuevo modelo `PlanillaRegularidadDocente` (separado de `RegularidadPlanilla`
de primera carga para no romper lo existente):

```
numero          str (auto-generado, ej: PRP-2025-001)
docente         FK → Docente
materia         FK → Materia
profesorado     FK → Profesorado (donde se dicta)
profesorado_destino FK → Profesorado (a quien va la nota; igual al anterior salvo inter-prof)
anio_lectivo    int
cuatrimestre    str
plantilla       FK → RegularidadPlantilla
estado          str (BORRADOR / CERRADA / REABIERTA)
fecha_entrega   date (null hasta cerrar)
created_at, updated_at
```

**Modelo de filas:**
```
PlanillaRegularidadDocenteFila
planilla        FK → PlanillaRegularidadDocente
estudiante      FK → Estudiante
orden           int (posición alfabética)
asistencia_porcentaje  int (editable por docente/bedel)
excepcion       bool
columnas_datos  JSONField (notas de TP, parciales, etc.)
situacion       str (calculada al cerrar)
en_resguardo    bool (default False)
```

**Complejidad:** Media.

---

### MÓDULO 3 — Pre-población de estudiantes

Al crear/abrir una planilla de borrador, el endpoint pre-carga:

1. **Estudiantes inscriptos** en la comisión de la materia
   (fuente: `InscripcionMateriaEstudiante`, estado activo)
2. **Orden alfabético** por apellido, sin duplicados
3. **Para planillas inter-profesorado**: solo los estudiantes cuyo
   profesorado de origen coincide con `profesorado_destino`
4. **Asistencia**: campo editable, pre-llenado con 0 (o con cálculo del
   módulo de asistencia si está disponible), con leyenda aclaratoria

**Complejidad:** Media.

---

### MÓDULO 4 — Vista del docente

**Ruta:** `Docentes/mis-planillas/`

**Pantalla 1 — listado de planillas activas:**
- Muestra las materias del docente con planilla activa en el período.
- Estado: BORRADOR / CERRADA / REABIERTA.
- Botón "Abrir" si está en ventana activa o REABIERTA.

**Pantalla 2 — formulario de planilla:**
- Encabezado auto-completado (materia, año, docente, número, fecha entrega).
- Tabla de filas igual a primera carga (reutilizar `FilasTable.tsx`).
- Asistencia editable por fila.
- Situación calculada automáticamente (reutilizar lógica `usePlanillaForm.ts`).
- Botón **"Guardar borrador"** — guarda sin cerrar.
- Botón **"Guardar y cerrar planilla"** — cierra definitivamente.
  - Aparece solo si la fecha está dentro de la ventana de entrega.
  - Al cerrar: genera registros `Regularidad` definitivos, aplica lógica
    de resguardo si legajo incompleto.

**Complejidad:** Alta (pero reutiliza ~70% del código existente).

---

### MÓDULO 5 — Nota en resguardo (legajo incompleto)

Al cerrar la planilla, para cada estudiante con situación positiva
(REGULAR / APROBADO / PROMOCIONADO) y `estado_legajo != COM`:
- La `Regularidad` se crea con `en_resguardo=True`.
- El estudiante ve en su trayectoria: *"Nota en resguardo — completar legajo"*.
- Secretaría/bedel ven la situación real con indicador visual.
- **Liberación automática:** cuando `_recalcular_estado_legajo()` detecta
  que el legajo pasó a COMPLETO → libera todos sus resguardos.

**Migración:** agregar `en_resguardo` a modelo `Regularidad`.

**Complejidad:** Baja (modelo + lógica de cierre + vista).

---

### MÓDULO 6 — Mensaje de error en mesas (mejora inmediata)

Archivo: `backend/apps/estudiantes/api/mesas_api.py` línea ~250.

**Actual:**
> *"Legajo incompleto o condicional: no puede rendir examen final."*

**Nuevo:**
> *"Tu legajo está incompleto. Para inscribirte a rendir debés completar
>  la documentación requerida. Dirigite al Bedel de tu carrera."*

**Complejidad:** Mínima.

---

## Orden de implementación

| # | Módulo | Complejidad | Hacer primero |
|---|--------|-------------|---------------|
| 1 | Mensaje error mesas | Mínima | Se puede hacer ya |
| 2 | `en_resguardo` en Regularidad + liberación automática | Baja | Migración simple |
| 3 | Ventana de entrega por profesorado | Baja | Modelo nuevo |
| 4 | Modelo PlanillaRegularidadDocente + filas | Media | Base de todo |
| 5 | Endpoint pre-población (inscritos + inter-prof) | Media | Necesita modelo |
| 6 | Vista docente — listado de planillas | Media | Necesita endpoint |
| 7 | Vista docente — formulario (reutiliza FilasTable) | Alta | Necesita listado |
| 8 | Cierre de planilla + generación de Regularidad | Media | Necesita form |
| 9 | Reapertura por secretaría | Baja | Necesita cierre |

---

## Archivos clave a reutilizar

| Archivo | Qué aporta |
|---------|-----------|
| `admin/planilla-regularidad/components/FilasTable.tsx` | Tabla de filas, cálculo situación |
| `admin/planilla-regularidad/hooks/usePlanillaForm.ts` | Lógica de cálculo de situación |
| `admin/planilla-regularidad/hooks/useRegularidadMetadata.ts` | Plantillas por formato |
| `apps/estudiantes/api/inscripciones_materias_api.py` | Lista de inscritos |
| `apps/asistencia/api_estudiantes.py` línea ~126 | Cálculo de porcentaje |
| `apps/primera_carga/services/planillas.py` | Lógica de cierre y generación Regularidad |

---

## Estado actual

- `Estudiante.estado_legajo` se recalcula automáticamente ✓
- Primera carga funciona y coexistirá con el nuevo sistema ✓
- `Regularidad` sin campo `en_resguardo` todavía
- No existe vista de planilla para docentes
- **Todo este plan se implementa en entorno de prueba primero**
