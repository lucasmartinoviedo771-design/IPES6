# Docker en Windows 11

Guia breve para correr el stack completo (MySQL + Django + React/Nginx) en Windows 11 usando Docker Desktop.

## Pre-requisitos
- Windows 11 con Docker Desktop instalado y WSL2 habilitado.
- Puertos libres: 8080 (frontend), 8000 (API) y 3307 (MySQL expuesto al host).
- Archivo `.env` en `backend/` con los secretos y configuraciones.

## 1) Preparar variables de entorno
Desde `backend/` copia el template y edita valores sensibles:

```powershell
cd backend
copy .env.docker.example .env
notepad .env  # o el editor que prefieras
```

Puntos clave:
- Cambia `SECRET_KEY`, `DB_PASSWORD` y `DB_ROOT_PASSWORD`.
- Ajusta `ALLOWED_HOSTS` con el nombre/IP de la PC si lo vas a consumir desde otra maquina de la red.
- Ajusta `FRONTEND_ORIGINS` si el frontend se abrira con un host distinto a `localhost:8080`.

## 2) Construir y levantar contenedores

```powershell
cd backend
docker compose up -d --build
```

Servicios levantados:
- `frontend` en http://localhost:8080
- `backend` en http://localhost:8000 (API en `/api`, docs en `/api/docs`)
- `db` (MySQL 8) publicado en el host en el puerto 3307

## 3) Migraciones, estaticos y admin
Ejecuta estos comandos una sola vez tras el primer arranque (o al actualizar el esquema):

```powershell
docker compose exec backend /app/.venv/bin/python manage.py migrate
docker compose exec backend /app/.venv/bin/python manage.py collectstatic --noinput
docker compose exec backend /app/.venv/bin/python manage.py createsuperuser
```

## 4) Comandos utiles
- Ver logs en vivo: `docker compose logs -f backend` (o `frontend`/`db`).
- Detener todo: `docker compose down` (agrega `-v` si quieres borrar los volumes, usualmente no).
- Reconstruir tras cambios de codigo: `docker compose up -d --build backend frontend`.

## Notas y ajustes
- Persistencia: los volumes nombrados `db_data`, `media_volume` y `static_volume` guardan la base, media y estaticos.
- Exponer en LAN: agrega la IP/host real en `ALLOWED_HOSTS` y `FRONTEND_ORIGINS`; luego accede con `http://IP_PC:8080`.
- Si tienes MySQL ocupando el puerto 3307 en el host, cambia el mapeo en `backend/docker-compose.yml`.
- El frontend usa `VITE_API_BASE=/api` y Nginx ya reenvia `/api` al contenedor `backend`; no requiere cambios adicionales.
