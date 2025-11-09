# Testing Blueprint

This folder concentrates everything added for automated validations so it can be removed quickly if needed.

## Backend (Django Ninja)

- Dependencies live in `backend/requirements-test.txt` and under the optional `test` extra in `backend/pyproject.toml`.
- Activate the virtualenv (`backend\.venv\Scripts\activate`) and install the tooling with  
  `python -m pip install -r requirements-test.txt`.
- The backend test suite uses `pytest` + `pytest-django`, configured through `backend/pytest.ini`.
- `config/settings_test.py` switches the database to SQLite, isolates media files, and forces an in‑memory cache.
- Shared fixtures live in `backend/conftest.py`. They generate role groups (`admin`, `secretaria`, `bedel`, `alumno`) and helper factories for authenticated clients.
- Example tests are under:
  - `backend/core/tests/test_auth_api.py`
  - `backend/apps/tests/test_health_api.py`
- Run the suite from `backend/` with:
  ```bash
  .venv\Scripts\python.exe -m pytest              # windows
  # or, if using uv:
  uv run pytest
  ```
- Coverage support is already wired: `python -m pytest --cov=apps --cov=core`.

### Seed data

Use Django fixtures (JSON/YAML) under `backend/tests/fixtures/` or factory helpers in `conftest.py`.  
Example command:
```bash
python manage.py loaddata backend/tests/fixtures/seed_users.json
```
Keep seed files inside `backend/tests` so they are easy to discard.

## Frontend (React + Vite)

- Testing stack: Vitest + Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`).
- Scripts in `frontend/package.json`:
  ```bash
  npm run test          # single run
  npm run test:watch    # watch mode
  npm run test:coverage # coverage report (v8)
  npm run lint          # ESLint sobre api/, context/, hooks/, tests y componentes clave
  ```
- Configuration lives in `frontend/vite.config.ts` (see the `test` block).
- Common helpers and setup files:
  - `src/test/setupTests.ts` (registers Testing Library + automatic cleanup)
  - `src/test/testUtils.tsx` (renders with MemoryRouter, QueryClient, Snackbar, MUI theme)
- Example spec: `src/test/RoleGate.test.tsx`.

## Manual Regression Checklists

Create per-role checklists in `docs/testing/` (e.g. `docs/testing/admin.md`, `docs/testing/alumno.md`). Suggested flows:
- **Admin** – dashboard widgets, permisos, carga de datos inicial.
- **Secretaría** – mensajería, actas, habilitar fechas, confirmación de inscripciones.
- **Bedel** – horarios, mesas, reportes básicos.
- **Alumno** – login, mensajes, certificados, horarios, trayectorias y PDF descargables.

## E2E Preparation

- Prefer Playwright or Cypress; store specs under `tests/e2e/` (new folder).
- Spin up backend with a known fixture set; the `conftest.py` helpers can bootstrap users with JWT cookies for API-only flows.
- Document startup commands alongside the spec files.

## Cleanup Map

Remove the following to purge the testing stack:

- CI: `.github/workflows/tests.yml`.
- Backend: `backend/pytest.ini`, `backend/config/settings_test.py`, `backend/conftest.py`, `backend/core/tests/`, `backend/apps/tests/`, `backend/requirements-test.txt`, the `project.optional-dependencies.test` block in `backend/pyproject.toml`.
- Frontend: `frontend/src/test/`, the `test` block in `frontend/vite.config.ts`, testing scripts and devDependencies in `frontend/package.json`, Vitest typings in `frontend/tsconfig.json`, and the updated `package-lock.json`.
- Delete this `docs/testing` folder.

Follow that list (in any order) and the repository returns to its previous “no tests” state.
