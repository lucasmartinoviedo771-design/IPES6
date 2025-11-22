# Sistema de Gestión Académica - IPES Paulo Freire

Sistema integral para preinscripción, cursadas, notas y trámites administrativos del IPES Paulo Freire. Consta de un backend Django expuesto vía API Ninja y un frontend React/Vite con UI MUI.

## Arquitectura
- Backend: Django 5.2.8, Django Ninja, MySQL, JWT en cookies HTTP-only + CSRF, generación de PDFs (WeasyPrint, ReportLab).
- Frontend: React 18 + Vite 7, TypeScript, MUI, TanStack Query, React Hook Form + Zod, React Router.
- Gestión de dependencias backend con `uv`; frontend con `npm`.

## Requisitos
- Python 3.11+
- Node.js 18+
- UV (`pip install uv`)
- MySQL en ejecución
- Git

## Puesta en marcha

### Backend (Django)
1) `cd backend`
2) Copia y ajusta el entorno: `copy Original.env .env` (o usa `ENV_TEMPLATE.md` como guía para credenciales y secretos).
3) Instala dependencias: `uv pip sync requirements.txt`
4) Migra la base: `uv run python manage.py migrate`
5) (Opcional) Chequea variables críticas: `uv run python manage.py check_env`
6) (Opcional) Crea superusuario: `uv run python manage.py createsuperuser`
7) Ejecuta el servidor: `uv run python manage.py runserver` → http://127.0.0.1:8000

### Frontend (React/Vite)
1) `cd frontend`
2) Instala dependencias: `npm ci` (o `npm install`)
3) Variables locales en `.env.local`:
   ```
   VITE_API_BASE=http://localhost:8000/api
   ```
4) Levanta el dev server: `npm run dev` → http://localhost:5173

## Dashboards por rol
Las tarjetas de cada panel están centralizadas en `frontend/src/components/roles/dashboardItems.tsx`. Ahí se definen títulos, descripciones, iconos y rutas reutilizables (Bedeles, Tutorías, Coordinación, etc.).

Para sumar una tarjeta:
1. Agrega la entrada en `dashboardItems.tsx` exportando `DASHBOARD_ITEMS.MI_NUEVA_CARD`.
2. En el `Index.tsx` del rol, importa `DASHBOARD_ITEMS` y referencia la clave en el arreglo `sections` que consume `RoleDashboard`.

## Scripts útiles
- Backend: `uv run pytest`, `uv run python manage.py check_env`, `uv run python manage.py runserver`.
- Frontend: `npm run dev`, `npm run build`, `npm run lint`, `npm test`.

## Mantenimiento reciente
- Migración a Vite 7 y reorganización de rutas en `frontend/src/router`.
- APIs frontend centralizadas en `frontend/src/api` y dashboards compartidos por rol.
- Autenticación reforzada con cookies HTTP-only + CSRF.
- `requirements.txt` regenerado con `uv pip compile` para alinear dependencias con `pyproject.toml`.

## Contenedores (Docker)
- Backend: `backend/Dockerfile` y `backend/docker-compose.yml` para levantar API + MySQL localmente (ajusta variables del compose antes de subir).
- Frontend: `frontend/Dockerfile` y `frontend/nginx.conf` para servir el build estático detrás de Nginx.
- Flujo sugerido: construir imágenes desde `backend/` y `frontend/` tras generar `.env` y `npm run build`; luego orquestar con compose o tu stack de despliegue.

## Autor
- Oviedo Lucas
