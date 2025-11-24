# Plan de Trabajo: Integración de Alertas de Correlatividades

Este documento detalla los pasos para integrar la visualización de "Correlativas Caídas" en el frontend, aprovechando que el backend ya dispone de los endpoints necesarios.

## 1. Backend (Estado Actual)
Los endpoints ya existen en `apps/alumnos/api/reportes_api.py`:
- **Admin**: `GET /api/alumnos/reportes/correlativas-caidas?anio=2024`
- **Alumno**: `GET /api/alumnos/me/alertas`

**Acción requerida**: Ninguna en el backend.

## 2. Frontend: Capa de API
Crear o actualizar los servicios para consumir estos endpoints.

- [ ] Crear `src/api/reportes.ts` (o agregarlo a `alumnos.ts`).
- [ ] Definir la interfaz `CorrelativaCaidaItem`:
  ```typescript
  export interface CorrelativaCaidaItem {
    estudiante_id: number;
    dni: string;
    apellido_nombre: string;
    materia_actual: string;
    materia_correlativa: string;
    motivo: string;
  }
  ```
- [ ] Implementar funciones:
  - `getCorrelativasCaidas(anio?: number)`
  - `getMisAlertas()`

## 3. Frontend: Panel Administrativo
Objetivo: Que secretaría/admin vea rápidamente quiénes tienen problemas.

- [ ] **Nuevo Componente**: `src/components/dashboard/AdminCorrelativasWidget.tsx`
  - Debe mostrar una tabla o lista compacta.
  - Columnas: Alumno, Materia Cursando, Correlativa Adeudada, Motivo.
  - Botón para exportar o imprimir (opcional por ahora).
- [ ] **Integración**: Agregar este widget en `src/pages/DashboardPage.tsx` (vista Admin).

## 4. Frontend: Panel de Alumno
Objetivo: Avisar al alumno si su cursada corre riesgo.

- [ ] **Nuevo Componente**: `src/components/dashboard/StudentAlerts.tsx`
  - Consultar `getMisAlertas()`.
  - Si la lista está vacía, no mostrar nada (o mostrar "Sin alertas").
  - Si hay alertas, mostrar un componente `Alert` de MUI (color `warning` o `error`).
    - Texto ejemplo: "Atención: Tenés problemas de correlatividad en [Materia] por [Motivo]".
- [ ] **Integración**: Agregar este widget en la parte superior de `src/pages/DashboardPage.tsx` (vista Alumno).

## 5. Testing y Validación
- [ ] Verificar con un usuario Admin que se vean las alertas globales.
- [ ] Verificar con un usuario Alumno que se vean sus propias alertas.
