# Documentación Técnica IPES6

Este documento centraliza la información técnica necesaria para desarrolladores y administradores del sistema.

## 1. Configuración de Entorno (Docker en Windows)

Guía para correr el stack completo (MySQL + Django + React/Nginx) en Windows 11 usando Docker Desktop.

### Pre-requisitos
- Windows 11 con Docker Desktop instalado y WSL2 habilitado.
- Puertos libres: 8080 (frontend), 8000 (API) y 3307 (MySQL expuesto al host).
- Archivo `.env` en `backend/` con los secretos y configuraciones.

### Paso a paso
1. **Variables de entorno**: Desde `backend/` copia el template `.env.docker.example` a `.env` y ajusta `SECRET_KEY`, `DB_PASSWORD` y `ALLOWED_HOSTS`.
2. **Levantar contenedores**: `docker compose up -d --build` (dentro de `backend/`).
3. **Inicializar BD**: 
   ```powershell
   docker compose exec backend /app/.venv/bin/python manage.py migrate
   docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
   docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
   ```

## 2. Roles y Permisos

Resumen de visibilidad y acciones permitidas por tipo de usuario.

### Matriz de permisos

| Rol              | Preinscripción | Estructura académica | Gestión académica | Ventanas / Fechas | Vistas globales | Portal alumno |
|------------------|----------------|-----------------------|--------------------|-------------------|-----------------|---------------|
| **Admin**        | Total          | Total                 | Total              | Total             | Total           | Total         |
| **Secretaría**   | Total          | Total                 | Total              | Total             | Total           | Consulta      |
| **Bedel**        | Gestión        | Lectura/Edición       | Total (inscrip.)   | Solo lectura      | Total           | Consulta      |
| **Coordinador**  | —              | Lectura (su prof.)    | Lectura (su prof.) | Lectura           | Restringida     | Consulta      |
| **Estudiante**   | —              | —                     | —                  | —                 | —               | Total (propio)|

*Nota: "Gestión" implica crear/editar/eliminar. "Consulta" implica acceso solo lectura.*

## 3. Arquitectura del Sistema

IPES6 es una aplicación web full-stack:
- **Frontend**: React 18 + Vite + TypeScript (SPA).
- **Backend**: Django 5 + Django Ninja (API REST).
- **Base de Datos**: MySQL 8 (Producción) / SQLite (Desarrollo).
- **Despliegue**: Contenedores Docker orquestados con Docker Compose.

## 4. Pendientes y Desafíos Técnicos (Issues)

- ~~**Actualización Vite 7**: Resolver vulnerabilidades moderadas en `esbuild`.~~ *(¡Superado y migrado exitosamente a Vite 8.0.1!)*
- **Unificación de Esquemas**: Evitar duplicidad entre `components/preinscripcion/schema.ts` y `features/preinscripcion/schema.ts`.
- **Validación de Ventanas**: Mover validación de fechas de `VentanaHabilitacion` al servidor (actualmente solo en frontend).

---
*Última actualización: Marzo 2026*
