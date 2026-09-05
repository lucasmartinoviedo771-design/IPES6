# Auditoría Integral — IPES6 (commit `6159cdf`, main)

Revisión exhaustiva replicando la metodología de CFP: **seguridad, performance/N+1, código muerto, estructura/monolitos y tipos.**
Tamaño real: **337 archivos `.py`** (backend Django + Django-Ninja) + **358 `.ts/.tsx`** (React/Vite/MUI/TanStack). 1 solo `.js/.jsx` → la migración a TS NO hace falta (confirmado).

> **Veredicto general: el proyecto está SANO y bien construido, pero arrastra peso muerto de refactors anteriores y bajó la guardia en dos controles que en CFP estaban firmes (tipos `any` y CI).** No hay vulnerabilidades graves ni problemas estructurales serios. El hallazgo #1 (código muerto) es grande en volumen pero de riesgo bajo y barrido fácil.

---

## 🟢 LO QUE ESTÁ BIEN (sin acción)

### Seguridad — sólida
- **Sin secretos hardcodeados** en código real. `SECRET_KEY` desde env y *fail-closed*: si falta en prod, `raise RuntimeError` (no hay default "famoso"). `JWT_SECRET_KEY` independiente.
- `.env` y `.env.*` correctamente en `.gitignore` (solo se versiona `.env.example`). **Ningún archivo de credenciales/token está trackeado** por git.
- **DEBUG** desde env, default seguro (`False` en prod). `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` configurables.
- **CORS** con allowlist explícita (`CORS_ALLOW_ALL_ORIGINS = False`), credentials habilitadas con origins acotados.
- Bloque `IS_PROD`: **HSTS** 1 año + preload + subdominios, `SECURE_SSL_REDIRECT`, cookies `Secure`, `X_FRAME_OPTIONS = DENY`, `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_PROXY_SSL_HEADER` para Cloudflare.
- reCAPTCHA con score configurable, rate limiting de login y de preinscripciones, Silk de profiling protegido (solo superuser).
- Validadores de contraseña activos. Permisos por rol presentes (`core.permissions.get_user_roles`).

### Performance / N+1 — bien resuelto donde importa
- El endpoint más pesado (`admin_estudiantes_api.py`) usa el patrón correcto: `select_related`/`prefetch_related` + **bulk-fetch con `__in` y mapas en memoria** (`ec_map`, `cl_map`) en vez de consultar dentro del loop. El autor conoce y aplica el playbook.
- **51 archivos** usan `select_related`/`prefetch_related`. No se detectaron N+1 evidentes en los listados grandes revisados.

### Estructura de datos y tooling
- Modelos relacionales normalizados (Django ORM, MySQL 8). Backend con `uv`/`pyproject.toml` + lockfile. Frontend con `pnpm` + lockfile.
- **`tsconfig.json` con `strict: true` y `noEmit: true`** — la base de tipos está bien puesta.
- ESLint configurado con plugins de React/hooks/a11y/TS. `.editorconfig` presente.

---

## 🟡 HALLAZGOS (priorizados)

### 1. Código muerto: ~23.500 líneas en carpetas `_originals` 🔴 (volumen alto, riesgo bajo, barrido fácil)
Hay **12 carpetas `_originals`** (respaldos de refactors previos) dejadas en el repo:
- Frontend: **19 archivos / 19.747 líneas**
- Backend: **4 archivos / 3.773 líneas**
- **Nada las importa** desde el código vivo (verificado con grep). Son peso muerto puro: ensucian búsquedas, inflan el `grep`, confunden a quien lee, y los archivos más grandes del repo (`PlanillaRegularidadDialog` 2196L, `EstudiantesAdminPage` 1506L, etc.) son TODOS de `_originals`.
- **Riesgo:** bajo — están en git, se recuperan del historial si hiciera falta.
- **Fix:** borrarlas en un PR dedicado ("chore: eliminar respaldos `_originals`"). Verificar `tsc --noEmit` + `pnpm build` + que el backend arranque. ~30 min. **Es el mayor "limpiar de una" del proyecto.**

