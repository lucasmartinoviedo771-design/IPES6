# Walkthrough: Dockerización IPES6

Se ha completado la configuración de Docker para el proyecto, permitiendo levantar todo el entorno (Backend, Frontend, Base de Datos) de manera orquestada.

## Cambios Realizados

### 1. Frontend
- **Nginx**: Se creó `frontend/nginx.conf` para servir la aplicación React y manejar el enrutamiento SPA (redirigiendo todo a `index.html`).
- **Dockerfile**: Se actualizó para copiar la configuración de Nginx.

### 2. Orquestación
- **Docker Compose**: Se creó `backend/docker-compose.yml`.
    - **Ubicación**: Se colocó en la carpeta `backend` debido a restricciones de acceso a la raíz, pero está configurado para funcionar correctamente desde allí.
    - **Servicios**:
        - `db`: MySQL 8.0 (Puerto 3307 para evitar conflictos).
        - `backend`: Django + Gunicorn (Puerto 8000).
        - `frontend`: Nginx (Puerto 8080 -> 80 interno).
    - **Variables de Entorno**: Se configuraron `FRONTEND_ORIGINS` y credenciales de base de datos directamente en el compose para asegurar conectividad.

## Cómo correr el proyecto con Docker

Desde la carpeta `backend/`:

1.  **Construir y levantar servicios**:
    ```bash
    docker-compose up --build
    ```
    *(Esto puede tardar unos minutos la primera vez)*.

2.  **Acceder a la aplicación**:
    - **Frontend**: [http://localhost:8080](http://localhost:8080)
    - **Backend API**: [http://localhost:8000/api](http://localhost:8000/api)
    - **Admin Django**: [http://localhost:8000/admin](http://localhost:8000/admin)

3.  **Detener servicios**:
    ```bash
    docker-compose down
    ```

## Notas Importantes
- El frontend corre en el puerto **8080** en modo Docker, diferente al 5173 de desarrollo.
- La base de datos de Docker se expone en el puerto **3307**.
