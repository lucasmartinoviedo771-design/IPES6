Propuestas de Issues

- Upgrade Vite 7
  - Motivo: resolver vulnerabilidades moderadas en `esbuild` transitivas de Vite.
  - Tareas:
    - Actualizar `vite` a 7.x y plugins asociados.
    - Verificar `tsconfig` y ajustes de build.
    - Probar `npm run dev` y `npm run build`.
    - Actualizar README si cambian comandos.

- Unificar esquemas de Preinscripción
  - Motivo: evitar duplicación y conflictos de tipos entre
    - `frontend/src/components/preinscripcion/schema.ts`
    - `frontend/src/features/preinscripcion/schema.ts`
  - Tareas:
    - Definir fuente única de verdad (p.ej. `features/.../schema.ts`).
    - Ajustar imports en componentes para usar un solo esquema.
    - Actualizar `defaultValues` y validaciones alineadas con la API.