### 2. Tipos: 260 `any` + el linter los permite 🟠 (divergencia con CFP)
- **260 `any`** en código vivo (sin contar `_originals`). En CFP el estándar era **cero any**.
- La causa raíz está en el linter: `eslint.config.js` tiene **`"@typescript-eslint/no-explicit-any": "off"`**. Es decir, el `any` no está prohibido — por eso proliferó pese a `strict: true` en tsconfig.
- Concentración: `pages/Secretaria` (15), `pages/Estudiantes` (8), `pages/admin` (6), `components/preinscripcion` (5), `api/` (5). Mucho es `catch (err: any)` y `(x as any)` puntuales — deuda acotada, no caos.
- **Fix por etapas:** (a) cambiar la regla a `"warn"` para frenar nuevos; (b) ir bajando los existentes por carpeta (`catch (e: unknown)`, interfaces de respuesta de API, tipar `useState`); (c) cuando llegue a cero, subir la regla a `"error"`. NO hace falta migrar nada (ya es TS), es **endurecimiento de tipos**, no migración.

### 3. No hay CI 🟠 (divergencia con CFP)
- **No existe `.github/workflows/`.** En CFP el CI corría `tsc --noEmit` + lint en cada PR. Acá no hay nada que frene que entre un error de tipos, un `any` nuevo o un build roto.
- **Fix:** workflow mínimo en GitHub Actions: `pnpm install --frozen-lockfile` → `tsc --noEmit` → `eslint` → `pnpm build` (front); y `uv sync` + `python manage.py check` (back). Alto valor preventivo, esfuerzo chico. **Conviene hacerlo TEMPRANO**, así protege a los hallazgos #2 y #5 de regresiones.

### 4. `KIOSK_API_KEY` con default hardcodeado 🟡
- `settings.py:69`: `KIOSK_API_KEY = os.getenv("KIOSK_API_KEY", "dev-kiosk-key-secure-123")`. Si en prod no se setea la env, queda una clave conocida (está en el repo) que autentica los kioscos de asistencia.
- **Fix:** mismo patrón que `SECRET_KEY` — si `IS_PROD` y no está definida, `raise RuntimeError`. O al menos documentarla como obligatoria en el checklist de deploy. 5 min.

### 5. Cero tests de backend, casi cero de frontend 🟡
- **0** archivos de test en backend (hay `pytest` declarado en `pyproject` pero sin tests). Frontend: solo `setupTests.ts`, sin specs reales.
- **Riesgo:** medio. Un sistema en producción con datos reales, sin red de seguridad automatizada — cada cambio depende 100% de la prueba manual en navegador.
- **Fix:** no urge apagar incendios, pero conviene empezar a sembrar tests de las piezas críticas (permisos por rol, cálculo de regularidades/condicionales, el comando `verificar_residencias_condicionales`). De a poco.

### 6. `print()` y `console.log` olvidados 🟢 (pulido)
- **25 `print()`** en código vivo del backend (fuera de scripts/commands) y **5 `console.log/debug/info`** en el frontend. No filtran nada crítico, pero ensucian logs de prod.
- **Fix:** barrerlos (reemplazar por `logging` en backend donde aporte). Trivial.

### 7. 9 `TODO/FIXME` en backend 🟢
- Deuda anotada en el propio código. Revisarlos uno por uno: cerrar los resueltos, convertir en issue los que sigan vigentes.

---

## 🔵 MONOLITOS / ESTRUCTURA (a futuro, con criterio)

Recordá la regla de CFP: **el objetivo es código mantenible, no un número.** Un endpoint orquestador o un formulario largo PERO ordenado puede quedar largo.

### Frontend — ~26 archivos vivos >500 líneas
Candidatos reales a refactor (lógica enredada, no solo "largos"):
- `pages/admin/planilla-regularidad/hooks/usePlanillaForm.ts` (**1067L**, un hook gigante — el caso más claro)
- `pages/Estudiantes/MesaExamenPage.tsx` (973L)
- `pages/Secretaria/CargarMateriasPage.tsx` (793L)
- `pages/admin/HistorialActasPage.tsx` (745L), `EstudianteDetailForm.tsx` (717L), `NotaMesaPandemiaDialog.tsx` (695L)…

> Nota: `api/estudiantes/types.ts` (785L) es solo tipos — está bien que sea largo, NO refactorizar. Varias páginas ya viven en su carpeta con `hooks/` y `components/` (ej. `planilla-regularidad`, `estudiantes-admin`) → el patrón de refactor de CFP ya se está aplicando acá.

### Backend — 17 archivos vivos >500 líneas
Casi todos son archivos `api/` (orquestadores de endpoints Django-Ninja). `admin_estudiantes_api.py` (1176L) e `inscripciones_materias_api.py` (875L) podrían partirse por dominio (router por grupo de endpoints), pero NO es urgente y el código está ordenado. Evaluar caso por caso, sin forzar.

---

## PRIORIZACIÓN

| Acción | Esfuerzo | Urgencia | Riesgo de no hacerlo |
|---|---|---|---|
| 1. Borrar carpetas `_originals` (~23.5k líneas) | chico | **alta** (limpieza base) | bajo, pero confunde todo |
| 3. Agregar CI mínimo (tsc + lint + build) | chico | **alta** (preventivo) | regresiones silenciosas |
| 4. `KIOSK_API_KEY` fail-closed en prod | trivial | media | clave conocida en prod |
| 2. Endurecer tipos (`no-explicit-any` → warn, bajar anys) | medio/grande | media | erosión de la seguridad de tipos |
| 6. Barrer `print()`/`console.log` | trivial | baja | logs sucios |
| 7. Revisar 9 TODO/FIXME | chico | baja | deuda latente |
| 5. Sembrar tests (permisos, regularidades) | grande | media | sin red de seguridad |
| Monolitos front/back (caso por caso) | grande | baja | mantenibilidad a futuro |

---

## PROPUESTA DE PLAN DE ATAQUE POR ETAPAS (de a poco, una a la vez, verificando entre cada una)

**Etapa 0 — Higiene base (rápida, alto despeje):**
1. PR: eliminar las 12 carpetas `_originals`. Verificar build front + `manage.py check` back.
2. PR: barrer `print()`/`console.log` olvidados.
> Deja el repo limpio para que TODO lo demás (búsquedas, métricas de `any`, refactors) sea más fácil y honesto.

**Etapa 1 — Blindaje (preventivo, antes de tocar más código):**
3. PR: CI en GitHub Actions (front: `tsc --noEmit` + eslint + build; back: `manage.py check`).
4. PR: `KIOSK_API_KEY` fail-closed en prod + documentar en checklist de deploy.

**Etapa 2 — Endurecer tipos (por carpeta, gradual):**
5. Cambiar `no-explicit-any` a `"warn"` (frena nuevos sin romper el build).
6. Bajar los 260 `any` carpeta por carpeta (empezando por `pages/Secretaria` y `api/`), un PR por zona. Al llegar a cero → regla a `"error"`.

**Etapa 3 — Robustez (a futuro, sin apuro):**
7. Sembrar tests de las piezas críticas (permisos por rol, regularidades condicionales, comando del cron).
8. Refactor de los monolitos que de verdad lo pidan (arrancar por `usePlanillaForm.ts` 1067L), con la plantilla de CFP: extraer presentacional, sin cambiar comportamiento, de a uno.

---

## Diferencias clave IPES6 vs CFP (honestidad técnica)

| | CFP (al terminar) | IPES6 (hoy) |
|---|---|---|
| `any` en código vivo | 0 | **260** (linter los permite) |
| CI | `tsc` + lint en cada PR | **no existe** |
| Código muerto | limpio | **~23.5k líneas en `_originals`** |
| Migración TS | hecha | **no hace falta** (ya es TS) |
| N+1 / serializers | resueltos | **bien** en lo revisado |
| Seguridad | sólida | **sólida** (salvo `KIOSK_API_KEY`) |
| Tests | algunos | **prácticamente ninguno** |

**Conclusión:** IPES6 es un proyecto más grande y maduro que CFP en funcionalidad, con buenas decisiones de fondo (seguridad, ORM, estructura por features). Lo que falta es **disciplina de mantenimiento**: sacar el peso muerto, volver a prohibir el `any` y poner el CI de guardia. Empezar por la Etapa 0 (borrar `_originals`) da el mayor despeje con el menor riesgo.

---

> Nota sobre el árbol de trabajo actual: hay cambios locales sin commitear (borrado de `backend/requirements.txt` —correcto, ahora se usa `pyproject`/`uv`— y de 3 scripts en `backend/scripts/`, más una edición en `scripts/deploy.sh`). Revisar y commitear/descartar antes de arrancar las etapas, para partir de un `git status` limpio.
